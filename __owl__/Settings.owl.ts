import { takeScreenshot, loadApp } from 'react-native-owl';

/**
 * Settings screen visual regression test.
 *
 * TODO: Verify the navigation call matches your app's actual route.
 *       In Expo Router this is typically `/(app)/settings` or `/(tabs)/settings`.
 *       Update the navigation approach below after first run.
 */
describe('Settings screen', () => {
  beforeAll(async () => {
    await loadApp();
  });

  it('renders the settings screen', async () => {
    // TODO: Navigate to the settings screen.
    // This usually requires an authenticated session.
    // Example: tap the settings tab in a tab navigator:
    //   await element(by.id('tab-settings')).tap();
    // Or via deep link:
    //   await device.openURL({ url: 'myapp://settings' });

    // Wait for navigation and any data loads to settle.
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await takeScreenshot('settings');
  });
});
