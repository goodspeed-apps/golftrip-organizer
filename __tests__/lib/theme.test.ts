/**
 * Tests for lib/theme.ts
 */

import { Colors, Spacing, BorderRadius } from '../../lib/theme';

describe('Colors', () => {
  test('has light mode colors', () => {
    expect(Colors.light.background).toBeDefined();
    expect(Colors.light.text).toBeDefined();
    expect(Colors.light.surface).toBeDefined();
    expect(Colors.light.border).toBeDefined();
  });

  test('has dark mode colors', () => {
    expect(Colors.dark.background).toBeDefined();
    expect(Colors.dark.text).toBeDefined();
    expect(Colors.dark.surface).toBeDefined();
    expect(Colors.dark.border).toBeDefined();
  });

  test('has primary color', () => {
    expect(Colors.primary).toBeDefined();
    expect(typeof Colors.primary).toBe('string');
  });

  test('light and dark have different backgrounds', () => {
    expect(Colors.light.background).not.toBe(Colors.dark.background);
  });
});

describe('Spacing', () => {
  test('has all scale keys', () => {
    expect(Spacing.xs).toBeDefined();
    expect(Spacing.sm).toBeDefined();
    expect(Spacing.md).toBeDefined();
    expect(Spacing.base).toBeDefined();
    expect(Spacing.lg).toBeDefined();
    expect(Spacing.xl).toBeDefined();
  });

  test('values are numbers in ascending order', () => {
    expect(Spacing.xs).toBeLessThan(Spacing.sm);
    expect(Spacing.sm).toBeLessThan(Spacing.md);
    expect(Spacing.md).toBeLessThan(Spacing.base);
    expect(Spacing.base).toBeLessThan(Spacing.lg);
  });
});

describe('BorderRadius', () => {
  test('has all scale keys', () => {
    expect(BorderRadius.sm).toBeDefined();
    expect(BorderRadius.md).toBeDefined();
    expect(BorderRadius.lg).toBeDefined();
    expect(BorderRadius.xl).toBeDefined();
    expect(BorderRadius.full).toBeDefined();
  });

  test('values are numbers', () => {
    expect(typeof BorderRadius.sm).toBe('number');
    expect(typeof BorderRadius.full).toBe('number');
  });
});
