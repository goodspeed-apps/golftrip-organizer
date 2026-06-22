/**
 * Tests for Typography font family application.
 *
 * Verifies that Heading/Subheading use displayFamily() and Body/Caption/Label
 * use bodyFamily() — and that 'system' sentinel produces no fontFamily key.
 */

import React from 'react';
import { render } from '@testing-library/react-native';

// --- ThemeContext mock (required by all Typography components) ---
jest.mock('../../context/ThemeContext', () => ({
  useThemeColors: () => ({
    colors: {
      background: '#fff',
      surface: '#f5f5f5',
      text: '#000',
      textSecondary: '#666',
      primary: '#6366F1',
      border: '#ccc',
      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444',
    },
    resolved: 'light',
  }),
}));

// --- Mutable gas.config mock (mutated per describe block) ---
const mockTypography = {
  displayFont: 'system' as string,
  bodyFont: 'system' as string,
  headingWeight: '700' as const,
  monoFont: 'monospace',
};

jest.mock('../../gas.config', () => ({
  __esModule: true,
  gasConfig: {
    design: {
      get typography() {
        return mockTypography;
      },
    },
  },
}));

// Import components and resolvers AFTER mocks are set up
import { Heading, Subheading, Body, Caption, Label } from '../../components/ui/Typography';
import { displayFamily, bodyFamily, fontFamilyName } from '../../lib/fonts';

// ─── fontFamilyName() helper ──────────────────────────────────────────────────

describe('fontFamilyName()', () => {
  it('splits SpaceGrotesk -> Space Grotesk', () => {
    expect(fontFamilyName('SpaceGrotesk')).toBe('Space Grotesk');
  });

  it('splits IBMPlexSans -> IBM Plex Sans', () => {
    expect(fontFamilyName('IBMPlexSans')).toBe('IBM Plex Sans');
  });

  it('leaves Inter unchanged', () => {
    expect(fontFamilyName('Inter')).toBe('Inter');
  });

  it('leaves Fraunces unchanged (single word)', () => {
    expect(fontFamilyName('Fraunces')).toBe('Fraunces');
  });
});

// ─── displayFamily() resolver ────────────────────────────────────────────────

describe('displayFamily()', () => {
  it('returns the spaced slug when displayFont is SpaceGrotesk', () => {
    mockTypography.displayFont = 'SpaceGrotesk';
    expect(displayFamily()).toBe('Space Grotesk');
  });

  it('returns the font name unchanged when displayFont is a single-word family', () => {
    mockTypography.displayFont = 'Fraunces';
    expect(displayFamily()).toBe('Fraunces');
  });

  it('returns undefined when displayFont is "system"', () => {
    mockTypography.displayFont = 'system';
    expect(displayFamily()).toBeUndefined();
  });

  it('returns undefined when displayFont is "monospace"', () => {
    mockTypography.displayFont = 'monospace';
    expect(displayFamily()).toBeUndefined();
  });
});

// ─── bodyFamily() resolver ────────────────────────────────────────────────────

describe('bodyFamily()', () => {
  it('returns the spaced slug when bodyFont is SpaceGrotesk', () => {
    mockTypography.bodyFont = 'SpaceGrotesk';
    expect(bodyFamily()).toBe('Space Grotesk');
  });

  it('returns Inter unchanged', () => {
    mockTypography.bodyFont = 'Inter';
    expect(bodyFamily()).toBe('Inter');
  });

  it('returns undefined when bodyFont is "system"', () => {
    mockTypography.bodyFont = 'system';
    expect(bodyFamily()).toBeUndefined();
  });

  it('returns undefined when bodyFont is "monospace"', () => {
    mockTypography.bodyFont = 'monospace';
    expect(bodyFamily()).toBeUndefined();
  });
});

// ─── Heading component — displayFamily applied ────────────────────────────────

describe('Heading component fontFamily', () => {
  beforeEach(() => {
    mockTypography.displayFont = 'system';
    mockTypography.bodyFont = 'system';
  });

  it('includes fontFamily in style when displayFont is a custom family', async () => {
    mockTypography.displayFont = 'Fraunces';

    const { getByRole } = await render(<Heading>Hello</Heading>);
    const el = getByRole('header');

    // StyleSheet.flatten resolves the style array to a flat object
    const { StyleSheet } = require('react-native');
    const flat = StyleSheet.flatten(el.props.style);
    expect(flat.fontFamily).toBe('Fraunces');
  });

  it('does NOT include fontFamily when displayFont is "system"', async () => {
    mockTypography.displayFont = 'system';

    const { getByRole } = await render(<Heading>Hello</Heading>);
    const el = getByRole('header');

    const { StyleSheet } = require('react-native');
    const flat = StyleSheet.flatten(el.props.style);
    // fontFamily must be absent (undefined or missing key)
    expect(flat.fontFamily == null).toBe(true);
  });
});

// ─── Subheading component — displayFamily applied ────────────────────────────

describe('Subheading component fontFamily', () => {
  beforeEach(() => {
    mockTypography.displayFont = 'system';
  });

  it('includes fontFamily when displayFont is a custom family', async () => {
    mockTypography.displayFont = 'Fraunces';

    const { getByText } = await render(<Subheading>Sub</Subheading>);
    const el = getByText('Sub');

    const { StyleSheet } = require('react-native');
    const flat = StyleSheet.flatten(el.props.style);
    expect(flat.fontFamily).toBe('Fraunces');
  });

  it('does NOT include fontFamily when displayFont is "system"', async () => {
    mockTypography.displayFont = 'system';

    const { getByText } = await render(<Subheading>Sub</Subheading>);
    const el = getByText('Sub');

    const { StyleSheet } = require('react-native');
    const flat = StyleSheet.flatten(el.props.style);
    expect(flat.fontFamily == null).toBe(true);
  });
});

// ─── Body component — bodyFamily applied ────────────────────────────────────

describe('Body component fontFamily', () => {
  beforeEach(() => {
    mockTypography.bodyFont = 'system';
  });

  it('includes fontFamily as the spaced slug when bodyFont is SpaceGrotesk', async () => {
    mockTypography.bodyFont = 'SpaceGrotesk';

    const { getByText } = await render(<Body>text</Body>);
    const el = getByText('text');

    const { StyleSheet } = require('react-native');
    const flat = StyleSheet.flatten(el.props.style);
    expect(flat.fontFamily).toBe('Space Grotesk');
  });

  it('does NOT include fontFamily when bodyFont is "system"', async () => {
    mockTypography.bodyFont = 'system';

    const { getByText } = await render(<Body>text</Body>);
    const el = getByText('text');

    const { StyleSheet } = require('react-native');
    const flat = StyleSheet.flatten(el.props.style);
    expect(flat.fontFamily == null).toBe(true);
  });
});
