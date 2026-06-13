/**
 * GAS Template, OAuth Connection Service
 *
 * Client surface for the user's encrypted OAuth tokens:
 *   - getActiveAccessToken(provider): fetch a plaintext token via the
 *     `oauth-get-token` edge function (auto-enqueues an `oauth_refresh` job
 *     when the token is within the refresh-threshold window).
 *   - listConnections(): list the caller's connected providers + metadata.
 *   - disconnectProvider(provider): delete a connection row.
 *
 * Connection persistence is NOT exposed here. New connections are written by
 * per-provider `oauth-callback-*` edge functions that call the admin-gated
 * `oauth-save-connection` edge function server-to-server with CRON_SECRET (Bearer).
 * CRON_SECRET MUST NOT ship in the mobile bundle, there is no client-side
 * equivalent of saveConnection.
 *
 * Dependencies: @supabase/supabase-js
 */

import { supabase } from '../lib/supabase';
import { retryWithBackoff, isTransientNon4xxError } from '../lib/retry';
import { gasConfig } from '../gas.config';

// ─── Types ─────────────────────────────────────────────────────────────────

/**
 * Provider identifier. Narrowed to the providers configured in
 * gasConfig.integrations.oauthProviders, but kept open via `| string` so
 * runtime values not yet in config still type-check.
 */
export type OAuthProvider =
  | (typeof gasConfig)['integrations']['oauthProviders'][number]['provider']
  | string;

export interface OAuthConnection {
  provider: OAuthProvider;
  expiresAt: string | null;
  scope: string | null;
  hasRefreshToken: boolean;
}

const shouldRetryOAuthCall = isTransientNon4xxError;

// ─── getActiveAccessToken ───────────────────────────────────────────────────────

export async function getActiveAccessToken(provider: OAuthProvider): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/oauth-get-token`;

  return retryWithBackoff(async () => {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ provider }),
    });

    if (resp.status === 404) return null;

    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      throw new Error((body as { error?: string }).error ?? `oauth-get-token failed: ${resp.status}`);
    }

    const data = await resp.json() as { accessToken: string };
    return data.accessToken;
  }, { maxRetries: 2, baseDelay: 500, shouldRetry: shouldRetryOAuthCall });
}

// ─── listConnections ────────────────────────────────────────────────────────────

export async function listConnections(): Promise<OAuthConnection[]> {
  const { data, error } = await supabase
    .from('oauth_connections')
    .select('provider, expires_at, scope, refresh_token_encrypted');

  if (error) throw new Error(error.message);

  return ((data ?? []) as Array<{
    provider: string;
    expires_at: string | null;
    scope: string | null;
    refresh_token_encrypted: unknown | null;
  }>).map((row) => ({
    provider: row.provider,
    expiresAt: row.expires_at,
    scope: row.scope,
    hasRefreshToken: row.refresh_token_encrypted !== null,
  }));
}

// ─── disconnectProvider ─────────────────────────────────────────────────────────

export async function disconnectProvider(provider: OAuthProvider): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  await retryWithBackoff(async () => {
    const { error } = await supabase
      .from('oauth_connections')
      .delete()
      .eq('user_id', user.id)
      .eq('provider', provider);

    if (error) throw new Error(error.message);
  }, { maxRetries: 2, baseDelay: 500, shouldRetry: shouldRetryOAuthCall });
}