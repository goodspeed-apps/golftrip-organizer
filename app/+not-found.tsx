/**
 * GAS Template, 404 Not Found Screen
 *
 * Displayed when a user navigates to a route that doesn't exist.
 * Provides a "Go Home" button that navigates back to the entry point.
 *
 * All colors come from useThemeColors(), never hardcoded.
 * Uses SafeAreaView from 'react-native-safe-area-context' (CRITICAL).
 */

import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { useThemeColors } from '@/context/ThemeContext';

export default function NotFoundScreen() {
  const router = useRouter();
  const { colors } = useThemeColors();

  return (
    <>
      <Stack.Screen options={{ title: 'Not Found', headerShown: false }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 16 }}>
          <Text style={{ fontSize: 64, color: colors.textSecondary }}>404</Text>
          <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text, textAlign: 'center' }}>
            Page Not Found
          </Text>
          <Text style={{
            fontSize: 15, color: colors.textSecondary,
            textAlign: 'center', lineHeight: 22, maxWidth: 300,
          }}>
            The screen you're looking for doesn't exist or has been moved.
          </Text>
          <TouchableOpacity
            style={{
              marginTop: 16,
              height: 48,
              paddingHorizontal: 32,
              borderRadius: 12,
              backgroundColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onPress={() => router.replace('/')}
            accessibilityLabel="Go to home screen"
          >
            <Text style={{ fontSize: 16, fontWeight: '600', color: 'white' }}>Go Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </>
  );
}
