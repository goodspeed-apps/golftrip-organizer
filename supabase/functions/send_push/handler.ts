// supabase/functions/send_push/handler.ts
// Testable core logic for the send_push edge function.
// No Deno URL imports — uses only relative _shared imports which Jest can mock.

import { serviceClient, userClient } from '../_shared/edge-client.ts';
import { HttpError } from '../_shared/http-error.ts';
import { writeAuditLog } from '../_shared/audit-log.ts';
import { requireCronSecret, timingSafeStringEqual } from '../_shared/edge-auth.ts';
import { EXPO_PUSH_URL, EXPO_PUSH_BATCH_SIZE } from '../_shared/expo-push.ts';
import { NOTIFICATION_CATEGORIES, type NotificationCategory } from '../../../types/notifications.ts';
import { captureException } from '../_shared/sentry.ts';

export type { NotificationCategory };

export interface SendPushPayload {
  userIds: string[];
  category: NotificationCategory;
  title: string;
  body: string;
  data?: { deepLink?: string; [key: string]: unknown };
}

export interface SendPushResult {
  sent: number;
  receipts: string[];
  removed: string[];
}

// Re-export for backwards-compat with any tests that import BATCH_SIZE directly.
export { EXPO_PUSH_BATCH_SIZE as BATCH_SIZE } from '../_shared/expo-push.ts';

const VALID_CATEGORIES: NotificationCategory[] = [...NOTIFICATION_CATEGORIES];

/**
 * Auth gate: accepts CRON_SECRET header OR admin JWT. envGet is injected for testability.
 * Returns the serviceClient instance created during JWT auth so handleSendPush can reuse it
 * instead of constructing a second instance (I4).
 */
export async function requireAuth(
  req: Request,
  envGet: (key: string) => string | undefined = (k) => Deno.env.get(k),
): Promise<{ svc: ReturnType<typeof serviceClient> }> {
  // If caller presents x-cron-secret, route exclusively through cron path.
  // Hard-fail when CRON_SECRET is unset or header mismatches — silent fallthrough
  // to JWT would be a security hole (C1).
  if (req.headers.get('x-cron-secret') !== null) {
    requireCronSecret(req, envGet);
    return { svc: serviceClient() };
  }

  // Accept admin JWT
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new HttpError(401, 'Unauthorized');
  }

  const userCli = userClient(authHeader);
  const { data, error } = await userCli.auth.getUser();
  if (error || !data.user) {
    throw new HttpError(401, 'Unauthorized');
  }

  const svc = serviceClient();
  const { data: profile, error: profileErr } = await svc
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single();

  if (profileErr || profile?.role !== 'admin') {
    throw new HttpError(403, 'Forbidden: admin role required');
  }

  return { svc };
}

/**
 * Core send-push logic: fetches tokens, batches to Expo, cleans stale tokens, writes audit log.
 *
 * The second `_signal` parameter is accepted (and ignored) so job-worker can call
 * handleSendPush(job.payload, ac.signal) with a uniform handler signature.
 * AbortSignal support can be wired into the fetch calls in a future pass if needed.
 */
export async function handleSendPush(
  payload: Record<string, unknown> | SendPushPayload,
  _signal?: AbortSignal,
  prebuiltClient?: ReturnType<typeof serviceClient>,
): Promise<SendPushResult> {
  const { userIds, category, title, body, data } = payload as SendPushPayload;

  if (!userIds?.length) throw new HttpError(400, 'userIds is required and must be non-empty');
  if (!VALID_CATEGORIES.includes(category)) throw new HttpError(400, `Invalid category: ${category}`);
  if (!title) throw new HttpError(400, 'title is required');
  if (!body) throw new HttpError(400, 'body is required');

  // Reuse the client from requireAuth when available (avoids a second construction).
  const client = prebuiltClient ?? serviceClient();

// Fetch tokens for users who have this category preference enabled.
  // preferences values are boolean JSON; ->> casts to text so 'true' is the correct comparison string.
  // A CHECK constraint in migration 013 enforces boolean-only values, keeping this contract stable.
  const { data: rows, error: fetchErr } = await client
    .from('push_tokens')
    .select('expo_push_token, user_id, preferences')
    .in('user_id', userIds)
    .eq(`preferences->>${category}`, 'true') as { data: Array<{ expo_push_token: string; user_id: string }> | null; error: unknown };

  if (fetchErr) throw fetchErr;

  const tokenRows = rows ?? [];
  const tokens: string[] = tokenRows.map((r) => r.expo_push_token);
  // Build a map for O(1) user_id lookup when writing push_deliveries
  const tokenUserIdMap = new Map<string, string>(tokenRows.map(r => [r.expo_push_token, r.user_id]));

  if (tokens.length === 0) {
    await writeAuditLog({
      actorType: 'system',
      action: 'push_sent',
      targetTable: 'push_tokens',
      targetData: { category, recipientCount: 0, deepLink: data?.deepLink ?? null, removed: [] },
    });
    return { sent: 0, receipts: [], removed: [] };
  }

// Build all batch fetch promises and dispatch concurrently
  async function sendBatch(batch: string[]): Promise<{ receipts: string[]; removed: string[]; deliveries: Array<{ receipt_id: string; push_token: string }> }> {
    const messages = batch.map(to => ({ to, title, body, data: data ?? {} }));
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Expo push API error ${res.status}: ${text}`);
    }
    const result = await res.json() as { data: Array<{ id?: string; status?: string; details?: { error?: string } }> };
    const ticketData = result.data ?? [];
    const receipts: string[] = [];
    const removed: string[] = [];
    const deliveries: Array<{ receipt_id: string; push_token: string }> = [];
    for (let j = 0; j < ticketData.length; j++) {
      const ticket = ticketData[j];
      if (ticket.details?.error === 'DeviceNotRegistered') {
        removed.push(batch[j]);
      } else if (ticket.id) {
        receipts.push(ticket.id);
        deliveries.push({ receipt_id: ticket.id, push_token: batch[j] });
      }
    }
    return { receipts, removed, deliveries };
  }

// Dispatch Expo push batches with a concurrency cap of 5 to avoid overwhelming the API (I7).
  type BatchResult = { receipts: string[]; removed: string[]; deliveries: Array<{ receipt_id: string; push_token: string }> };
  const batches: string[][] = [];
  for (let i = 0; i < tokens.length; i += EXPO_PUSH_BATCH_SIZE) {
    batches.push(tokens.slice(i, i + EXPO_PUSH_BATCH_SIZE));
  }
  const CONCURRENCY = 5;
  const batchResults: BatchResult[] = [];
  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    const wave = batches.slice(i, i + CONCURRENCY).map(sendBatch);
    const waveResults = await Promise.all(wave);
    batchResults.push(...waveResults);
  }

  // flatMap over results in one pass — avoids O(n²) spread-into-accumulator (M2).
  const allReceipts = batchResults.flatMap(r => r.receipts);
  const allRemoved = batchResults.flatMap(r => r.removed);
  const allDeliveries = batchResults.flatMap(r => r.deliveries);

  // Deduplicate stale tokens before delete + recipientCount (I6).
  const uniqueRemoved = [...new Set(allRemoved)];

  // Single bulk delete for all stale tokens.
  if (uniqueRemoved.length > 0) {
    await client.from('push_tokens').delete().in('expo_push_token', uniqueRemoved);
  }

  // Bulk insert push_deliveries for every ticket that has a receipt_id to poll.
  // One INSERT per batch dispatched in parallel. Check each result for errors (C3).
  const sentAt = new Date().toISOString();
  const deliveryInserts: Promise<{ error: unknown }>[] = [];
  for (let i = 0; i < allDeliveries.length; i += EXPO_PUSH_BATCH_SIZE) {
    const deliveryBatch = allDeliveries.slice(i, i + EXPO_PUSH_BATCH_SIZE).map(d => ({
      receipt_id: d.receipt_id,
      push_token: d.push_token,
      user_id: tokenUserIdMap.get(d.push_token) ?? null,
      status: 'pending',
      sent_at: sentAt,
    }));
    if (deliveryBatch.length > 0) {
      deliveryInserts.push(
        client.from('push_deliveries').insert(deliveryBatch) as Promise<{ error: unknown }>,
      );
    }
  }
  const insertResults = await Promise.all(deliveryInserts);
  for (const result of insertResults) {
    // Push was already sent — log error but do not throw (C3).
    if (result.error) captureException(result.error);
  }

  await writeAuditLog({
    actorType: 'system',
    action: 'push_sent',
    targetTable: 'push_tokens',
    targetData: {
      category,
      recipientCount: tokens.length - uniqueRemoved.length,
      deepLink: data?.deepLink ?? null,
      removed: uniqueRemoved,
    },
  });

  return {
    sent: tokens.length - uniqueRemoved.length,
    receipts: allReceipts,
    removed: uniqueRemoved,
  };
}
