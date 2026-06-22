/**
 * GAS Template, PasswordInput
 *
 * A reusable secure-entry TextInput with a trailing Eye / EyeOff toggle that
 * shows or hides the password. Forwards every TextInput prop (value, onChangeText,
 * placeholder, returnKeyType, onSubmitEditing, ref, etc.) so it drops in anywhere
 * a plain password field was used.
 *
 * Themed via useThemeColors(), never hardcoded. The toggle is an icon-only
 * control, so it carries accessibilityRole="button", a clear accessibilityLabel,
 * and a >=44pt hit area.
 *
 * `autoComplete` / `textContentType` default to the login ("current-password")
 * values; the signup screen overrides them to "new-password" via props.
 */

import { forwardRef, useState } from 'react';
import { View, TextInput, TouchableOpacity, type TextInputProps } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';

export type PasswordInputProps = Omit<TextInputProps, 'secureTextEntry'>;

export const PasswordInput = forwardRef<TextInput, PasswordInputProps>(
  function PasswordInput(props, ref) {
    const { colors } = useThemeColors();
    const [visible, setVisible] = useState(false);
    const { style, accessibilityLabel, ...rest } = props;

    return (
      <View style={{ position: 'relative', justifyContent: 'center' }}>
        <TextInput
          ref={ref}
          {...rest}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType={rest.textContentType ?? 'password'}
          autoComplete={rest.autoComplete ?? 'current-password'}
          placeholderTextColor={rest.placeholderTextColor ?? colors.textSecondary}
          accessibilityLabel={accessibilityLabel ?? 'Password'}
          style={[
            {
              height: 48,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              paddingHorizontal: 16,
              paddingRight: 52,
              fontSize: 16,
              color: colors.text,
            },
            style,
          ]}
        />
        <TouchableOpacity
          onPress={() => setVisible((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Hide password' : 'Show password'}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{
            position: 'absolute',
            right: 4,
            height: 44,
            width: 44,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {visible ? (
            <EyeOff size={20} color={colors.textSecondary} accessible={false} />
          ) : (
            <Eye size={20} color={colors.textSecondary} accessible={false} />
          )}
        </TouchableOpacity>
      </View>
    );
  }
);
