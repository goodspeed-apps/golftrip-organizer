import { takeScreenshot, loadApp } from 'react-native-owl';

/**
 * Onboarding flow visual regression tests.
 *
 * Snapshots each step of the onboarding flow. Adjust the number of steps
 * and navigation actions to match your app's actual onboarding screens.
 *
 * TODO: Verify the navigation approach and step count for your app.
 *       In Expo Router this is typically `/(onboarding)/step-1` etc., or a
 *       single screen that advances via internal state.
 *       Update the step navigation calls below after first run.
 */

// These globals are provided by the react-native-owl / test runner at runtime.
declare const device: { openURL(opts: { url: string }): Promise<void> };
declare function element(matcher: unknown): { tap(): Promise<void> };
declare const by: { id(id: string): unknown };

describe('Onboarding flow', () => {
  beforeAll(async () => {
    await loadApp();
  });

  it('renders onboarding step 1', async () => {
    // Navigate to the onboarding flow.
    // Example with Expo Router deep link:
    await device.openURL({ url: 'myapp://onboarding' });

    // Wait for any animations to settle.
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await takeScreenshot('onboarding-step-1');
  });

  it('renders onboarding step 2', async () => {
    // Advance to step 2.
    await element(by.id('onboarding-next-button')).tap();

    await new Promise((resolve) => setTimeout(resolve, 500));

    await takeScreenshot('onboarding-step-2');
  });

  it('renders onboarding step 3', async () => {
    // Advance to step 3.
    await element(by.id('onboarding-next-button')).tap();

    await new Promise((resolve) => setTimeout(resolve, 500));

    await takeScreenshot('onboarding-step-3');
  });

  it('renders onboarding step 4 (final / permissions)', async () => {
    // Advance to the final step.
    // This is often a permissions prompt or summary screen.
    await element(by.id('onboarding-next-button')).tap();

    await new Promise((resolve) => setTimeout(resolve, 500));

    await takeScreenshot('onboarding-step-4');
  });
});
