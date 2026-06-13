/**
 * Tests for lib/sentry.ts
 *
 * Since sentry.ts reads isEnabled at module load, we test with gasConfig
 * as-is (crashReporting: true but DSN empty = disabled).
 * We test the exported functions' guard behavior.
 */

const mockSentry = {
  init: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  addBreadcrumb: jest.fn(),
  setUser: jest.fn(),
  setTag: jest.fn(),
  withScope: jest.fn((cb: any) => cb({ setExtra: jest.fn() })),
  ErrorBoundary: 'ErrorBoundary',
};
jest.mock('@sentry/react-native', () => mockSentry);

import { captureException, captureMessage, setUser, clearUser, addBreadcrumb, initSentry, SentryErrorBoundary } from '../../lib/sentry';

beforeEach(() => jest.clearAllMocks());

describe('sentry (disabled — no DSN)', () => {
  test('captureException is no-op when disabled', () => {
    captureException(new Error('test'));
    // Since DSN is empty in template, Sentry is disabled — no calls
    expect(mockSentry.captureException).not.toHaveBeenCalled();
  });

  test('captureMessage is no-op when disabled', () => {
    captureMessage('test message');
    expect(mockSentry.captureMessage).not.toHaveBeenCalled();
  });

  test('setUser is no-op when disabled', () => {
    setUser('user-1', 'test@example.com', 'pro');
    expect(mockSentry.setUser).not.toHaveBeenCalled();
  });

  test('clearUser is no-op when disabled', () => {
    clearUser();
    expect(mockSentry.setUser).not.toHaveBeenCalled();
  });

  test('addBreadcrumb is no-op when disabled', () => {
    addBreadcrumb('ui', 'button pressed', { button: 'save' });
    expect(mockSentry.addBreadcrumb).not.toHaveBeenCalled();
  });

  test('initSentry does not throw', () => {
    expect(() => initSentry()).not.toThrow();
  });

  test('SentryErrorBoundary is null when disabled', () => {
    expect(SentryErrorBoundary).toBeNull();
  });

  test('init not called when DSN is empty', () => {
    expect(mockSentry.init).not.toHaveBeenCalled();
  });
});
