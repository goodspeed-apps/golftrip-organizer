import { takeScreenshot, loadApp } from 'react-native-owl';

/**
 * Signup screen visual regression test.
 *
 * TODO: Verify the navigation call matches your app's actual route.
 *       In Expo Router this is typically `/(auth)/signup` or `/(auth)/register`.
 *       Update the navigation approach below after first run.
 */
describe('Signup screen', () => {
  beforeAll(async () => {
    await loadApp();
  });

  it('renders the signup screen', async () => {
    // Navigate to the signup screen.
    // Example with Expo Router deep link:
    //   await device.openURL({ url: 'myapp://(auth)/signup' }); // TODO: replace with real route
    // Or tap a "Sign up" button from the welcome screen:
    // await element(by.id('welcome-signup-button')).tap();

    // Wait for navigation and any transition animations to settle.
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await takeScreenshot('signup');
  });
});