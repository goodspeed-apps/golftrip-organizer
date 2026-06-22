import type { Preview } from '@storybook/react';
import React from 'react';
import { View } from 'react-native';
import { ThemeProvider } from '../context/ThemeContext';

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#ffffff' },
        { name: 'dark', value: '#1c1c1e' },
      ],
    },
  },
  decorators: [
    (Story) => (
      <ThemeProvider>
        <View style={{ padding: 24, minWidth: 320, fontFamily: 'system-ui' }}>
          <Story />
        </View>
      </ThemeProvider>
    ),
  ],
};

export default preview;