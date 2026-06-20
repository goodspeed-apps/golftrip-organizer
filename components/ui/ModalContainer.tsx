/**
 * GAS Template, ModalContainer
 *
 * Shared modal wrapper with dark backdrop, centered or bottom-sheet layout.
 * Extracts the repeated Modal + backdrop + container pattern from
 * HelpSheet, WalkthroughModal, NPSSurvey, FeedbackButton, etc.
 *
 * Dependencies: useThemeColors (ThemeContext)
 */

import { Modal, View, Pressable, type ViewStyle, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '@/context/ThemeContext';

interface ModalContainerProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Called when backdrop is tapped or hardware back pressed */
  onClose: () => void;
  /** Layout preset (default: centered) */
  position?: 'center' | 'bottom';
  /** Modal content */
  children: React.ReactNode;
  /** Avoid keyboard overlap (default: true) */
  avoidKeyboard?: boolean;
  /** Container style overrides */
  style?: ViewStyle;
  /** Max width for centered modals (default: 400) */
  maxWidth?: number;
}

export function ModalContainer({
  visible,
  onClose,
  position = 'center',
  children,
  avoidKeyboard = true,
  style,
  maxWidth = 400,
}: ModalContainerProps) {
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();

  const content = (
    <Pressable
      onPress={onClose}
      style={{
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: position === 'bottom' ? 'flex-end' : 'center',
        alignItems: position === 'bottom' ? 'stretch' : 'center',
        padding: position === 'bottom' ? 0 : 24,
      }}
    >
      <Pressable
        onPress={(e) => e.stopPropagation()}
        style={[
          {
            backgroundColor: colors.surface,
            ...(position === 'bottom'
              ? {
                  borderTopLeftRadius: 20,
                  borderTopRightRadius: 20,
                  paddingBottom: insets.bottom + 16,
                  paddingTop: 16,
                  paddingHorizontal: 20,
                }
              : {
                  borderRadius: 20,
                  padding: 24,
                  width: '100%',
                  maxWidth,
                }),
          },
          style,
        ]}
      >
        {children}
      </Pressable>
    </Pressable>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType={position === 'bottom' ? 'slide' : 'fade'}
      onRequestClose={onClose}
    >
      {avoidKeyboard ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </Modal>
  );
}
