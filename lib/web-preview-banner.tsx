import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { isWeb } from './platform';

const SHOW_BANNER = isWeb && (process.env.EXPO_PUBLIC_GAS_WEB_PREVIEW === 'true' || __DEV__);

export function WebPreviewBanner() {
  if (!SHOW_BANNER) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>
        Web Preview, Some native features are simulated
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: 'rgba(14, 165, 233, 0.1)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  text: {
    fontSize: 12,
    color: '#38bdf8',
    fontWeight: '500',
  },
});
