import { takeScreenshot, loadApp } from 'react-native-owl';

/**
 * Welcome screen visual regression test.
 *
 * TODO: Verify the route path matches your app's actual welcome screen.
 *       In Expo Router the entry point is typically `/(public)/welcome` or just `/`.
 *       Update the navigation call below after first run.
 */
describe('Welcome screen', () => {
  beforeAll(async () => {
    await loadApp();
  });

  it('renders the welcome screen', async () => {
    // TODO: Replace with the correct route for your welcome screen.
    // Example: await element(by.id('welcome-screen')).tap();
    // If the welcome screen is the app's initial route, no navigation is needed.

    // Wait for any launch animations to settle.
    await new Promise((resolve) => setTimeout(resolve, 1500));

    await takeScreenshot('welcome');
  });
});