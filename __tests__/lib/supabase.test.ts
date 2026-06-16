/**
 * Tests for lib/supabase.ts
 *
 * Since supabase.ts creates a client at module level, we mock
 * the createClient function and verify configuration.
 */

const mockClient = {
  auth: {
    onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    getSession: jest.fn(async () => ({ data: { session: null }, error: null })),
  },
  from: jest.fn(),
};
const mockCreateClient = jest.fn((..._args: any[]) => mockClient);

jest.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateClient,
}));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));
jest.mock('react-native-url-polyfill/auto', () => {});
jest.mock('../../lib/sentry', () => ({ addBreadcrumb: jest.fn() }));

import { supabase } from '../../lib/supabase';

describe('supabase client', () => {
  test('createClient is called with PKCE flow', () => {
    expect(mockCreateClient).toHaveBeenCalled();
    const config = (mockCreateClient.mock.calls[0] as any)?.[2];
    expect(config?.auth?.flowType).toBe('pkce');
  });

  test('createClient uses secure storage adapter', () => {
    const config = (mockCreateClient.mock.calls[0] as any)?.[2];
    expect(config?.auth?.storage).toBeDefined();
    expect(typeof config?.auth?.storage?.getItem).toBe('function');
    expect(typeof config?.auth?.storage?.setItem).toBe('function');
    expect(typeof config?.auth?.storage?.removeItem).toBe('function');
  });

  test('auto-refresh and persist session enabled', () => {
    const config = (mockCreateClient.mock.calls[0] as any)?.[2];
    expect(config?.auth?.autoRefreshToken).toBe(true);
    expect(config?.auth?.persistSession).toBe(true);
  });

  test('supabase client is exported', () => {
    expect(supabase).toBeDefined();
  });
});
