/**
 * GAS Template — Platform type
 *
 * Shared platform union used by min-version checks and other client-side
 * platform-conditional logic. The Supabase edge function defines its own
 * copy (it cannot import from this path under Deno).
 */

export type Platform = 'ios' | 'android' | 'web';
