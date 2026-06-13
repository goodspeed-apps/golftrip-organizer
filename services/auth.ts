/**
 * GAS Template, Auth Service
 *
 * Wraps Supabase auth operations with retry, error normalization, and Sentry reporting.
 *
 * Includes:
 *   - signInAnonymously: create anonymous session
 *   - upgradeAnonymousAccount: migrate anon user to permanent account (email/password or OAuth)
 */

import { supabase } from '../lib/supabase';
import { captureException } from '../lib/sentry';
import { retryWithBackoff, isTransientNon4xxError } from '../lib/retry';
import { ServiceError } from './errors';
import { gasConfig } from '../gas.config';
import { callEdge } from './api';

// ─── signInAnonymously ────────────────────────────────────────────────────────

/**
 * Create an anonymous Supabase session.
 * Returns the new anonymous userId on success.
 * Throws ServiceError('anon_signin_failed', 500, ...) on failure.
 */
export async function signInAnonymously(): Promise<{ userId: string }> {
  return retryWithBackoff(
    async () => {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error || !data.user) {
        const msg = error?.message ?? 'Anonymous sign-in failed';
        const svcErr = new ServiceError('anon_signin_failed', 500, msg);
        captureException(svcErr, { service: 'auth' });
        throw svcErr;
      }
      return { userId: data.user.id };
    },
    { shouldRetry: isTransientNon4xxError },
  );
}

// ─── upgradeAnonymousAccount ──────────────────────────────────────────────────

export type UpgradeCredentials =
  | { email: string; password: string }
  | { provider: 'apple' | 'google'; idToken: string; nonce?: string };

export interface UpgradeResult {
  migrated: number;
  conflictWith?: string;
  perTableRowcounts: Record<string, number>;
}

/**
 * Upgrade the current anonymous session to a permanent account.
 *
 * For email/password: calls supabase.auth.updateUser; catches email-already-exists
 * conflict and returns { migrated: 0, conflictWith: email }.
 *
 * For OAuth: calls supabase.auth.linkIdentity; returns conflictWith if the
 * identity is already bound to another account.
 *
 * On successful upgrade: invokes the migrate_anonymous_data edge function to
 * relocate rows from the anonymous user to the permanent user across the
 * operator-configured table list.
 */
export async function upgradeAnonymousAccount(
  credentials: UpgradeCredentials,
): Promise<UpgradeResult> {
  // ── 1. Verify current user is anonymous (outside retry, runs once) ──
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new ServiceError('not_authenticated', 401, 'No authenticated user found');
  }
  const currentUser = userData.user;
  if (!currentUser.is_anonymous) {
    throw new ServiceError(
      'not_anonymous',
      400,
      'Current user is not an anonymous account',
    );
  }
  const anonUserId = currentUser.id;

  return retryWithBackoff(
    async () => {
      // ── 2. Upgrade path ───────────────────────────────────────────────
      let permanentUserId: string;

      if ('email' in credentials) {
        // Email/password path
        const { data: updateData, error: updateError } = await supabase.auth.updateUser({
          email: credentials.email,
          password: credentials.password,
        });

        if (updateError) {
          const msg = updateError.message ?? '';
          const lmsg = msg.toLowerCase();
          if (
            lmsg.includes('already') ||
            lmsg.includes('email exists') ||
            (updateError as { code?: string }).code === 'email_exists' ||
            (updateError as { code?: string }).code === 'user_already_exists' ||
            (updateError as { status?: number }).status === 422
          ) {
            return { migrated: 0, conflictWith: credentials.email, perTableRowcounts: {} };
          }
          const svcErr = new ServiceError('upgrade_failed', 500, msg || 'Account upgrade failed');
          captureException(svcErr, { service: 'auth' });
          throw svcErr;
        }

        if (!updateData.user) {
          const svcErr = new ServiceError('upgrade_failed', 500, 'No user returned after upgrade');
          captureException(svcErr, { service: 'auth' });
          throw svcErr;
        }
        permanentUserId = updateData.user.id;
      } else {
        // OAuth path via linkIdentity
        const linkResult = await (supabase.auth as unknown as {
          linkIdentity: (opts: {
            provider: string;
            options?: { idToken?: string; nonce?: string };
          }) => Promise<{
            data: { user?: { id: string } | null };
            error: { message?: string; code?: string; status?: number } | null;
          }>;
        }).linkIdentity({
          provider: credentials.provider,
          options: {
            idToken: credentials.idToken,
            nonce: credentials.nonce,
          },
        });

        if (linkResult.error) {
          const msg = linkResult.error.message ?? '';
          const lmsg = msg.toLowerCase();
          if (
            lmsg.includes('already') ||
            lmsg.includes('identity') ||
            linkResult.error.code === 'identity_already_exists' ||
            linkResult.error.code === 'provider_already_linked'
          ) {
            return {
              migrated: 0,
              conflictWith: `${credentials.provider}:linked_to_other_account`,
              perTableRowcounts: {},
            };
          }
          const svcErr = new ServiceError('oauth_link_failed', 500, msg || 'OAuth link failed');
          captureException(svcErr, { service: 'auth' });
          throw svcErr;
        }

        if (!linkResult.data?.user?.id) {
          const svcErr = new ServiceError('oauth_link_failed', 500, 'No user returned after OAuth link');
          captureException(svcErr, { service: 'auth' });
          throw svcErr;
        }
        permanentUserId = linkResult.data.user.id;
      }

      // ── 3. Call migrate_anonymous_data edge function ──────────────────
      const tables = gasConfig.features.anonymousAuth?.tables ?? [];

      type MigrateResponse = { status: string; table_rowcounts: Record<string, number> };
      const migrateBody = await callEdge<MigrateResponse>('migrate_anonymous_data', {
        anonUserId,
        permanentUserId,
        tables,
      });

      const perTableRowcounts = migrateBody.table_rowcounts ?? {};
      const migrated = Object.values(perTableRowcounts).reduce((sum, n) => sum + n, 0);

      return { migrated, perTableRowcounts };
    },
    { shouldRetry: isTransientNon4xxError },
  );
}