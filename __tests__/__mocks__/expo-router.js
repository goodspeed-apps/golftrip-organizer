// Mock for expo-router
const noop = () => {};
module.exports = {
  router: {
    push: noop,
    replace: noop,
    back: noop,
    canGoBack: () => false,
    setParams: noop,
    navigate: noop,
  },
  useRouter: () => module.exports.router,
  useLocalSearchParams: () => ({}),
  useSegments: () => [],
  usePathname: () => '/',
  Link: 'Link',
  Stack: 'Stack',
  Tabs: 'Tabs',
  Slot: 'Slot',
  Redirect: () => null,
};
