/**
 * GAS Template, useAnonymousMigration Hook
 *
 * Provides UI state for upgrading an anonymous session to a permanent account.
 *
 * Usage:
 *   const { upgrade, isLoading, error, conflict } = useAnonymousMigration();
 *   await upgrade({ email, password });
 *   // or
 *   await upgrade({ provider: 'apple', idToken, nonce });
 *
 * conflict is set when the target email/identity is already bound to another
 * account. Prompt the user to sign in with that account instead.
 */

import { useState, useCallback } from 'react';
import {
  upgradeAnonymousAccount,
  type UpgradeCredentials,
  type UpgradeResult,
} from '../services/auth';

export interface AnonymousMigrationState {
  /** Trigger the upgrade. Returns the result or null on unrecoverable error. */
  upgrade: (credentials: UpgradeCredentials) => Promise<UpgradeResult | null>;
  /** True while the upgrade is in progress. */
  isLoading: boolean;
  /** Human-readable error message, or null if no error. */
  error: string | null;
  /** Set when the target email/identity is already taken by another account.
   *  `email` is the user-supplied email, or null for OAuth conflicts.
   *  `oauthMarker` is present for OAuth provider conflicts (e.g. "apple:linked_to_other_account"). */
  conflict: { email: string | null; oauthMarker?: string } | null;
}

export function useAnonymousMigration(): AnonymousMigrationState {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ email: string | null; oauthMarker?: string } | null>(null);

  const upgrade = useCallback(
    async (credentials: UpgradeCredentials): Promise<UpgradeResult | null> => {
      setIsLoading(true);
      setError(null);
      setConflict(null);

      try {
        const result = await upgradeAnonymousAccount(credentials);

        if (result.conflictWith) {
          // conflictWith may be an email or an OAuth marker like "apple:linked_to_other_account"
          const isOAuth = result.conflictWith.includes(':');
          if (isOAuth) {
            setConflict({ email: null, oauthMarker: result.conflictWith });
          } else {
            const conflictEmail = 'email' in credentials ? credentials.email : result.conflictWith;
            setConflict({ email: conflictEmail });
          }
          return result;
        }

        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  return { upgrade, isLoading, error, conflict };
}