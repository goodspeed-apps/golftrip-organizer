jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  authenticateAsync: jest.fn(),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

jest.mock('../../gas.config', () => ({
  gasConfig: {
    features: {
      auth: {
        apple: true,
        biometric: { enabled: true, timeoutMinutes: 5 },
      },
    },
  },
}));

import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { isBiometricAvailable, authenticate, requiresReauth } from '../../services/biometric';

const mockHasHardware = LocalAuthentication.hasHardwareAsync as jest.Mock;
const mockIsEnrolled = LocalAuthentication.isEnrolledAsync as jest.Mock;
const mockAuthenticate = LocalAuthentication.authenticateAsync as jest.Mock;
const mockGetItem = SecureStore.getItemAsync as jest.Mock;
const mockSetItem = SecureStore.setItemAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  (Platform as { OS: string }).OS = 'ios';
});

describe('isBiometricAvailable()', () => {
  it('returns false when biometric.enabled is false', async () => {
    jest.resetModules();
    jest.doMock('../../gas.config', () => ({
      gasConfig: {
        features: { auth: { biometric: { enabled: false, timeoutMinutes: 5 } } },
      },
    }));
    const { isBiometricAvailable: fn } = await import('../../services/biometric');
    const result = await fn();
    expect(result).toBe(false);
  });

  it('returns false when no hardware present', async () => {
    mockHasHardware.mockResolvedValue(false);
    const result = await isBiometricAvailable();
    expect(result).toBe(false);
    expect(mockIsEnrolled).not.toHaveBeenCalled();
  });

  it('returns false when hardware present but nothing enrolled', async () => {
    mockHasHardware.mockResolvedValue(true);
    mockIsEnrolled.mockResolvedValue(false);
    const result = await isBiometricAvailable();
    expect(result).toBe(false);
  });

  it('returns true when hardware and enrollment both present', async () => {
    mockHasHardware.mockResolvedValue(true);
    mockIsEnrolled.mockResolvedValue(true);
    const result = await isBiometricAvailable();
    expect(result).toBe(true);
  });
});

describe('authenticate()', () => {
  it('writes timestamp to SecureStore on success', async () => {
    mockHasHardware.mockResolvedValue(true);
    mockIsEnrolled.mockResolvedValue(true);
    mockAuthenticate.mockResolvedValue({ success: true });
    mockSetItem.mockResolvedValue(undefined);

    const before = Date.now();
    const result = await authenticate();
    const after = Date.now();

    expect(result).toBe(true);
    expect(mockSetItem).toHaveBeenCalledTimes(1);
    const [key, value] = mockSetItem.mock.calls[0];
    expect(key).toBe('gas:lastBiometricAt');
    const ts = Number(value);
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it('returns false without writing SecureStore when auth fails', async () => {
    mockHasHardware.mockResolvedValue(true);
    mockIsEnrolled.mockResolvedValue(true);
    mockAuthenticate.mockResolvedValue({ success: false });

    const result = await authenticate();
    expect(result).toBe(false);
    expect(mockSetItem).not.toHaveBeenCalled();
  });
});

describe('requiresReauth()', () => {
  it('returns true when no SecureStore entry exists', async () => {
    mockGetItem.mockResolvedValue(null);
    const result = await requiresReauth();
    expect(result).toBe(true);
  });

  it('returns false when last auth is within the config timeout', async () => {
    const recentTs = String(Date.now() - 2 * 60_000); // 2 minutes ago
    mockGetItem.mockResolvedValue(recentTs);
    const result = await requiresReauth();
    expect(result).toBe(false);
  });

  it('returns true when last auth exceeds gasConfig timeout (5 min)', async () => {
    const oldTs = String(Date.now() - 6 * 60_000); // 6 minutes ago
    mockGetItem.mockResolvedValue(oldTs);
    const result = await requiresReauth();
    expect(result).toBe(true);
  });

  it('returns true when stored value is not a valid number', async () => {
    mockGetItem.mockResolvedValue('not-a-number');
    const result = await requiresReauth();
    expect(result).toBe(true);
  });
});