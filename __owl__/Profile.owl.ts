import { takeScreenshot, loadApp } from 'react-native-owl';

/**
 * Profile screen visual regression test.
 *
 * TODO: Verify the navigation call matches your app's actual route.
 *       In Expo Router this is typically `/(app)/profile` or `/(tabs)/profile`.
 *       Update the navigation approach below after first run.
 */
describe('Profile screen', () => {
  beforeAll(async () => {
    await loadApp();
  });

  it('renders the profile screen', async () => {
    // TODO: Navigate to the profile screen.
    // This usually requires an authenticated session.
    // Example: tap the profile tab in a tab navigator:
    //   await element(by.id('tab-profile')).tap();
    // Or via deep link:
    //   await device.openURL({ url: 'myapp://profile' });

    // Wait for navigation and any data loads to settle.
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await takeScreenshot('profile');
  });
});
