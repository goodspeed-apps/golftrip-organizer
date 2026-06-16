/**
 * Web stub factory for native-only modules.
 *
 * `expo export --platform web` (and its Node static prerender) has no native
 * runtime, so modules like expo-tracking-transparency / react-native-purchases
 * throw "Cannot find native module X" at import. metro.config.js redirects them
 * here for platform === 'web'. Native builds resolve the real modules.
 *
 * Each stub passes the members whose RETURN VALUES are consumed (so destructures
 * like `const { status } = await getTrackingPermissionsAsync()` don't throw).
 * Any other member access returns a safe no-op async function, so a missed
 * export can never crash the web bundle. Native features are simply inert on web.
 */
function makeStub(explicit) {
  const target = Object.assign({ __esModule: true }, explicit);
  const handler = {
    get(t, prop) {
      if (prop in t) return t[prop];
      // Never look thenable: `await <stub>` must not hang waiting on a fake then().
      if (prop === 'then' || prop === 'catch' || prop === 'finally') return undefined;
      if (prop === 'default') return proxy;
      if (typeof prop === 'symbol') return undefined;
      return () => Promise.resolve(undefined);
    },
  };
  const proxy = new Proxy(target, handler);
  return proxy;
}

module.exports = makeStub;
