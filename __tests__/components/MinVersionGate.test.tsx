/**
 * Tests for components/MinVersionGate
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import * as RN from 'react-native';

// Pre-configure host component names to skip RTL auto-detection render
// --- Mocks ---

jest.mock('../../context/ThemeContext', () => ({
  useThemeColors: () => ({
    colors: {
      background: '#fff',
      surface: '#f5f5f5',
      text: '#000',
      textSecondary: '#666',
      primary: '#007AFF',
      border: '#ccc',
    },
    resolved: 'light',
  }),
}));

// Mutable state for expo-updates — mutated per test
let mockRuntimeVersion: string | undefined = undefined;

jest.mock('expo-updates', () => ({
  get runtimeVersion() {
    return mockRuntimeVersion;
  },
  isEnabled: false,
  checkForUpdateAsync: jest.fn(),
  fetchUpdateAsync: jest.fn(),
  reloadAsync: jest.fn(),
}));

// Mutable state for gasConfig — mutated per test
const mockApp = {
  minRuntimeVersion: '1.0.0',
  appStoreUrl: 'https://apps.apple.com/app/id123' as string | undefined,
};

jest.mock('../../gas.config', () => ({
  gasConfig: {
    get app() {
      return mockApp;
    },
    releaseChannels: {
      current: 'production',
      storeUrl: { ios: '', android: '' },
    },
  },
}));

// --- Import component after mocks ---
import { MinVersionGate } from '../../components/MinVersionGate';

// --- Tests ---

describe('MinVersionGate', () => {
  afterEach(() => {
    mockRuntimeVersion = undefined;
    mockApp.minRuntimeVersion = '1.0.0';
    mockApp.appStoreUrl = 'https://apps.apple.com/app/id123';
  });

  it('renders children when runtimeVersion equals minRuntimeVersion', async () => {
    mockRuntimeVersion = '1.0.0';
    mockApp.minRuntimeVersion = '1.0.0';

    const { getByText } = await render(
      <MinVersionGate>
        <RN.Text>App content</RN.Text>
      </MinVersionGate>
    );

    expect(getByText('App content')).toBeTruthy();
  });

  it('renders children when runtimeVersion is greater than minRuntimeVersion', async () => {
    mockRuntimeVersion = '2.0.0';
    mockApp.minRuntimeVersion = '1.0.0';

    const { getByText } = await render(
      <MinVersionGate>
        <RN.Text>App content</RN.Text>
      </MinVersionGate>
    );

    expect(getByText('App content')).toBeTruthy();
  });

  it('renders the blocking modal when runtimeVersion is less than minRuntimeVersion', async () => {
    mockRuntimeVersion = '0.9.0';
    mockApp.minRuntimeVersion = '1.0.0';

    const { getByText } = await render(
      <MinVersionGate>
        <RN.Text>App content</RN.Text>
      </MinVersionGate>
    );

    expect(getByText('Update Required')).toBeTruthy();
    expect(
      getByText(
        'Your app version is out of date. Update from the App Store to continue.'
      )
    ).toBeTruthy();
  });

  it('renders children without gating when runtimeVersion is undefined (dev/Expo Go)', async () => {
    mockRuntimeVersion = undefined;

    const { getByText, queryByText } = await render(
      <MinVersionGate>
        <RN.Text>App content</RN.Text>
      </MinVersionGate>
    );

    expect(getByText('App content')).toBeTruthy();
    expect(queryByText('Update Required')).toBeNull();
  });

  it('renders Open App Store button when appStoreUrl is set and update is required', async () => {
    mockRuntimeVersion = '0.9.0';
    mockApp.minRuntimeVersion = '1.0.0';
    mockApp.appStoreUrl = 'https://apps.apple.com/app/id123';

    const { getByText } = await render(
      <MinVersionGate>
        <RN.Text>App content</RN.Text>
      </MinVersionGate>
    );

    expect(getByText('Open App Store')).toBeTruthy();
  });

  it('hides Open App Store button when appStoreUrl is not set', async () => {
    mockRuntimeVersion = '0.9.0';
    mockApp.minRuntimeVersion = '1.0.0';
    mockApp.appStoreUrl = undefined;

    const { queryByText } = await render(
      <MinVersionGate>
        <RN.Text>App content</RN.Text>
      </MinVersionGate>
    );

    expect(queryByText('Open App Store')).toBeNull();
  });
});