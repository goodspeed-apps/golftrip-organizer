/**
 * GAS Template, HelpButton
 *
 * Floating help "?" button that opens the HelpSheet.
 *
 * Features:
 * - Reads dismissed state from HelpContext
 * - Hidden when user has dismissed help (unless alwaysVisible=true)
 * - Positioned by the parent (typically top-right of a screen header)
 * - Opens HelpSheet bottom sheet on press
 * - Theme-aware icon color
 * - Accessible with proper labels
 *
 * Extracted from ThreadLift, made generic.
 *
 * Dependencies: HelpContext, HelpSheet, lucide-react-native
 */

import { useState } from 'react';
import { TouchableOpacity } from 'react-native';
import { HelpCircle } from 'lucide-react-native';
import { HelpSheet } from './HelpSheet';
import { useHelp } from '@/context/HelpContext';
import { useThemeColors } from '@/context/ThemeContext';

interface HelpButtonProps {
  /** Show even if the user has dismissed help (default: false) */
  alwaysVisible?: boolean;
  /** Icon color override (default: textSecondary from theme) */
  color?: string;
}

/**
 * HelpButton, Floating "?" icon that opens the HelpSheet.
 *
 * Usage:
 *   // In a screen header:
 *   <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
 *     <Text style={styles.title}>Dashboard</Text>
 *     <HelpButton />
 *   </View>
 *
 *   // Always visible (e.g., in settings):
 *   <HelpButton alwaysVisible />
 */
export function HelpButton({ alwaysVisible = false, color }: HelpButtonProps) {
  const { dismissed, dismiss } = useHelp();
  const { colors } = useThemeColors();
  const [sheetVisible, setSheetVisible] = useState(false);

  // Hide if user has dismissed help and alwaysVisible is false
  if (dismissed && !alwaysVisible) return null;

  return (
    <>
      <TouchableOpacity
        onPress={() => setSheetVisible(true)}
        style={{
          width: 36,
          height: 36,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        accessibilityRole="button"
        accessibilityLabel="Help"
        accessibilityHint="Open help options"
      >
        <HelpCircle size={20} color={color ?? colors.textSecondary} />
      </TouchableOpacity>
      <HelpSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onDismiss={async () => {
          await dismiss();
          setSheetVisible(false);
        }}
      />
    </>
  );
}
