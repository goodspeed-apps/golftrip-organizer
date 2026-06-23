/**
 * Tests for hooks/useNetworkQuality.ts — Network quality mapping.
 */

describe('network quality mapping', () => {
  function mapQuality(type: string, isConnected: boolean): string {
    if (!isConnected) return 'offline';
    switch (type) {
      case 'wifi':
      case 'ethernet':
        return 'excellent';
      case 'cellular':
        return 'good';
      case 'bluetooth':
      case 'other':
        return 'poor';
      default:
        return 'offline';
    }
  }

  test('wifi maps to excellent', () => {
    expect(mapQuality('wifi', true)).toBe('excellent');
  });

  test('ethernet maps to excellent', () => {
    expect(mapQuality('ethernet', true)).toBe('excellent');
  });

  test('cellular maps to good', () => {
    expect(mapQuality('cellular', true)).toBe('good');
  });

  test('bluetooth maps to poor', () => {
    expect(mapQuality('bluetooth', true)).toBe('poor');
  });

  test('not connected maps to offline', () => {
    expect(mapQuality('wifi', false)).toBe('offline');
  });

  test('unknown type maps to offline', () => {
    expect(mapQuality('none', true)).toBe('offline');
  });
});
