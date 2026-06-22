// supabase/functions/oauth-get-token/index.ts
// User-gated endpoint: returns the plaintext access token for the caller's OAuth connection.
// If the token is within the refresh threshold, enqueues an oauth_refresh job (non-blocking).

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { userHandler } from '../_shared/edge-handler.ts';
import { serviceClient } from '../_shared/edge-client.ts';
import { HttpError } from '../_shared/http-error.ts';
import { enqueueJob } from '../_shared/jobs.ts';

const DEFAULT_REFRESH_THRESHOLD_MINUTES = 5;

serve(userHandler({
  name: 'oauth-get-token',
  errorCode: 'oauth_get_error',
  handler: async ({ userId, body }) => {
    const { provider } = body as { provider: string };

    if (!provider) throw new HttpError(400, 'provider is required');

    const key = Deno.env.get('OAUTH_ENCRYPTION_KEY');
    if (!key) throw new HttpError(503, 'OAUTH_ENCRYPTION_KEY not configured');

    const client = serviceClient();

    const { data: row, error: selectErr } = await client
      .from('oauth_connections')
      .select('access_token_encrypted, expires_at, scope')
      .eq('user_id', userId)
      .eq('provider', provider)
      .maybeSingle();

    if (selectErr) throw new HttpError(500, selectErr.message);
    if (!row) throw new HttpError(404, `No OAuth connection found for provider: ${provider}`);

    const thresholdMinutes =
      Number(Deno.env.get('OAUTH_REFRESH_THRESHOLD_MINUTES') ?? DEFAULT_REFRESH_THRESHOLD_MINUTES);

if (row.expires_at) {
      const expiresMs = new Date(row.expires_at).getTime();
      const thresholdMs = thresholdMinutes * 60 * 1000;
      if (expiresMs - Date.now() <= thresholdMs) {
        // Dedupe via partial unique index `idx_jobs_oauth_refresh_pending`
        // (see migration 010). Two concurrent enqueues for the same
        // (userId, provider) cannot both succeed — the loser raises a 23505
        // unique-violation which we coalesce silently.
        try {
          await enqueueJob({ kind: 'oauth_refresh', payload: { userId, provider } });
        } catch (e) {
          const code = (e as { code?: string } | null)?.code;
          if (code !== '23505') {
            // Non-dedupe failure: swallow but stay non-blocking on the token
            // hand-back. The next caller within the threshold will retry.
          }
        }
      }
    }

    const { data: plaintext, error: decErr } = await client.rpc('decrypt_oauth_token', {
      p_ciphertext: row.access_token_encrypted,
      p_key: key,
    });
    if (decErr) throw new HttpError(500, decErr.message);

    return {
      accessToken: plaintext as string,
      expiresAt: row.expires_at ?? null,
      scope: row.scope ?? null,
    };
  },
}));