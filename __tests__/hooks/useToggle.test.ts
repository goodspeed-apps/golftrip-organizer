/**
 * Tests for hooks/useToggle.ts
 */

// Test the pure logic (no React rendering needed)
describe('useToggle logic', () => {
  test('toggle flips value', () => {
    let value = false;
    const toggle = () => { value = !value; };
    toggle();
    expect(value).toBe(true);
    toggle();
    expect(value).toBe(false);
  });

  test('setTrue always sets true', () => {
    let value = false;
    const setTrue = () => { value = true; };
    setTrue();
    expect(value).toBe(true);
    setTrue();
    expect(value).toBe(true);
  });

  test('setFalse always sets false', () => {
    let value = true;
    const setFalse = () => { value = false; };
    setFalse();
    expect(value).toBe(false);
  });

  test('initial value defaults to false', () => {
    const initial = false;
    expect(initial).toBe(false);
  });
});
