/**
 * GAS Template, Minimum Version Check
 *
 * Calls the `check-min-version` edge function to determine if the current
 * client version meets the operator-defined minimum. Fail-open on any error
 * so transient network issues never lock users out.
 *
 * Dependencies: expo-application, lib/supabase, lib/sentry
 */

import { Platform } from 'react-native';
import * as Application from 'expo-application';
import { supabase } from './supabase';
import { addBreadcrumb } from './sentry';
import { retryWithBackoff, isTransientNon4xxError } from './retry';
import type { Platform as AppPlatform } from '../types/platform';

export interface MinVersionResult {
  mustUpdate: boolean;
  message?: string;
  recommendedVersion?: string;
}

/**
 * Checks whether the running client version satisfies the minimum version
 * requirement configured on the server. Returns `{ mustUpdate: false }` on
 * any error so transient failures do not block the user.
 */
export async function checkMinVersion(): Promise<MinVersionResult> {
  const platform: AppPlatform =
    Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web';

  const clientVersion = Application.nativeApplicationVersion ?? '0.0.0';

try {
    const { data, error } = await retryWithBackoff(
      async () => {
        const result = await supabase.functions.invoke('check-min-version', {
          body: { platform, clientVersion },
        });
        if (result.error) throw result.error;
        return result;
      },
      {
        maxRetries: 2,
        baseDelay: 500,
// Retry on network/timeout/5xx only. Skip 4xx/auth/RLS denials. See
        // lib/retry.ts → isTransientNon4xxError for the shared predicate.
        shouldRetry: isTransientNon4xxError,
      },
    );

    if (error) {
      addBreadcrumb('min-version', `Edge function error: ${String(error)}`);
      return { mustUpdate: false };
    }

    return {
      mustUpdate: !!data?.mustUpdate,
      message: data?.message,
      recommendedVersion: data?.recommendedVersion,
    };
} catch (err) {
    addBreadcrumb('min-version', `checkMinVersion failed: ${String(err)}`);
    return { mustUpdate: false };
  }
}