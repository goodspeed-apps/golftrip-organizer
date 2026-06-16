/**
 * GAS Template, Crypto & OAuth State Utilities
 *
 * UUID generation, hashing, and random-string helpers via expo-crypto.
 * Also exposes OAuth `state` parameter helpers that persist to secure store, 
 * see `generateAndStoreOAuthState` / `verifyAndClearOAuthState`.
 *
 * All randomness comes from `Crypto.getRandomBytesAsync`, never Math.random().
 */

import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

/** Generate a UUID v4. */
export function generateId(): string {
  return Crypto.randomUUID();
}

/** SHA-256 hash a string. Returns hex digest. */
export async function hashString(input: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input);
}

// Crockford-ish base32 minus visually ambiguous glyphs (I, L, O, 0, 1). The
// resulting alphabet is 31 chars, so we pull one extra byte than strictly
// needed and modulo into the alphabet, bias is bounded because 256 % 31 = 8,
// negligible for short referral codes.
const BASE32_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/**
 * Cryptographically random base32 string of the given length.
 * Uses expo-crypto getRandomBytesAsync, not Math.random().
 */
export async function randomBase32(length: number): Promise<string> {
  if (length <= 0) return '';
  const bytes = await Crypto.getRandomBytesAsync(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += BASE32_ALPHABET[bytes[i] % BASE32_ALPHABET.length];
  }
  return out;
}

/**
 * Cryptographically random base64url string sourced from `byteLength` random
 * bytes. Uses expo-crypto.getRandomBytesAsync, never Math.random().
 *
 * base64url = standard base64 with `+` -> `-`, `/` -> `_`, and `=` padding
 * stripped. URL-safe so the value can travel as a query param without escaping.
 */
export async function randomBase64Url(byteLength: number): Promise<string> {
  if (byteLength <= 0) return '';
  const bytes = await Crypto.getRandomBytesAsync(byteLength);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  // `btoa` is provided by React Native / Hermes globally; fall back to Buffer
  // (Node/Jest test envs) when it isn't.
  const b64 =
    typeof btoa === 'function'
      ? btoa(binary)
      : Buffer.from(bytes).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

// ---------------------------------------------------------------------------
// OAuth `state` parameter helpers
// ---------------------------------------------------------------------------
//
// The OAuth `state` value binds an authorization-code callback to the flow
// that started it. Verifying it on the callback prevents:
//   - Deep-link spoofing: a hostile app registering the same scheme cannot
//     produce a state value we generated and stored.
//   - Replay: a leaked code is useless without the matching state stored on
//     this device, and we clear the state after every verify (match or not).
//
// Storage: `expo-secure-store` (device keychain/keystore), keyed as
// `oauth_state`. One state at a time, initiating a new flow overwrites any
// previous in-flight value.

const OAUTH_STATE_KEY = 'oauth_state';
const OAUTH_STATE_BYTE_LENGTH = 32;

/**
 * Generate a fresh cryptographically random OAuth state, persist it to secure
 * store, and return it for the caller to attach to the provider URL.
 */
export async function generateAndStoreOAuthState(): Promise<string> {
  const state = await randomBase64Url(OAUTH_STATE_BYTE_LENGTH);
  await SecureStore.setItemAsync(OAUTH_STATE_KEY, state);
  return state;
}

/** Read the stored OAuth state without clearing it. Returns `null` if absent. */
export async function getStoredOAuthState(): Promise<string | null> {
  return SecureStore.getItemAsync(OAUTH_STATE_KEY);
}

/** Delete any stored OAuth state. Safe to call when nothing is stored. */
export async function clearOAuthState(): Promise<void> {
  await SecureStore.deleteItemAsync(OAUTH_STATE_KEY);
}

/**
 * Compare a received state value against the one stored in secure store. The
 * stored value is cleared on every call, match or no, so a leaked code can
 * never be replayed against a stale state.
 *
 * Returns `true` only if both values are non-empty strings and equal.
 */
export async function verifyAndClearOAuthState(
  received: string | null | undefined,
): Promise<boolean> {
  const stored = await getStoredOAuthState();
  await clearOAuthState();
  if (!stored || !received) return false;
  if (typeof received !== 'string') return false;
  return stored === received;
}
