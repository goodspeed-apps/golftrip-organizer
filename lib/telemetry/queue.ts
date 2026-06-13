import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TelemetryEvent } from './types';

const QUEUE_KEY = '@goodspeed:telemetry:queue';

export class EventQueue {
  private buffer: TelemetryEvent[] = [];
  constructor(private readonly maxSize: number = 200) {}

  async load(): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(QUEUE_KEY);
      if (raw) this.buffer = JSON.parse(raw) as TelemetryEvent[];
    } catch {
      this.buffer = [];
    }
  }

  async push(event: TelemetryEvent): Promise<void> {
    this.buffer.push(event);
    if (this.buffer.length > this.maxSize) this.buffer.shift();
    await this.persist();
  }

  drain(): TelemetryEvent[] {
    const out = this.buffer.slice();
    this.buffer = [];
    void this.persist();
    return out;
  }

  async restore(events: TelemetryEvent[]): Promise<void> {
    this.buffer = [...events, ...this.buffer].slice(-this.maxSize);
    await this.persist();
  }

  size(): number {
    return this.buffer.length;
  }

  private async persist(): Promise<void> {
    try {
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(this.buffer));
    } catch {
      // Storage full or unavailable; drop persistence, keep in-memory buffer.
    }
  }
}