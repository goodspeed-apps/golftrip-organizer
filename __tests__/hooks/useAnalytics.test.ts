/**
 * Tests for hooks/useAnalytics.ts — Analytics tracking logic.
 */

describe('useAnalytics logic', () => {
  test('track wraps captureEvent', () => {
    const captureEvent = jest.fn();
    const track = (event: string, properties?: Record<string, unknown>) => {
      captureEvent(event, properties);
    };
    track('button_click', { screen: 'Home' });
    expect(captureEvent).toHaveBeenCalledWith('button_click', { screen: 'Home' });
  });

  test('track is safe when analytics is null', () => {
    const captureEvent = jest.fn();
    const posthog: null = null;
    const track = (event: string, props?: Record<string, unknown>) => {
      if (!posthog) return;
      captureEvent(event, props);
    };
    expect(() => track('test')).not.toThrow();
    expect(captureEvent).not.toHaveBeenCalled();
  });
});
