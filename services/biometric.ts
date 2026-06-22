import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { gasConfig } from '../gas.config';
import { ServiceError } from './errors';

const LAST_BIOMETRIC_KEY = 'gas:lastBiometricAt';

export async function isBiometricAvailable(): Promise<boolean> {
  if (!gasConfig.features.auth.biometric.enabled) return false;
  if (Platform.OS === 'web') return false;
  const compatible = await LocalAuthentication.hasHardwareAsync();
  if (!compatible) return false;
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return enrolled;
}

export async function authenticate(reason = 'Authenticate to continue'): Promise<boolean> {
  if (!(await isBiometricAvailable())) {
    throw new ServiceError('biometric_unavailable', 400, 'Biometric authentication is not available');
  }
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    fallbackLabel: 'Use passcode',
  });
  if (result.success) {
    await SecureStore.setItemAsync(LAST_BIOMETRIC_KEY, String(Date.now()));
    return true;
  }
  return false;
}

export async function requiresReauth(): Promise<boolean> {
  if (!gasConfig.features.auth.biometric.enabled) return false;
  const last = await SecureStore.getItemAsync(LAST_BIOMETRIC_KEY);
  if (!last) return true;
  const lastMs = Number(last);
  if (!Number.isFinite(lastMs)) return true;
  const timeoutMs = gasConfig.features.auth.biometric.timeoutMinutes * 60_000;
  return Date.now() - lastMs > timeoutMs;
}