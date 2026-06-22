import { EventQueue } from './queue';
import { signBatchAsync } from './hash';
import { TelemetryEventSchema, type TelemetryConfig, type TelemetryEvent, type TelemetryEventInput } from './types';

export class TelemetryClient {
  private readonly queue: EventQueue;
  private readonly flushIntervalMs: number;
  private readonly enabled: boolean;
  private timer: ReturnType<typeof setInterval> | null = null;
  private flushing = false;

  constructor(private readonly config: TelemetryConfig) {
    this.queue = new EventQueue(config.maxQueueSize ?? 200);
    this.flushIntervalMs = config.flushIntervalMs ?? 30_000;
    this.enabled = config.enabled !== false;
  }

  async start(): Promise<void> {
    if (!this.enabled) return;
    await this.queue.load();
    this.timer = setInterval(() => { void this.flush(); }, this.flushIntervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  track(event: Omit<TelemetryEventInput, 'appId' | 'category' | 'timestamp'>): void {
    if (!this.enabled) return;
    const full: TelemetryEvent = TelemetryEventSchema.parse({
      ...event,
      appId: this.config.appId,
      category: this.config.category,
      timestamp: new Date().toISOString(),
    });
    void this.queue.push(full);
  }

  async flush(): Promise<void> {
    if (!this.enabled || this.flushing) return;
    this.flushing = true;
    try {
      const batch = this.queue.drain();
      if (batch.length === 0) return;
      const body = { appId: this.config.appId, category: this.config.category, events: batch };
      const sig = await signBatchAsync(body, this.config.ingestSecret);
      try {
        const res = await fetch(this.config.ingestUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goodspeed-signature': sig },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          // 4xx (except 429) is non-retryable: bad signature, schema violation, payload too large.
          // Restoring would loop forever. Drop and rely on out-of-band logging upstream.
          const retryable = res.status >= 500 || res.status === 429 || res.status === 408;
          if (retryable) await this.queue.restore(batch);
        }
      } catch {
        await this.queue.restore(batch);
      }
    } finally {
      this.flushing = false;
    }
  }
}