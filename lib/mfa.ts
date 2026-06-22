/**
 * GAS Template, MFA/TOTP Helpers
 *
 * Supabase-backed MFA enrollment, verification, and management.
 * All functions are no-ops on web or if gasConfig.features.auth.mfa is false.
 *
 * Dependencies: @supabase/supabase-js, lib/supabase, gas.config
 */

import { supabase } from './supabase';
import { isWeb } from './platform';
import { addBreadcrumb, captureException } from './sentry';
import { gasConfig } from '../gas.config';

const MFA_ENABLED = gasConfig.features.auth.mfa === true;

/**
 * Enroll the current user in TOTP-based MFA.
 * Returns the QR code URI and secret for display in a QR code viewer,
 * or null if MFA is disabled/on web.
 */
export async function enrollMFA(): Promise<{ id: string; uri: string; secret: string } | null> {
  if (isWeb || !MFA_ENABLED) return null;
  try {
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
    if (error) throw error;
    addBreadcrumb('auth', 'MFA enrolled', { factorId: data.id });
    return { id: data.id, uri: data.totp.uri, secret: data.totp.secret };
  } catch (e) {
    captureException(e, { component: 'mfa', action: 'enroll' });
    throw e;
  }
}

/**
 * Verify an MFA challenge with a TOTP code.
 * Call after the user enters their 6-digit authenticator code.
 */
export async function verifyMFA(factorId: string, code: string): Promise<boolean> {
  if (isWeb || !MFA_ENABLED) return false;
  try {
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeError) throw challengeError;

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });
    if (verifyError) throw verifyError;

    addBreadcrumb('auth', 'MFA verified', { factorId });
    return true;
  } catch (e) {
    captureException(e, { component: 'mfa', action: 'verify' });
    return false;
  }
}

/**
 * Remove an MFA factor (unenroll).
 */
export async function unenrollMFA(factorId: string): Promise<boolean> {
  if (isWeb || !MFA_ENABLED) return false;
  try {
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) throw error;
    addBreadcrumb('auth', 'MFA unenrolled', { factorId });
    return true;
  } catch (e) {
    captureException(e, { component: 'mfa', action: 'unenroll' });
    return false;
  }
}

/**
 * List all MFA factors for the current user.
 */
export async function listMFAFactors() {
  if (isWeb || !MFA_ENABLED) return [];
  try {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) throw error;
    return data.totp ?? [];
  } catch (e) {
    captureException(e, { component: 'mfa', action: 'listFactors' });
    return [];
  }
}

/**
 * Get the current Authenticator Assurance Level (AAL).
 * Returns { currentLevel, nextLevel } or null.
 * If currentLevel < nextLevel, the user needs to complete MFA verification.
 */
export async function getAAL() {
  if (isWeb || !MFA_ENABLED) return null;
  try {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) throw error;
    return data;
  } catch (e) {
    captureException(e, { component: 'mfa', action: 'getAAL' });
    return null;
  }
}
