// Native stub for the OPTIONAL dep `jail-monkey`.
//
// Generated apps sometimes import jail-monkey directly, but it is intentionally
// NOT declared as a dependency (it is treated as an optional native enhancement;
// lib/security.ts loads it via require()-in-try/catch and falls back to
// heuristics when absent). A bare unresolved import would otherwise fail Metro
// bundling on EAS. metro.config.js routes `jail-monkey` here ONLY when the real
// package isn't installed, so a deliberate integration still uses the real one.
//
// Every method returns the "not compromised" answer, matching the graceful
// fallback in lib/security.ts (which uses optional chaining anyway).
const JailMonkey = {
  isJailBroken: () => false,
  canMockLocation: () => false,
  trustFall: () => false,
  isOnExternalStorage: () => false,
  AdbEnabled: () => false,
  isDebuggedMode: () => Promise.resolve(false),
  hookDetected: () => false,
  isDevelopmentSettingsMode: () => Promise.resolve(false),
};

module.exports = JailMonkey;
module.exports.default = JailMonkey;
