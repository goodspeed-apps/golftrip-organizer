const makeStub = require('./_stub');

// @sentry/react-native is a NATIVE-only module: pulling it into the `expo export
// --platform web` bundle (and its Node static prerender) breaks module evaluation,
// which left `lib/sentry`'s exports (e.g. initSentry) undefined and white-screened
// every route. metro.config.js redirects it here for platform === 'web'; native
// (ios/android) builds resolve the real module and crash reporting works normally.
//
// Inert no-ops for the API surface lib/sentry.ts uses. ErrorBoundary must be a real
// passthrough component (it is rendered when crash reporting is enabled); withScope
// must still invoke its callback so caller code runs. Any other access falls through
// to makeStub's no-op proxy, so a missed member can never crash the web bundle.
const scope = { setTag() {}, setExtra() {}, setContext() {}, setLevel() {}, setUser() {} };

module.exports = makeStub({
  init: () => {},
  withScope: (cb) => { try { if (typeof cb === 'function') cb(scope); } catch { /* inert on web */ } },
  captureException: () => undefined,
  captureMessage: () => undefined,
  setUser: () => {},
  setTag: () => {},
  setExtra: () => {},
  setContext: () => {},
  addBreadcrumb: () => {},
  ErrorBoundary: ({ children }) => children,
});
