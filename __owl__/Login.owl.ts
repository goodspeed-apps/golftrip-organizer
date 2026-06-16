import { takeScreenshot, loadApp } from 'react-native-owl';

/**
 * Login screen visual regression test.
 *
 * TODO: Verify the navigation call matches your app's actual route.
 *       In Expo Router this is typically `/(auth)/login`.
 *       Update the navigation approach below after first run.
 */
describe('Login screen', () => {
  beforeAll(async () => {
    await loadApp();
  });

  it('renders the login screen', async () => {
    // TODO: Navigate to the login screen.
    // Example with Expo Router deep link:
    //   await device.openURL({ url: 'myapp://(auth)/login' });
    // Or tap a "Log in" button from the welcome screen:
    //   await element(by.id('welcome-login-button')).tap();

    // Wait for navigation and any transition animations to settle.
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await takeScreenshot('login');
  });
});
