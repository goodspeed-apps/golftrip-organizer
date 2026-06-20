// supabase/functions/oauth-save-connection/index.ts
// Admin-gated endpoint called by oauth-callback handlers after completing a provider exchange.
// Encrypts access/refresh tokens via pgcrypto RPCs and upserts into oauth_connections.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { adminHandler } from '../_shared/edge-handler.ts';
import { serviceClient } from '../_shared/edge-client.ts';
import { HttpError } from '../_shared/http-error.ts';

serve(adminHandler({
  name: 'oauth-save-connection',
  errorCode: 'oauth_save_error',
  handler: async (body) => {
    const {
      userId,
      provider,
      accessToken,
      refreshToken,
      expiresAt,
      scope,
      metadata,
    } = body as {
      userId: string;
      provider: string;
      accessToken: string;
      refreshToken?: string;
      expiresAt?: string;
      scope?: string;
      metadata?: Record<string, unknown>;
    };

    if (!userId || !provider || !accessToken) {
      throw new HttpError(400, 'userId, provider, and accessToken are required');
    }

const key = Deno.env.get('OAUTH_ENCRYPTION_KEY');
    if (!key) throw new HttpError(503, 'OAUTH_ENCRYPTION_KEY not configured');

    const client = serviceClient();

    const { data: encAccess, error: encAccessErr } = await client.rpc('encrypt_oauth_token', {
      p_plaintext: accessToken,
      p_key: key,
    });
    if (encAccessErr) throw new HttpError(500, encAccessErr.message);

    let encRefresh: unknown = null;
    if (refreshToken) {
      const { data: encR, error: encRErr } = await client.rpc('encrypt_oauth_token', {
        p_plaintext: refreshToken,
        p_key: key,
      });
      if (encRErr) throw new HttpError(500, encRErr.message);
      encRefresh = encR;
    }

    const { error: upsertErr } = await client
      .from('oauth_connections')
      .upsert(
        {
          user_id: userId,
          provider,
          access_token_encrypted: encAccess,
          refresh_token_encrypted: encRefresh,
          expires_at: expiresAt ?? null,
          scope: scope ?? null,
          metadata: metadata ?? {},
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,provider' },
      );

    if (upsertErr) throw new HttpError(500, upsertErr.message);

    return { ok: true, provider };
  },
}));