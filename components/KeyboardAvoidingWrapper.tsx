/**
 * GAS Template, KeyboardAvoidingWrapper
 *
 * Platform-aware keyboard avoidance with tap-to-dismiss.
 */

import React from 'react';
import { KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard, Platform } from 'react-native';

export interface KeyboardAvoidingWrapperProps {
  children: React.ReactNode;
  /** Additional vertical offset (default: 0) */
  keyboardVerticalOffset?: number;
}

export function KeyboardAvoidingWrapper({ children, keyboardVerticalOffset = 0 }: KeyboardAvoidingWrapperProps) {
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        {children}
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}
