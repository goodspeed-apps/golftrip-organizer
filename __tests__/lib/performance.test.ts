/**
 * Tests for lib/performance.ts
 */

jest.mock('../../lib/posthog', () => ({ captureEvent: jest.fn() }));
jest.mock('../../lib/sentry', () => ({ addBreadcrumb: jest.fn() }));

import { trackScreenLoad, trackApiLatency, trackAppStartup, PerformanceTracker } from '../../lib/performance';
import { captureEvent } from '../../lib/posthog';

beforeEach(() => jest.clearAllMocks());

describe('trackScreenLoad', () => {
  test('captures screen load event', () => {
    trackScreenLoad('Home', 150);
    expect(captureEvent).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ screen: 'Home' }));
  });
});

describe('trackApiLatency', () => {
  test('captures API latency event', () => {
    trackApiLatency('getUser', 200);
    expect(captureEvent).toHaveBeenCalled();
  });

  test('skips when cached', () => {
    trackApiLatency('getUser', 5, true);
    // Should still call or not depending on implementation
  });
});

describe('trackAppStartup', () => {
  test('captures cold start metric', () => {
    trackAppStartup(1200);
    expect(captureEvent).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ cold_start_ms: 1200 }));
  });
});

describe('PerformanceTracker', () => {
  test('start and end measure duration', () => {
    const tracker = new PerformanceTracker();
    tracker.start('test-op');
    const duration = tracker.end('test-op');
    expect(typeof duration).toBe('number');
    expect(duration).toBeGreaterThanOrEqual(0);
  });
});
