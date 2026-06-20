/**
 * Tests for lib/posthog.ts
 *
 * PostHog is null when apiKey is empty (template default).
 * All functions should be safe no-ops.
 */

const mockPostHog = jest.fn().mockImplementation(() => ({
  capture: jest.fn(),
  identify: jest.fn(),
  reset: jest.fn(),
  screen: jest.fn(),
}));
jest.mock('posthog-react-native', () => ({ default: mockPostHog, __esModule: true, PostHog: mockPostHog }));

import { posthog, captureEvent, identifyPostHogUser, resetPostHogUser } from '../../lib/posthog';

beforeEach(() => jest.clearAllMocks());

describe('posthog (disabled — no API key)', () => {
  test('posthog is null when API key is empty', () => {
    expect(posthog).toBeNull();
  });

  test('captureEvent is no-op when posthog is null', () => {
    expect(() => captureEvent('test_event', { foo: 'bar' })).not.toThrow();
  });

  test('identifyPostHogUser is no-op when posthog is null', () => {
    expect(() => identifyPostHogUser('user-1', { tier: 'pro' })).not.toThrow();
  });

  test('resetPostHogUser is no-op when posthog is null', () => {
    expect(() => resetPostHogUser()).not.toThrow();
  });
});
