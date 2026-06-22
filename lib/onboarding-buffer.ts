/**
 * GAS Template, Onboarding Answer Buffer
 *
 * Onboarding runs BEFORE the user has an account. The entry router
 * (app/index.tsx) sends a first-launch visitor straight to
 * app/(auth)/onboarding/welcome with NO Supabase session, and the final step
 * routes to /(auth)/signup. So onboarding screens cannot write to `profiles`:
 * RLS requires auth.uid() = id, which is null until the user signs up and (for
 * email signup) verifies their address.
 *
 * Instead, each onboarding step buffers its answers here. useAuth flushes the
 * buffer to `profiles` the moment a session first appears, after email
 * verification or an OAuth round-trip, then clears it. This is why onboarding
 * screens must never gate "Continue" on an authenticated user, and never write
 * to `profiles` or any user-scoped table themselves.
 */

import { getItem, setItem, removeItem } from './storage';
import { supabase } from './supabase';
import { addBreadcrumb } from './sentry';

const BUFFER_KEY = 'onboarding_answers';

/** Answers captured across onboarding steps, keyed by the schema field key. */
export type OnboardingAnswers = Record<string, unknown>;

/**
 * Merge a partial set of answers into the buffer. Call this on each onboarding
 * step's "Continue" with the fields that screen captured, later screens add
 * to (never replace) what earlier screens stored.
 */
export async function saveOnboardingAnswers(partial: OnboardingAnswers): Promise<void> {
  const existing = (await getItem<OnboardingAnswers>(BUFFER_KEY)) ?? {};
  await setItem(BUFFER_KEY, { ...existing, ...partial });
}

/** Read the buffered answers (null if nothing has been captured yet). */
export async function getOnboardingAnswers(): Promise<OnboardingAnswers | null> {
  return getItem<OnboardingAnswers>(BUFFER_KEY);
}

/** Discard buffered answers without persisting them. */
export async function clearOnboardingAnswers(): Promise<void> {
  await removeItem(BUFFER_KEY);
}

/**
 * Mark onboarding as finished. The entry router (app/index.tsx) reads this flag
 * to send future launches to /(auth)/login instead of back through onboarding.
 * Call this on the final onboarding step, right before routing to
 * /(auth)/signup. The stored 'true' matches the router's raw-string check.
 */
export async function markOnboardingComplete(): Promise<void> {
  await setItem('has_onboarded', true);
}

/**
 * Flush buffered onboarding answers to the user's `profiles` row, then clear
 * the buffer. No-op when the buffer is empty, so it is safe to call on every
 * session acquisition. On failure the buffer is preserved so a later session
 * (e.g. after the user retries) can flush it, this never throws.
 */
export async function flushOnboardingAnswers(userId: string): Promise<void> {
  try {
    const answers = await getItem<OnboardingAnswers>(BUFFER_KEY);
    if (!answers || Object.keys(answers).length === 0) return;

    const { error } = await supabase
      .from('profiles')
      .upsert({ id: userId, ...answers }, { onConflict: 'id' });

    if (error) {
      // Keep the buffer so a later session can retry the flush.
      addBreadcrumb('onboarding', 'Profile flush failed', { error: error.message });
      return;
    }
    await removeItem(BUFFER_KEY);
    addBreadcrumb('onboarding', 'Onboarding answers flushed to profile');
  } catch {
    addBreadcrumb('onboarding', 'Profile flush threw');
  }
}
