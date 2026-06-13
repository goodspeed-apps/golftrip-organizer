// supabase/functions/oauth-refresh/handler.ts
//
// Template stub for the oauth_refresh job kind.
//
// HOW TO CUSTOMIZE:
//   OAuth token refresh semantics differ per provider (grant_type, endpoint, token format).
//   This handler intentionally throws 501 so the operator cannot accidentally ship without
//   implementing real refresh logic.
//
//   Steps to implement:
//   1. Exchange the decrypted refreshToken with the provider's token endpoint.
//   2. Re-encrypt the new access (and optionally refresh) token via the RPCs.
//   3. UPDATE the oauth_connections row with the new encrypted values and expires_at.
//
// The handler signature matches the job-worker dispatcher contract:
//   (payload, signal?) => Promise<Record<string, unknown>>

import { serviceClient } from '../_shared/edge-client.ts';
import { HttpError } from '../_shared/http-error.ts';

export async function handleOauthRefresh(
  payload: Record<string, unknown>,
  _signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const { userId, provider } = payload as { userId: string; provider: string };

  if (!userId || !provider) {
    throw new HttpError(400, 'oauth_refresh: userId and provider are required in payload');
  }

const key = Deno.env.get('OAUTH_ENCRYPTION_KEY');
  if (!key) throw new HttpError(503, 'OAUTH_ENCRYPTION_KEY not configured');

  const client = serviceClient();

  const { data: row, error: selectErr } = await client
    .from('oauth_connections')
    .select('refresh_token_encrypted')
    .eq('user_id', userId)
    .eq('provider', provider)
    .maybeSingle();

  if (selectErr) throw new HttpError(500, selectErr.message);
  if (!row?.refresh_token_encrypted) {
    throw new HttpError(404, `oauth_refresh: no refresh token stored for ${provider}`);
  }

  const { data: refreshToken, error: decErr } = await client.rpc('decrypt_oauth_token', {
    p_ciphertext: row.refresh_token_encrypted,
    p_key: key,
  });
  if (decErr) throw new HttpError(500, decErr.message);

  // refreshToken is now available as a plaintext string.
  // Replace this error with your provider-specific token exchange:
  void refreshToken;
  throw new HttpError(501, 'oauth-refresh: implement per-provider refresh logic in this handler');
}