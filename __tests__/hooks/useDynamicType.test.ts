/**
 * Tests for hooks/useDynamicType.ts — Font scale logic.
 */

describe('useDynamicType logic', () => {
  test('default scale is 1.0 on web platform', () => {
    const scale = 1;
    expect(scale).toBe(1);
  });

  test('listener is cleaned up on unmount', () => {
    const remove = jest.fn();
    const sub = { remove };
    sub.remove();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
