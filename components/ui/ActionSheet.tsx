/**
 * GAS Template, ActionSheet
 *
 * Bottom sheet with a list of actions. Slides up from the bottom with a
 * cancel button. Common for share menus, delete confirmations, etc.
 *
 * Dependencies: useThemeColors (ThemeContext), gasConfig
 */

import { useEffect, useRef, type Ref } from 'react';
import { Modal, View, Text, TouchableOpacity, Pressable, StyleSheet, findNodeHandle, AccessibilityInfo } from 'react-native';
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
  const focusRef = useRef<View | Text>(null);

  // Move VoiceOver/TalkBack focus into the sheet (title if present, else container)
  // when it opens, so the user is not left focused on the now-hidden screen behind.
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => {
      const node = focusRef.current && findNodeHandle(focusRef.current);
      if (node) AccessibilityInfo.setAccessibilityFocus(node);
    }, 150);
    return () => clearTimeout(t);
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        {/* Backdrop is a SIBLING (not the parent) of the sheet so that
            no-hide-descendants only hides the dimmed background, not the sheet. */}
        <Pressable
          onPress={onClose}
          importantForAccessibility="no-hide-descendants"
          accessibilityLabel="Dismiss"
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]}
        />
        <View
          accessibilityViewIsModal={true}
          ref={!title ? (focusRef as Ref<View>) : undefined}
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingBottom: insets.bottom + 8,
          }}
        >
          {title && (
            <Text
              ref={focusRef as Ref<Text>}
              accessibilityRole="header"
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
                  accessibilityRole="button"
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
              accessibilityRole="button"
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
        </View>
      </View>
    </Modal>
  );
}
