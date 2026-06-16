// supabase/functions/check_push_receipts/index.ts
// Thin Deno serve wrapper — all logic lives in handler.ts (testable).

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleOptions, json, err } from '../_shared/edge-response.ts';
import { HttpError } from '../_shared/http-error.ts';
import { initSentry, withTransaction } from '../_shared/sentry.ts';
import { reportException } from '../_shared/edge-logger.ts';
import { requireCronAuth, handleCheckPushReceipts } from './handler.ts';

serve(async (req: Request) => {
  initSentry('check_push_receipts');

  const opt = handleOptions(req);
  if (opt) return opt;

  if (req.method !== 'POST') {
    return err('Method not allowed', 405);
  }

  try {
const { svc } = await requireCronAuth(req, (k) => Deno.env.get(k));
function envInt(key: string): number | undefined {
      const raw = Deno.env.get(key);
      if (!raw) return undefined;
      const n = parseInt(raw, 10);
      return Number.isFinite(n) ? n : undefined;
    }
    const config = {
      expireAfterMinutes: envInt('RECEIPT_POLL_EXPIRE_MINUTES'),
      minAgeMinutes: envInt('RECEIPT_POLL_MIN_AGE_MINUTES'),
      maxRowsPerRun: envInt('RECEIPT_POLL_MAX_ROWS'),
    };
    const result = await withTransaction('check_push_receipts', 'edge-function', () =>
      handleCheckPushReceipts(svc, config),
    );
    return json(result);
  } catch (e) {
    reportException('check_push_receipts', e);
    if (e instanceof HttpError) {
      return err(e.message, e.status, 'check_push_receipts_error');
    }
    return err(e instanceof Error ? e.message : String(e), 500, 'check_push_receipts_error');
  }
});