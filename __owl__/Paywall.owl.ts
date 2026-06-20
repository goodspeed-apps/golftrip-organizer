import { takeScreenshot, loadApp } from 'react-native-owl';

/**
 * Paywall screen visual regression test.
 *
 * TODO: Verify the navigation call matches your app's actual route.
 *       In Expo Router this is typically `/(app)/paywall` or `/(modals)/paywall`.
 *       Update the navigation approach below after first run.
 */
describe('Paywall screen', () => {
  beforeAll(async () => {
    await loadApp();
  });

  it('renders the paywall screen', async () => {
    // TODO: Navigate to the paywall screen.
    // Example with Expo Router deep link:
    //   await device.openURL({ url: 'myapp://paywall' });
    // Or trigger the paywall from within the app flow:
    //   await element(by.id('upgrade-button')).tap();

    // Wait for navigation and RevenueCat offerings to load.
    await new Promise((resolve) => setTimeout(resolve, 1500));

    await takeScreenshot('paywall');
  });
});