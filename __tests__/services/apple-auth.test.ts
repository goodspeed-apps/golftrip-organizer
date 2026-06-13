jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn(),
  signInAsync: jest.fn(),
  AppleAuthenticationScope: {
    FULL_NAME: 'FULL_NAME',
    EMAIL: 'EMAIL',
  },
}));

jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: jest.fn().mockResolvedValue(new Uint8Array(32).fill(0xab)),
  digestStringAsync: jest.fn().mockResolvedValue('hashed-nonce-deadbeef'),
  CryptoDigestAlgorithm: { SHA256: 'SHA256' },
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithIdToken: jest.fn(),
    },
  },
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

import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';
import { supabase } from '../../lib/supabase';
import { isAppleAuthAvailable, signInWithApple } from '../../services/apple-auth';
import { ServiceError } from '../../services/errors';

const mockIsAvailable = AppleAuthentication.isAvailableAsync as jest.Mock;
const mockSignIn = AppleAuthentication.signInAsync as jest.Mock;
const mockSupabaseSignIn = (supabase.auth.signInWithIdToken as jest.Mock);

beforeEach(() => {
  jest.clearAllMocks();
  (Platform as { OS: string }).OS = 'ios';
});

describe('isAppleAuthAvailable()', () => {
  it('returns false when gasConfig.features.auth.apple is false', async () => {
    jest.resetModules();
    jest.doMock('../../gas.config', () => ({
      gasConfig: {
        features: { auth: { apple: false, biometric: { enabled: true, timeoutMinutes: 5 } } },
      },
    }));
    const { isAppleAuthAvailable: fn } = await import('../../services/apple-auth');
    const result = await fn();
    expect(result).toBe(false);
  });

  it('returns false on non-iOS platform', async () => {
    (Platform as { OS: string }).OS = 'android';
    mockIsAvailable.mockResolvedValue(true);
    const result = await isAppleAuthAvailable();
    expect(result).toBe(false);
  });

  it('delegates to isAvailableAsync on iOS when apple is enabled', async () => {
    mockIsAvailable.mockResolvedValue(true);
    const result = await isAppleAuthAvailable();
    expect(mockIsAvailable).toHaveBeenCalled();
    expect(result).toBe(true);
  });
});

describe('signInWithApple()', () => {
it('calls supabase.auth.signInWithIdToken with the Apple identity token and raw nonce', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockSignIn.mockResolvedValue({ identityToken: 'test-token-123' });
    mockSupabaseSignIn.mockResolvedValue({
      data: { user: { id: 'user-abc', email: 'user@example.com' } },
      error: null,
    });

    const result = await signInWithApple();

    expect(mockSignIn).toHaveBeenCalledWith(expect.objectContaining({
      nonce: 'hashed-nonce-deadbeef',
    }));
    expect(mockSupabaseSignIn).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'apple',
      token: 'test-token-123',
      nonce: expect.any(String),
    }));
    expect(result).toEqual({ userId: 'user-abc', email: 'user@example.com' });
  });

  it('throws ServiceError when identityToken is missing', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockSignIn.mockResolvedValue({ identityToken: null });

    await expect(signInWithApple()).rejects.toMatchObject({
      code: 'apple_auth_no_token',
      status: 401,
    });
  });

  it('throws ServiceError when supabase returns an error', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockSignIn.mockResolvedValue({ identityToken: 'tok' });
    mockSupabaseSignIn.mockResolvedValue({
      data: { user: null },
      error: { message: 'invalid token' },
    });

    await expect(signInWithApple()).rejects.toMatchObject({
      code: 'apple_auth_supabase_failed',
      status: 401,
    });
  });
});