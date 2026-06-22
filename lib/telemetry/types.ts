import { z } from 'zod';

export const EventTypeSchema = z.enum([
  'screen_view', 'screen_dwell', 'navigation', 'dropoff',
  'session_start', 'session_end',
  'conversion',
  'tap', 'scroll_depth', 'form_field_event', 'gesture',
  'crash', 'js_error', 'anr', 'perf_metric', 'memory_peak',
  'offline_encounter', 'empty_state', 'search_no_results', 'modal_dismiss',
]);

export type EventType = z.infer<typeof EventTypeSchema>;

export const TelemetryEventSchema = z.object({
  appId: z.string(),
  category: z.string(),
  deviceId: z.string().optional().default(''),
  sessionId: z.string().optional().default(''),
  eventType: EventTypeSchema,
  screenName: z.string().optional(),
  screenKind: z.string().optional(),
  durationMs: z.number().int().nonnegative().optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
  timestamp: z.string().datetime({ offset: true }),
});

export type TelemetryEvent = z.infer<typeof TelemetryEventSchema>;
export type TelemetryEventInput = z.input<typeof TelemetryEventSchema>;

export interface TelemetryConfig {
  appId: string;
  category: string;
  ingestUrl: string;
  ingestSecret: string;
  flushIntervalMs?: number;
  maxQueueSize?: number;
  enabled?: boolean;
}

export const IngestBatchSchema = z.object({
  appId: z.string(),
  category: z.string(),
  events: z.array(TelemetryEventSchema).min(1).max(500),
});

export type IngestBatch = z.infer<typeof IngestBatchSchema>;