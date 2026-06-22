/**
 * Tests for components/UpdateRequired
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import * as RN from 'react-native';

// Pre-configure host component names to skip RTL auto-detection render
// (RTL's configureInternal is not in public API but is stable internal API)
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

jest.mock('../../lib/sentry', () => ({
  addBreadcrumb: jest.fn(),
}));

// --- Import component after mocks ---
import { UpdateRequired } from '../../components/UpdateRequired';

// --- Tests ---

describe('UpdateRequired', () => {
  it('renders message and CTA', async () => {
    const { getByText } = await render(
      <UpdateRequired message="Please update" storeUrl="https://example.com" />
    );
    expect(getByText('Please update')).toBeTruthy();
    expect(getByText('Update now')).toBeTruthy();
  });

  it('disables CTA when storeUrl missing', async () => {
    const { getByText } = await render(<UpdateRequired />);
    expect(getByText('Update from the App Store/Play Store')).toBeTruthy();
  });

  it('opens storeUrl on press', async () => {
    const openSpy = jest
      .spyOn(RN.Linking, 'openURL')
      .mockResolvedValue(true as never);
    const { getByText } = await render(
      <UpdateRequired storeUrl="https://example.com" />
    );
    fireEvent.press(getByText('Update now'));
    expect(openSpy).toHaveBeenCalledWith('https://example.com');
    openSpy.mockRestore();
  });
});
