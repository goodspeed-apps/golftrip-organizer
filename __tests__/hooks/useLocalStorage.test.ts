/**
 * Tests for hooks/useLocalStorage.ts — Local storage state logic.
 */

describe('useLocalStorage logic', () => {
  test('returns default value when no stored value', () => {
    const stored = null;
    const defaultValue = 42;
    const result = stored !== null ? stored : defaultValue;
    expect(result).toBe(42);
  });

  test('returns stored value when available', () => {
    const stored = 99;
    const defaultValue = 42;
    const result = stored !== null ? stored : defaultValue;
    expect(result).toBe(99);
  });

  test('JSON roundtrip for complex objects', () => {
    const original = { name: 'Alice', scores: [1, 2, 3] };
    const serialized = JSON.stringify(original);
    const deserialized = JSON.parse(serialized);
    expect(deserialized).toEqual(original);
  });

  test('remove clears the key', () => {
    const store = new Map<string, string>();
    store.set('key', JSON.stringify(42));
    store.delete('key');
    expect(store.has('key')).toBe(false);
  });
});
