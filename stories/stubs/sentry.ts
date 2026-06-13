// Storybook stub for @sentry/react-native. Re-exports shared no-op shims so
// the same surface is used by both jest mocks and Storybook (one source of
// truth — see lib/__shims__/sentry-noop.ts).

import {
  noopInit,
  noopCaptureException,
  noopCaptureMessage,
  noopSetUser,
  noopAddBreadcrumb,
  noopSetTag,
  noopSetExtra,
  noopSetContext,
  noopConfigureScope,
  noopWithScope,
  noopGetCurrentHub,
  noopStartTransaction,
  passthroughWrap,
  ErrorBoundary as NoopErrorBoundary,
} from '../../lib/__shims__/sentry-noop';

export const init = noopInit;
export const captureException = noopCaptureException;
export const captureMessage = noopCaptureMessage;
export const setUser = noopSetUser;
export const addBreadcrumb = noopAddBreadcrumb;
export const withScope = noopWithScope;
export const configureScope = noopConfigureScope;
export const setTag = noopSetTag;
export const setExtra = noopSetExtra;
export const setContext = noopSetContext;
export const startTransaction = noopStartTransaction;
export const getCurrentHub = noopGetCurrentHub;
export const wrap = passthroughWrap;
export const ErrorBoundary = NoopErrorBoundary;
export const SentryErrorBoundary = NoopErrorBoundary;
export type SeverityLevel = 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug';
export const Severity = {
  Fatal: 'fatal',
  Error: 'error',
  Warning: 'warning',
  Log: 'log',
  Info: 'info',
  Debug: 'debug',
} as const;
export default { init, captureException, captureMessage, setUser, addBreadcrumb, ErrorBoundary: NoopErrorBoundary };
