// supabase/functions/send_push/index.ts
// Thin Deno serve wrapper — all logic lives in handler.ts (testable).

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleOptions, json, err } from '../_shared/edge-response.ts';
import { HttpError } from '../_shared/http-error.ts';
import { initSentry, withTransaction } from '../_shared/sentry.ts';
import { reportException } from '../_shared/edge-logger.ts';
import { requireAuth, handleSendPush, type SendPushPayload } from './handler.ts';

serve(async (req: Request) => {
  initSentry('send_push');

  const opt = handleOptions(req);
  if (opt) return opt;

  if (req.method !== 'POST') {
    return err('Method not allowed', 405);
  }

try {
    const { svc } = await requireAuth(req, (k) => Deno.env.get(k));
    const body = (await req.json()) as SendPushPayload;
    const result = await withTransaction('send_push', 'edge-function', () => handleSendPush(body, undefined, svc));
    return json(result);
  } catch (e) {
    reportException('send_push', e);
    if (e instanceof HttpError) {
      return err(e.message, e.status, 'send_push_error');
    }
    return err(e instanceof Error ? e.message : String(e), 500, 'send_push_error');
  }
});
