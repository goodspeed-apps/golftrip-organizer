const makeStub = require('./_stub');

// RevenueCat in-app purchases are native-only; on web the user has no entitlements.
const customerInfo = {
  entitlements: { active: {}, all: {} },
  activeSubscriptions: [],
  allPurchasedProductIdentifiers: [],
  nonSubscriptionTransactions: [],
  latestExpirationDate: null,
  firstSeen: null,
  originalAppUserId: 'web-stub',
  requestDate: null,
  originalApplicationVersion: null,
  originalPurchaseDate: null,
  managementURL: null,
};

const Purchases = {
  configure: () => {},
  setLogLevel: () => {},
  getCustomerInfo: async () => customerInfo,
  getOfferings: async () => ({ current: null, all: {} }),
  getProducts: async () => [],
  purchaseStoreProduct: async () => ({ customerInfo, productIdentifier: '' }),
  purchasePackage: async () => ({ customerInfo, productIdentifier: '' }),
  restorePurchases: async () => customerInfo,
  addCustomerInfoUpdateListener: () => {},
  removeCustomerInfoUpdateListener: () => {},
  logIn: async () => ({ customerInfo, created: false }),
  logOut: async () => customerInfo,
  setAttributes: () => {},
  isConfigured: async () => false,
  syncPurchases: async () => customerInfo,
};

module.exports = makeStub({
  ...Purchases,
  default: Purchases,
  LOG_LEVEL: { VERBOSE: 'VERBOSE', DEBUG: 'DEBUG', INFO: 'INFO', WARN: 'WARN', ERROR: 'ERROR' },
  PURCHASE_TYPE: { SUBS: 'subs', INAPP: 'inapp' },
  PURCHASES_ERROR_CODE: {},
});
