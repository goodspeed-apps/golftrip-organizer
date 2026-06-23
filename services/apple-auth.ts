import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { captureException } from '../lib/sentry';
import { ServiceError } from './errors';
import { gasConfig } from '../gas.config';

export async function isAppleAuthAvailable(): Promise<boolean> {
  if (!gasConfig.features.auth.apple) return false;
  if (Platform.OS !== 'ios') return false;
  return AppleAuthentication.isAvailableAsync();
}

// Apple's docs require the raw nonce to be passed to signInAsync as a SHA-256
// hex digest, then the same raw value passed to Supabase as `nonce` for replay
// protection. The platform binds the issued identity token to that nonce.
async function generateNonce(): Promise<{ raw: string; hashed: string }> {
  const bytes = await Crypto.getRandomBytesAsync(32);
  const raw = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw);
  return { raw, hashed };
}

export async function signInWithApple(): Promise<{ userId: string; email: string | null }> {
  // Callers are expected to gate on isAppleAuthAvailable() before invoking
  // this. Re-running the isAvailableAsync round-trip here is wasted work; a
  // single platform check is enough as a defense-in-depth guard.
  if (Platform.OS !== 'ios') {
    throw new ServiceError('apple_auth_unavailable', 400, 'Sign-in with Apple is iOS-only');
  }
  try {
    const { raw: rawNonce, hashed: hashedNonce } = await generateNonce();
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
    if (!credential.identityToken) {
      throw new ServiceError('apple_auth_no_token', 401, 'Apple did not return an identity token');
    }
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce: rawNonce,
    });
    if (error || !data.user) {
      throw new ServiceError('apple_auth_supabase_failed', 401, error?.message ?? 'Sign-in failed');
    }
    return { userId: data.user.id, email: data.user.email ?? null };
  } catch (err) {
    captureException(err, { service: 'apple-auth' });
    throw err;
  }
}