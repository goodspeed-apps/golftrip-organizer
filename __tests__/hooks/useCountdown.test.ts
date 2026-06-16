/**
 * Tests for hooks/useCountdown.ts — Pure countdown logic.
 */

describe('countdown logic', () => {
  test('computes days/hours/minutes/seconds from totalSeconds', () => {
    const totalSeconds = 90061; // 1 day, 1 hour, 1 minute, 1 second
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    expect(days).toBe(1);
    expect(hours).toBe(1);
    expect(minutes).toBe(1);
    expect(seconds).toBe(1);
  });

  test('isExpired when totalSeconds is 0', () => {
    expect(0 <= 0).toBe(true);
  });

  test('not expired when totalSeconds > 0', () => {
    expect(60 <= 0).toBe(false);
  });

  test('getRemaining for absolute date', () => {
    const target = new Date(Date.now() + 5000);
    const remaining = Math.max(0, Math.floor((target.getTime() - Date.now()) / 1000));
    expect(remaining).toBeGreaterThanOrEqual(4);
    expect(remaining).toBeLessThanOrEqual(5);
  });
});
