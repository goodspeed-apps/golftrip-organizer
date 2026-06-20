/**
 * GAS Template, AppLogo
 *
 * Renders the app's logo image asset. Codegen overwrites
 * assets/images/logo.png with the real generated logo per app;
 * the default falls back to the amber icon.
 */

import React from 'react';
import { Image } from 'react-native';

export default function AppLogo({ size = 72 }: { size?: number }) {
  return (
    <Image
      source={require('@/assets/images/logo.png')}
      style={{ width: size, height: size, borderRadius: size * 0.28 }}
      resizeMode="contain"
      accessibilityLabel="App logo"
    />
  );
}
