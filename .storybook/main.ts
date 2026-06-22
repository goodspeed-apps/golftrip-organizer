import type { StorybookConfig } from '@storybook/react-vite';
import { resolve } from 'node:path';

const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.tsx'],
  addons: ['@storybook/addon-essentials', '@storybook/addon-interactions'],
  framework: { name: '@storybook/react-vite', options: {} },
  typescript: { check: false, reactDocgen: 'react-docgen-typescript' },
  viteFinal: async (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      'react-native': 'react-native-web',
      '@': resolve(__dirname, '..'),
      '@react-native-async-storage/async-storage': resolve(__dirname, '../stories/stubs/async-storage.ts'),
      '@sentry/react-native': resolve(__dirname, '../stories/stubs/sentry.ts'),
      'posthog-react-native': resolve(__dirname, '../stories/stubs/posthog.ts'),
      'react-native-safe-area-context': resolve(__dirname, '../stories/stubs/safe-area-context.ts'),
    };
    // Include .web.js/.web.jsx so vite prefers a library's web build over its
    // native one (e.g. react-native-svg ships ReactNativeSVG.web.js; without this,
    // vite picks the Fabric native components which import codegenNativeComponent,
    // a module react-native-web does not provide, and the storybook build fails).
    config.resolve.extensions = ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js'];
    return config;
  },
};

export default config;