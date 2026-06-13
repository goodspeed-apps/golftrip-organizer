/**
 * GAS Template, Stable hash utilities.
 *
 * fnv1a32 is used for deterministic bucketing across feature flags and
 * experiment assignments: same input always lands in the same bucket.
 */

export function fnv1a32(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Deterministic bucket assignment for a (userId, key) pair into [0, modulus).
 *
 * Used by feature-flag rollouts and experiment variant selection so that the
 * same (user, key) always lands in the same bucket. Anonymous users hash on
 * the literal "anon" prefix and still bucket deterministically per-key, 
 * fine for rollouts where consistency-across-mounts beats per-user uniqueness.
 *
 * @param userId  user id, or null/undefined for anonymous
 * @param key     stable identifier for the experiment / flag
 * @param modulus number of buckets (rollout 0..100, variants.length, etc.)
 */
export function assignBucket(
  userId: string | null | undefined,
  key: string,
  modulus: number,
): number {
  const id = userId ?? 'anon';
  return fnv1a32(`${id}:${key}`) % modulus;
}
