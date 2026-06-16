/**
 * GAS Template, Friendly auth error mapping
 *
 * Supabase auth surfaces raw backend strings (e.g. "Invalid login credentials")
 * that are confusing and occasionally leak implementation detail. Every auth
 * screen routes its caught errors through `friendlyAuthError` so the UI only
 * ever shows safe, human copy, never a raw backend message.
 */

/**
 * Map a caught auth error to friendly, user-facing copy.
 *
 * Accepts anything (Error, Supabase AuthError, string, unknown) and resolves
 * the underlying message defensively. Unknown errors fall back to a generic
 * retry message so we never surface a raw backend string.
 */
export function friendlyAuthError(err: unknown): string {
  const message =
    typeof err === 'string'
      ? err
      : err && typeof err === 'object' && 'message' in err
        ? String((err as { message?: unknown }).message ?? '')
        : '';

  const normalized = message.toLowerCase();

  if (normalized.includes('invalid login credentials')) {
    return 'Incorrect email or password.';
  }
  if (normalized.includes('email not confirmed')) {
    return 'Please verify your email first, check your inbox.';
  }

  return 'Something went wrong. Please try again.';
}

/**
 * True when the error is specifically an "email not confirmed" failure, so the
 * login screen can offer a "Resend verification email" action.
 */
export function isEmailNotConfirmed(err: unknown): boolean {
  const message =
    typeof err === 'string'
      ? err
      : err && typeof err === 'object' && 'message' in err
        ? String((err as { message?: unknown }).message ?? '')
        : '';
  return message.toLowerCase().includes('email not confirmed');
}
