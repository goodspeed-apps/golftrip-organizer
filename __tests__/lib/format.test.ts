/**
 * Tests for lib/format.ts — Pure formatting utilities.
 */

import { formatNumber, formatCurrency, formatDate, formatFileSize, formatDuration, pluralize } from '../../lib/format';

describe('formatNumber', () => {
  test('formats with locale grouping', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
  });
  test('compact notation for large numbers', () => {
    const result = formatNumber(1500, { compact: true });
    expect(result).toMatch(/1\.5K/);
  });
  test('no compact for small numbers', () => {
    expect(formatNumber(500, { compact: true })).toBe('500');
  });
  test('handles zero', () => {
    expect(formatNumber(0)).toBe('0');
  });
  test('handles negative', () => {
    expect(formatNumber(-42)).toBe('-42');
  });
});

describe('formatCurrency', () => {
  test('formats USD by default', () => {
    expect(formatCurrency(9.99)).toMatch(/\$9\.99/);
  });
  test('formats EUR', () => {
    const result = formatCurrency(19.99, 'EUR');
    expect(result).toContain('19.99');
  });
});

describe('formatDate', () => {
  test('relative — just now', () => {
    expect(formatDate(new Date())).toBe('just now');
  });
  test('relative — minutes ago', () => {
    const d = new Date(Date.now() - 5 * 60 * 1000);
    expect(formatDate(d)).toBe('5m ago');
  });
  test('relative — hours ago', () => {
    const d = new Date(Date.now() - 3 * 3600 * 1000);
    expect(formatDate(d)).toBe('3h ago');
  });
  test('relative — days ago', () => {
    const d = new Date(Date.now() - 2 * 86400 * 1000);
    expect(formatDate(d)).toBe('2d ago');
  });
  test('absolute format', () => {
    const d = new Date('2024-03-15T12:00:00Z');
    const result = formatDate(d, 'absolute');
    expect(result).toMatch(/Mar 1[45]/); // timezone-dependent
  });
  test('accepts string date', () => {
    expect(formatDate(new Date().toISOString())).toBe('just now');
  });
});

describe('formatFileSize', () => {
  test('zero bytes', () => {
    expect(formatFileSize(0)).toBe('0 B');
  });
  test('bytes', () => {
    expect(formatFileSize(500)).toBe('500 B');
  });
  test('kilobytes', () => {
    expect(formatFileSize(1536)).toMatch(/1\.5 KB/);
  });
  test('megabytes', () => {
    expect(formatFileSize(1.2 * 1024 * 1024)).toMatch(/1\.2 MB/);
  });
  test('gigabytes', () => {
    expect(formatFileSize(2.5 * 1024 ** 3)).toMatch(/2\.5 GB/);
  });
});

describe('formatDuration', () => {
  test('seconds only', () => {
    expect(formatDuration(5000)).toBe('5s');
  });
  test('minutes and seconds', () => {
    expect(formatDuration(150000)).toBe('2m 30s');
  });
  test('hours and minutes', () => {
    expect(formatDuration(3700000)).toBe('1h 1m');
  });
  test('zero', () => {
    expect(formatDuration(0)).toBe('0s');
  });
});

describe('pluralize', () => {
  test('singular', () => {
    expect(pluralize(1, 'item')).toBe('item');
  });
  test('plural auto', () => {
    expect(pluralize(5, 'item')).toBe('items');
  });
  test('custom plural', () => {
    expect(pluralize(3, 'person', 'people')).toBe('people');
  });
  test('zero is plural', () => {
    expect(pluralize(0, 'item')).toBe('items');
  });
});
