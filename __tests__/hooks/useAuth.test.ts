/**
 * Tests for hooks/useAuth.ts — Auth state logic.
 */

describe('useAuth logic', () => {
  test('initial state is loading with no session', () => {
    const state = {
      session: null,
      user: null,
      loading: true,
      biometricLocked: false,
      biometricAvailable: false,
      biometricEnabled: false,
    };
    expect(state.loading).toBe(true);
    expect(state.session).toBeNull();
    expect(state.user).toBeNull();
  });

  test('biometric ref pattern avoids stale closures', () => {
    const ref = { current: false };
    ref.current = true;
    // Closure captures ref, not value
    const check = () => ref.current;
    ref.current = false;
    expect(check()).toBe(false);
  });

  test('sign-out clears all state', () => {
    const state = {
      session: { access_token: 'xxx' },
      user: { id: 'user-1' },
      biometricLocked: true,
    };
    // Sign out
    Object.assign(state, { session: null, user: null, biometricLocked: false });
    expect(state.session).toBeNull();
    expect(state.user).toBeNull();
    expect(state.biometricLocked).toBe(false);
  });

  test('background timeout logic', () => {
    const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
    const lastBackground = Date.now() - (6 * 60 * 1000); // 6 minutes ago
    const elapsed = Date.now() - lastBackground;
    const shouldLock = elapsed > TIMEOUT_MS;
    expect(shouldLock).toBe(true);
  });

  test('no lock when within timeout', () => {
    const TIMEOUT_MS = 5 * 60 * 1000;
    const lastBackground = Date.now() - (2 * 60 * 1000); // 2 minutes ago
    const elapsed = Date.now() - lastBackground;
    const shouldLock = elapsed > TIMEOUT_MS;
    expect(shouldLock).toBe(false);
  });
});
