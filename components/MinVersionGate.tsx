import React from 'react';
import { Modal, View, Text, Pressable, Linking } from 'react-native';
import * as Updates from 'expo-updates';
import { gasConfig } from '../gas.config';
import { compareVersions } from '../lib/semver';
import { useThemeColors } from '../context/ThemeContext';

interface MinVersionGateProps {
  children: React.ReactNode;
}

export function MinVersionGate({ children }: MinVersionGateProps) {
  const { colors } = useThemeColors();
  const runtimeVersion = Updates.runtimeVersion;

  // In Expo Go / dev builds runtimeVersion is undefined, let the app through.
  if (!runtimeVersion) {
    return <>{children}</>;
  }

  const minVersion = gasConfig.app.minRuntimeVersion;
let mustUpdate = false;
  try {
    mustUpdate = compareVersions(runtimeVersion, minVersion) === -1;
  } catch {
    // Invalid semver in runtimeVersion or config, let the app through
    mustUpdate = false;
  }

  if (!mustUpdate) {
    return <>{children}</>;
  }

  const appStoreUrl = gasConfig.app.appStoreUrl;

  return (
    <>
      {children}
      <Modal
        visible
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {
          // Intentionally not dismissable, no-op
        }}
        accessibilityViewIsModal
      >
        <View
          className="flex-1 items-center justify-center px-8"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          accessibilityRole="alert"
        >
          <View
            className="w-full rounded-2xl p-6"
            style={{ backgroundColor: colors.surface }}
          >
            <Text
              className="text-xl font-bold mb-3 text-center"
              style={{ color: colors.text }}
            >
              Update Required
            </Text>
            <Text
              className="text-base text-center mb-6"
              style={{ color: colors.textSecondary }}
            >
              Your app version is out of date. Update from the App Store to
              continue.
            </Text>
            {appStoreUrl ? (
              <Pressable
                onPress={() => Linking.openURL(appStoreUrl)}
                className="rounded-xl py-3 px-6 items-center"
                style={{ backgroundColor: colors.primary }}
                accessibilityRole="button"
                accessibilityLabel="Open App Store to update"
              >
                <Text
                  className="text-base font-semibold"
                  style={{ color: '#ffffff' }}
                >
                  Open App Store
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );
}