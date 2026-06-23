// __tests__/lib/semver.test.ts
// Asserts correctness of lib/semver (client) and parity with _shared/semver (edge).

import { compareVersions } from '../../lib/semver';
import { compareVersions as compareVersionsShared } from '../../supabase/functions/_shared/semver';

describe('compareVersions (lib/semver — client)', () => {
  it('returns 0 for equal versions', () => {
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
    expect(compareVersions('0.0.0', '0.0.0')).toBe(0);
  });

  it('returns -1 when a < b by major', () => {
    expect(compareVersions('1.0.0', '2.0.0')).toBe(-1);
  });

  it('returns 1 when a > b by major', () => {
    expect(compareVersions('3.0.0', '2.9.9')).toBe(1);
  });

  it('returns -1 when a < b by minor', () => {
    expect(compareVersions('1.1.0', '1.2.0')).toBe(-1);
  });

  it('returns 1 when a > b by minor', () => {
    expect(compareVersions('1.3.0', '1.2.99')).toBe(1);
  });

  it('returns -1 when a < b by patch', () => {
    expect(compareVersions('1.2.3', '1.2.4')).toBe(-1);
  });

  it('returns 1 when a > b by patch', () => {
    expect(compareVersions('1.2.5', '1.2.4')).toBe(1);
  });

  it('strips pre-release metadata before comparing', () => {
    expect(compareVersions('1.2.3-beta.1', '1.2.3')).toBe(0);
    expect(compareVersions('2.0.0-alpha', '1.9.9')).toBe(1);
    expect(compareVersions('1.0.0-rc.1', '1.0.1')).toBe(-1);
  });

  it('strips build metadata before comparing', () => {
    expect(compareVersions('1.2.3+build.42', '1.2.3')).toBe(0);
    expect(compareVersions('1.2.3+001', '1.2.4')).toBe(-1);
  });

  it('throws on non-triplet input', () => {
    expect(() => compareVersions('1.2', '1.2.3')).toThrow();
    expect(() => compareVersions('1.2.3', '1')).toThrow();
    expect(() => compareVersions('', '1.2.3')).toThrow();
  });

  it('throws on non-numeric segments', () => {
    expect(() => compareVersions('1.x.3', '1.2.3')).toThrow();
    expect(() => compareVersions('1.2.3', 'a.b.c')).toThrow();
  });

  it('throws on negative segments', () => {
    expect(() => compareVersions('-1.0.0', '1.0.0')).toThrow();
  });

it('throws on leading-zero segments', () => {
    expect(() => compareVersions('1.01.0', '1.1.0')).toThrow();
    expect(() => compareVersions('1.2.3', '01.2.3')).toThrow();
  });
});

// ─── Parity: lib/semver vs supabase/functions/_shared/semver ──────────────

describe('semver parity: lib/semver matches _shared/semver', () => {
  const samples: [string, string][] = [
    ['1.0.0', '1.0.0'],
    ['2.0.0', '1.9.9'],
    ['1.0.0', '2.0.0'],
    ['1.2.3', '1.2.4'],
    ['1.2.5', '1.2.4'],
    ['1.2.3-beta', '1.2.3'],
    ['1.2.3+build', '1.2.3'],
    ['0.0.0', '0.0.0'],
  ];

  it.each(samples)('compareVersions(%s, %s) produces equal output', (a, b) => {
    expect(compareVersions(a, b)).toBe(compareVersionsShared(a, b));
  });
});