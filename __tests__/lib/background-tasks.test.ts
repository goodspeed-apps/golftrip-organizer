/**
 * Tests for lib/background-tasks.ts
 */

jest.mock('../../lib/sentry', () => ({ captureException: jest.fn(), addBreadcrumb: jest.fn() }));

import { registerBackgroundFetch, unregisterBackgroundFetch } from '../../lib/background-tasks';

describe('registerBackgroundFetch', () => {
  test('no-op when deps not installed', async () => {
    await expect(registerBackgroundFetch('task', async () => {})).resolves.toBeUndefined();
  });
});

describe('unregisterBackgroundFetch', () => {
  test('no-op when deps not installed', async () => {
    await expect(unregisterBackgroundFetch('task')).resolves.toBeUndefined();
  });
});
