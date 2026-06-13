/**
 * GAS Template, ConfirmDialog
 *
 * Modal confirmation dialog for destructive or important actions.
 *
 * Dependencies: useThemeColors (ThemeContext), gasConfig
 */

import { Modal, View, Text, TouchableOpacity } from 'react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { gasConfig } from '../../gas.config';

interface ConfirmDialogProps {
  /** Whether the dialog is visible */
  visible: boolean;
  /** Dialog title */
  title: string;
  /** Dialog message/description */
  message: string;
  /** Confirm button label (default: "Confirm") */
  confirmLabel?: string;
  /** Cancel button label (default: "Cancel") */
  cancelLabel?: string;
  /** Mark confirm action as destructive (red button) */
  destructive?: boolean;
  /** Called when confirm is pressed */
  onConfirm: () => void;
  /** Called when cancel is pressed or dialog is dismissed */
  onCancel: () => void;
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { colors } = useThemeColors();
  const confirmColor = destructive
    ? gasConfig.design.colors.error
    : gasConfig.design.colors.primary;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 32,
        }}
      >
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 18,
            padding: 24,
            width: '100%',
            maxWidth: 340,
          }}
        >
          <Text
            style={{
              color: colors.text,
              fontSize: 18,
              fontWeight: '700',
              marginBottom: 8,
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 14,
              lineHeight: 20,
              marginBottom: 24,
            }}
          >
            {message}
          </Text>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              onPress={onCancel}
              activeOpacity={0.8}
              style={{
                flex: 1,
                paddingVertical: 14,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: 'center',
              }}
              accessibilityLabel={cancelLabel}
            >
              <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>
                {cancelLabel}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onConfirm}
              activeOpacity={0.8}
              style={{
                flex: 1,
                paddingVertical: 14,
                borderRadius: 12,
                backgroundColor: confirmColor,
                alignItems: 'center',
              }}
              accessibilityLabel={confirmLabel}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 15 }}>
                {confirmLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
