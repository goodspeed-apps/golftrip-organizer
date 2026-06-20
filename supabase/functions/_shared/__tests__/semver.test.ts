// supabase/functions/_shared/__tests__/semver.test.ts

import { compareVersions } from '../semver';

describe('compareVersions', () => {
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
