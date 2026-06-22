/**
 * Tests for lib/crypto.ts
 */

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => '550e8400-e29b-41d4-a716-446655440000'),
  digestStringAsync: jest.fn(async () => 'a1b2c3d4e5f6hash'),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}));

import { generateId, hashString } from '../../lib/crypto';

describe('generateId', () => {
  test('returns UUID format string', () => {
    const id = generateId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});

describe('hashString', () => {
  test('returns hex digest', async () => {
    const hash = await hashString('test input');
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
  });
});
