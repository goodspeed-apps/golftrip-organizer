/**
 * Tests for gas.config.ts — Config structure validation.
 */

import { gasConfig } from '../../gas.config';

describe('GAS Config Structure', () => {
  test('app slug is valid format', () => {
    expect(gasConfig.app.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  test('all feature flags are booleans or objects', () => {
    const features = gasConfig.features;
    expect(typeof features.helpSystem).toBe('boolean');
    expect(typeof features.analytics.enabled).toBe('boolean');
    expect(typeof features.compliance.gdprConsent).toBe('boolean');
    expect(typeof features.compliance.ccpaNotice).toBe('boolean');
    expect(typeof features.compliance.attDialog).toBe('boolean');
  });

  test('navigation has at least 1 tab', () => {
    expect(gasConfig.navigation.tabs.length).toBeGreaterThanOrEqual(1);
  });

  test('navigation tabs within limits (1-5)', () => {
    expect(gasConfig.navigation.tabs.length).toBeLessThanOrEqual(5);
  });

  test('design colors are hex format', () => {
    const hexRegex = /^#[0-9A-Fa-f]{6}$/;
    expect(gasConfig.design.colors.primary).toMatch(hexRegex);
    expect(gasConfig.design.colors.background).toMatch(hexRegex);
  });

  test('backend config has supabase fields', () => {
    expect(typeof gasConfig.backend.supabase.url).toBe('string');
    expect(typeof gasConfig.backend.supabase.anonKey).toBe('string');
  });

  test('gamification config has required fields', () => {
    const g = gasConfig.features.gamification;
    expect(typeof g.enabled).toBe('boolean');
    expect(Array.isArray(g.elements)).toBe(true);
  });

  test('all required config fields present', () => {
    expect(gasConfig.app).toBeDefined();
    expect(gasConfig.design).toBeDefined();
    expect(gasConfig.features).toBeDefined();
    expect(gasConfig.navigation).toBeDefined();
    expect(gasConfig.backend).toBeDefined();
  });

  test('tab configs have required fields', () => {
    for (const tab of gasConfig.navigation.tabs) {
      expect(typeof tab.id).toBe('string');
      expect(typeof tab.label).toBe('string');
      expect(typeof tab.icon).toBe('string');
      expect(typeof tab.file).toBe('string');
    }
  });

  test('color contrast: primary vs background', () => {
    expect(gasConfig.design.colors.primary).not.toBe(gasConfig.design.colors.background);
  });

  test('app name is not empty', () => {
    expect(gasConfig.app.name.length).toBeGreaterThan(0);
  });

  test('design has colors object', () => {
    expect(gasConfig.design.colors).toBeDefined();
    expect(typeof gasConfig.design.colors.primary).toBe('string');
  });
});
