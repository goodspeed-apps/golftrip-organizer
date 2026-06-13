const makeStub = require('./_stub');

// In-app store review prompt is native-only; no-op on web.
module.exports = makeStub({
  isAvailableAsync: async () => false,
  hasAction: async () => false,
  requestReview: async () => {},
  storeUrl: () => null,
});
