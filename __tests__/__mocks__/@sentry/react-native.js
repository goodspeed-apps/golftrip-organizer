// Jest mock for @sentry/react-native. Wraps the shared no-op shims with
// jest.fn() so call assertions work, and keeps a few Sentry-specific shapes
// (Severity enum, withScope callback invocation) that go beyond pure no-ops.
const shim = require('../../../lib/__shims__/sentry-noop');

module.exports = {
  init: jest.fn(shim.noopInit),
  captureException: jest.fn(shim.noopCaptureException),
  captureMessage: jest.fn(shim.noopCaptureMessage),
  addBreadcrumb: jest.fn(shim.noopAddBreadcrumb),
  setUser: jest.fn(shim.noopSetUser),
  setTag: jest.fn(shim.noopSetTag),
  setContext: jest.fn(shim.noopSetContext),
  withScope: jest.fn((cb) => cb({ setExtra: jest.fn(), setContext: jest.fn(), setTag: jest.fn() })),
  wrap: jest.fn(shim.passthroughWrap),
  ReactNativeTracing: jest.fn(),
  ReactNavigationInstrumentation: jest.fn(),
  Severity: { Info: 'info', Warning: 'warning', Error: 'error', Fatal: 'fatal' },
  ErrorBoundary: 'Sentry.ErrorBoundary',
};
