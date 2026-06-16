/**
 * Tests for lib/color.ts — Color manipulation utilities.
 */

import { hexToRgba, lighten, darken, isLight, getContrastColor } from '../../lib/color';

describe('hexToRgba', () => {
  test('converts hex with alpha', () => {
    expect(hexToRgba('#FF0000', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
  });
  test('handles 3-char hex', () => {
    expect(hexToRgba('#F00', 1)).toBe('rgba(255, 0, 0, 1)');
  });
  test('handles black', () => {
    expect(hexToRgba('#000000', 0.8)).toBe('rgba(0, 0, 0, 0.8)');
  });
});

describe('lighten', () => {
  test('lightens a dark color', () => {
    const result = lighten('#000000', 0.5);
    expect(result).toBe('#808080');
  });
  test('full lighten gives white', () => {
    expect(lighten('#000000', 1)).toBe('#ffffff');
  });
  test('no lighten returns same', () => {
    expect(lighten('#ff0000', 0)).toBe('#ff0000');
  });
});

describe('darken', () => {
  test('darkens a light color', () => {
    const result = darken('#ffffff', 0.5);
    expect(result).toBe('#808080');
  });
  test('full darken gives black', () => {
    expect(darken('#ffffff', 1)).toBe('#000000');
  });
  test('no darken returns same', () => {
    expect(darken('#ff0000', 0)).toBe('#ff0000');
  });
});

describe('isLight', () => {
  test('white is light', () => {
    expect(isLight('#FFFFFF')).toBe(true);
  });
  test('black is not light', () => {
    expect(isLight('#000000')).toBe(false);
  });
  test('yellow is light', () => {
    expect(isLight('#FFFF00')).toBe(true);
  });
  test('dark blue is not light', () => {
    expect(isLight('#000080')).toBe(false);
  });
});

describe('getContrastColor', () => {
  test('returns black for white background', () => {
    expect(getContrastColor('#FFFFFF')).toBe('#000000');
  });
  test('returns white for black background', () => {
    expect(getContrastColor('#000000')).toBe('#FFFFFF');
  });
  test('returns white for dark red', () => {
    expect(getContrastColor('#800000')).toBe('#FFFFFF');
  });
});
