/**
 * GAS Template, OfflineBanner
 *
 * Persistent red banner shown when device is offline.
 * Uses useOfflineSync to monitor connectivity.
 *
 * Mount in app/_layout.tsx below SafeAreaProvider, above content:
 *   <OfflineBanner />
 *
 * Dependencies: useOfflineSync, lucide-react-native
 */

import { View, Text } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { useThemeColors } from '@/context/ThemeContext';

export function OfflineBanner() {
  const { isOnline } = useOfflineSync();
  const { colors } = useThemeColors();

  if (isOnline) return null;

  return (
    <View
      style={{
        backgroundColor: colors.error,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 8,
        paddingHorizontal: 16,
      }}
      accessibilityRole="alert"
    >
      <WifiOff size={16} color={colors.textOnPrimary} />
      <Text style={{ color: colors.textOnPrimary, fontSize: 13, fontWeight: '600' }}>
        You're offline
      </Text>
    </View>
  );
}
