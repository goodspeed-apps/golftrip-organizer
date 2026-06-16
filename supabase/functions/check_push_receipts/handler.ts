// supabase/functions/check_push_receipts/handler.ts
// Testable core logic for the check_push_receipts edge function.
// No Deno URL imports — uses only relative _shared imports which Jest can mock.

import { serviceClient } from '../_shared/edge-client.ts';
import { HttpError } from '../_shared/http-error.ts';
import { writeAuditLog } from '../_shared/audit-log.ts';
import { requireCronSecret } from '../_shared/edge-auth.ts';
import { retryWithBackoff } from '../_shared/retry.ts';
import { EXPO_RECEIPTS_URL, EXPO_PUSH_BATCH_SIZE } from '../_shared/expo-push.ts';
import { captureException } from '../_shared/sentry.ts';

export interface PollReceiptsResult {
  polled: number;
  ok: number;
  error: number;
  expired: number;
  tokensRemoved: number;
}

// Hardcoded defaults — operator can override via handleCheckPushReceipts config param.
const EXPIRE_AFTER_MINUTES_DEFAULT = 30;
const MIN_AGE_MINUTES_DEFAULT = 1;
const MAX_ROWS_PER_RUN_DEFAULT = 1000;

export interface PushDeliveryRow {
  id: string;
  receipt_id: string;
  push_token: string;
  user_id: string | null;
  status: string;
  sent_at: string;
}

export interface ExpoReceiptData {
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string; [key: string]: unknown };
}

export interface ReceiptPollConfig {
  expireAfterMinutes?: number;
  minAgeMinutes?: number;
  maxRowsPerRun?: number;
}

/**
 * Auth gate: accepts CRON_SECRET header only (this is a cron-triggered function).
 * Delegates to the shared requireCronSecret; constructs serviceClient locally so
 * callers can pass it straight to handleCheckPushReceipts.
 */
export async function requireCronAuth(
  req: Request,
  envGet: (key: string) => string | undefined = (k) => Deno.env.get(k),
): Promise<{ svc: ReturnType<typeof serviceClient> }> {
  requireCronSecret(req, envGet);
  return { svc: serviceClient() };
}

/**
 * Fetch Expo receipts using shared retryWithBackoff (C5).
 */
async function fetchExpoReceipts(
  ids: string[],
): Promise<Record<string, ExpoReceiptData>> {
  return retryWithBackoff(async () => {
    const res = await fetch(EXPO_RECEIPTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Expo receipts API error ${res.status}: ${text}`);
    }
    const result = await res.json() as { data: Record<string, ExpoReceiptData> };
    return result.data ?? {};
  }, { maxRetries: 2, baseDelay: 500 });
}

/**
 * Core poll logic: fetch pending push_deliveries, query Expo for receipts, settle rows.
 * Accepts optional config to override hardcoded defaults (I1).
 */
export async function handleCheckPushReceipts(
  prebuiltClient?: ReturnType<typeof serviceClient>,
  config?: ReceiptPollConfig,
): Promise<PollReceiptsResult> {
  const client = prebuiltClient ?? serviceClient();

  const EXPIRE_AFTER_MINUTES = config?.expireAfterMinutes ?? EXPIRE_AFTER_MINUTES_DEFAULT;
  const MIN_AGE_MINUTES = config?.minAgeMinutes ?? MIN_AGE_MINUTES_DEFAULT;
  const MAX_ROWS_PER_RUN = config?.maxRowsPerRun ?? MAX_ROWS_PER_RUN_DEFAULT;

  const { data: rows, error: fetchErr } = await client
    .from('push_deliveries')
    .select('id, receipt_id, push_token, user_id, status, sent_at')
    .eq('status', 'pending')
    .lt('sent_at', new Date(Date.now() - MIN_AGE_MINUTES * 60 * 1000).toISOString())
    .order('sent_at', { ascending: true })
    .limit(MAX_ROWS_PER_RUN) as { data: PushDeliveryRow[] | null; error: unknown };

  if (fetchErr) throw fetchErr;

  const allRows = rows ?? [];
  if (allRows.length === 0) {
    return { polled: 0, ok: 0, error: 0, expired: 0, tokensRemoved: 0 };
  }

const expireThreshold = new Date(Date.now() - EXPIRE_AFTER_MINUTES * 60 * 1000).toISOString();
  // Single-pass partition avoids iterating allRows twice (M3).
  const { expiredRows, activeRows } = allRows.reduce<{ expiredRows: PushDeliveryRow[]; activeRows: PushDeliveryRow[] }>(
    (acc, r) => {
      if (r.sent_at < expireThreshold) acc.expiredRows.push(r);
      else acc.activeRows.push(r);
      return acc;
    },
    { expiredRows: [], activeRows: [] },
  );

  let expired = 0;
  if (expiredRows.length > 0) {
    const expiredIds = expiredRows.map(r => r.id);
    const { error: expireErr } = await client
      .from('push_deliveries')
      .update({ status: 'expired', settled_at: new Date().toISOString() })
      .in('id', expiredIds);
    if (expireErr) {
      // Log but continue — cron will retry unprocessed rows.
      captureException(expireErr);
    } else {
      expired = expiredIds.length;
    }
  }

  let okCount = 0;
  let errorCount = 0;
  let tokensRemoved = 0;

  for (let i = 0; i < activeRows.length; i += EXPO_PUSH_BATCH_SIZE) {
    const batch = activeRows.slice(i, i + EXPO_PUSH_BATCH_SIZE);
    const receiptIds = batch.map(r => r.receipt_id);

    let receipts: Record<string, ExpoReceiptData> = {};
    try {
      receipts = await fetchExpoReceipts(receiptIds);
    } catch {
      // Cron will pick up unprocessed rows on next run — skip this batch.
      continue;
    }

    // Accumulate settled IDs and errors for bulk operations (C4).
    const okIds: string[] = [];
    interface ErrorRow { id: string; error_message: string | null; error_code: string | null }
    const errorRows: ErrorRow[] = [];
    const staleTokens: string[] = [];

    const settledAt = new Date().toISOString();

    for (const row of batch) {
      const receipt = receipts[row.receipt_id];
      if (!receipt) continue;

      if (receipt.status === 'ok') {
        okIds.push(row.id);
        okCount++;
      } else if (receipt.status === 'error') {
        errorRows.push({
          id: row.id,
          error_message: receipt.message ?? null,
          error_code: (receipt.details?.error as string | undefined) ?? null,
        });
        errorCount++;

        if (receipt.details?.error === 'DeviceNotRegistered') {
          staleTokens.push(row.push_token);
        }
      }
    }

    // Bulk UPDATE ok rows (C4).
    if (okIds.length > 0) {
      const { error: okErr } = await client
        .from('push_deliveries')
        .update({ status: 'ok', settled_at: settledAt })
        .in('id', okIds);
if (okErr) {
        const { captureException } = await import('../_shared/sentry.ts');
        captureException(okErr);
        okCount = Math.max(0, okCount - okIds.length); // don't count rows we failed to persist (C2)
      }
    }

// UPDATE error rows — grouped by (error_code, error_message) to minimise round-trips (C4).
    // Build a map keyed by "code\x00message" so rows sharing the same code+message
    // are settled in a single UPDATE … WHERE id IN (…).
    const errorGroups = new Map<string, { ids: string[]; error_code: string | null; error_message: string | null }>();
    for (const eRow of errorRows) {
      const key = `${eRow.error_code ?? ''}\x00${eRow.error_message ?? ''}`;
      const group = errorGroups.get(key);
      if (group) {
        group.ids.push(eRow.id);
      } else {
        errorGroups.set(key, { ids: [eRow.id], error_code: eRow.error_code, error_message: eRow.error_message });
      }
    }
    for (const group of errorGroups.values()) {
      const { error: eErr } = await client
        .from('push_deliveries')
        .update({
          status: 'error',
          error_message: group.error_message,
          error_code: group.error_code,
          settled_at: settledAt,
        })
        .in('id', group.ids);
if (eErr) {
        captureException(eErr);
        errorCount = Math.max(0, errorCount - group.ids.length);
      }
    }

    // Bulk DELETE stale tokens (C4).
    if (staleTokens.length > 0) {
      const { error: delErr } = await client
        .from('push_tokens')
        .delete()
        .in('expo_push_token', staleTokens);
      if (delErr) {
        captureException(delErr);
      } else {
        tokensRemoved += staleTokens.length;
      }
    }
  }

  const polled = allRows.length;
  const metadata = { polled, ok: okCount, error: errorCount, expired, tokensRemoved };

  await writeAuditLog({
    actorType: 'system',
    action: 'push_receipts_polled',
    targetTable: 'push_deliveries',
    targetData: metadata,
  });

  return { polled, ok: okCount, error: errorCount, expired, tokensRemoved };
}
