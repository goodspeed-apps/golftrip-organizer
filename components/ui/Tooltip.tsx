/**
 * GAS Template, Tooltip
 *
 * Press-and-hold tooltip with auto-dismiss.
 */

import React, { useState, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useThemeColors } from '../../context/ThemeContext';

export interface TooltipProps {
  text: string;
  position?: 'top' | 'bottom';
  delay?: number;
  children: React.ReactNode;
}

export function Tooltip({ text, position = 'top', delay = 2000, children }: TooltipProps) {
  const { colors } = useThemeColors();
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    setVisible(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(false), delay);
  }, [delay]);

  const hide = useCallback(() => {
    setVisible(false);
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return (
    <View>
      {visible && position === 'top' && (
        <Animated.View
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(100)}
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            marginBottom: 8,
            backgroundColor: colors.text,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 8,
            zIndex: 999,
          }}
        >
          <Text style={{ color: colors.background, fontSize: 12 }}>{text}</Text>
        </Animated.View>
      )}

      <TouchableOpacity onLongPress={show} onPressOut={hide} activeOpacity={0.8}>
        {children}
      </TouchableOpacity>

      {visible && position === 'bottom' && (
        <Animated.View
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(100)}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 8,
            backgroundColor: colors.text,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 8,
            zIndex: 999,
          }}
        >
          <Text style={{ color: colors.background, fontSize: 12 }}>{text}</Text>
        </Animated.View>
      )}
    </View>
  );
}
