import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleOptions, json, err } from '../_shared/edge-response.ts';
import { serviceClient } from '../_shared/edge-client.ts';
import { reportException, log } from '../_shared/edge-logger.ts';
import { verifyHmacSignature } from '../_shared/webhook-sig.ts';
import { enqueueJob } from '../_shared/jobs.ts';

// ──────────────── CONFIGURE PER PROVIDER ────────────────
const PROVIDER = 'example';
const SECRET_ENV = 'EXAMPLE_WEBHOOK_SECRET';
const SIG_HEADER = 'x-example-signature';
// Some providers prefix the hex signature. Examples:
//   GitHub: 'sha256='   (header is "sha256=abcd...")
//   Slack:  'v0='       (header is "v0=abcd...")
//   Stripe: uses a more complex t=...,v1=... format — handle in custom code, not via SIG_PREFIX
const SIG_PREFIX = '';                 // strip this prefix from the header before verifying
const EVENT_ID_PATH = 'id';            // dotted path into the JSON body
const KIND = 'process_example_event';  // job kind to enqueue
// ────────────────────────────────────────────────────────

// 30 days; webhook providers typically resend within this window
const IDEMPOTENCY_TTL_MS = 30 * 24 * 60 * 60 * 1000;

serve(async (req: Request) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  if (req.method !== 'POST') return err('Method not allowed', 405);

  try {
    const secret = Deno.env.get(SECRET_ENV);
    if (!secret) return err(`Missing ${SECRET_ENV}`, 503, 'secret_not_configured');

    const raw = await req.text();
    const rawSig = req.headers.get(SIG_HEADER) ?? '';
    const signature = SIG_PREFIX && rawSig.startsWith(SIG_PREFIX)
      ? rawSig.slice(SIG_PREFIX.length)
      : rawSig;
    const valid = await verifyHmacSignature({ secret, payload: raw, signature });
    if (!valid) {
      log('warn', `webhook-${PROVIDER}`, 'bad_signature');
      return err('Bad signature', 401, 'bad_signature');
    }

    const body = JSON.parse(raw) as Record<string, unknown>;
    const eventId = getByPath(body, EVENT_ID_PATH);
    if (!eventId || typeof eventId !== 'string') {
      return err('Missing event id', 400, 'event_id_missing');
    }

    const client = serviceClient();
    const { error: insErr } = await client.from('idempotency_keys').insert({
      scope: `webhook:${PROVIDER}`,
      key: eventId,
      result: {},
      expires_at: new Date(Date.now() + IDEMPOTENCY_TTL_MS).toISOString(),
    });
    if (insErr && (insErr as { code?: string }).code === '23505') {
      return json({ status: 'duplicate' });
    }
    if (insErr) throw insErr;

    try {
      await enqueueJob({ kind: KIND, payload: body });
    } catch (e) {
      // Clean up idempotency row so re-delivery can retry.
      await client.from('idempotency_keys')
        .delete()
        .eq('scope', `webhook:${PROVIDER}`)
        .eq('key', eventId);
      throw e;
    }
    return json({ status: 'queued' });
  } catch (e) {
    reportException(`webhook-${PROVIDER}`, e);
    return err(e instanceof Error ? e.message : String(e), 500, 'webhook_error');
  }
});

function getByPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}