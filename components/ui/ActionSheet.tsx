/**
 * GAS Template, ActionSheet
 *
 * Bottom sheet with a list of actions. Slides up from the bottom with a
 * cancel button. Common for share menus, delete confirmations, etc.
 *
 * Dependencies: useThemeColors (ThemeContext), gasConfig
 */

import { Modal, View, Text, TouchableOpacity, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '@/context/ThemeContext';
import { gasConfig } from '../../gas.config';

interface ActionSheetOption {
  /** Option label */
  label: string;
  /** Lucide icon component */
  icon?: React.ElementType;
  /** Mark as destructive (red text) */
  destructive?: boolean;
  /** Press handler */
  onPress: () => void;
}

interface ActionSheetProps {
  /** Whether the sheet is visible */
  visible: boolean;
  /** Optional title at the top */
  title?: string;
  /** List of actions */
  options: ActionSheetOption[];
  /** Cancel label (default: "Cancel") */
  cancelLabel?: string;
  /** Called on cancel or backdrop press */
  onClose: () => void;
}

export function ActionSheet({
  visible,
  title,
  options,
  cancelLabel = 'Cancel',
  onClose,
}: ActionSheetProps) {
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingBottom: insets.bottom + 8,
          }}
        >
          {title && (
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 13,
                fontWeight: '600',
                textAlign: 'center',
                paddingTop: 16,
                paddingBottom: 8,
              }}
            >
              {title}
            </Text>
          )}

          <View style={{ paddingHorizontal: 8, paddingTop: title ? 0 : 8 }}>
            {options.map((opt, i) => {
              const textColor = opt.destructive
                ? gasConfig.design.colors.error
                : colors.text;

              return (
                <TouchableOpacity
                  key={i}
                  onPress={() => { opt.onPress(); onClose(); }}
                  activeOpacity={0.7}
                  accessibilityLabel={opt.label}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 16,
                    paddingHorizontal: 16,
                    gap: 14,
                    borderBottomWidth: i < options.length - 1 ? 1 : 0,
                    borderBottomColor: colors.border,
                  }}
                >
                  {opt.icon && <opt.icon size={20} color={textColor} />}
                  <Text style={{ color: textColor, fontSize: 16, fontWeight: '500' }}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={{ paddingHorizontal: 8, paddingTop: 8 }}>
            <TouchableOpacity
              onPress={onClose}
              activeOpacity={0.7}
              accessibilityLabel={cancelLabel}
              style={{
                paddingVertical: 16,
                alignItems: 'center',
                backgroundColor: colors.background,
                borderRadius: 14,
              }}
            >
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>
                {cancelLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
