/**
 * GAS Template, BottomSheet
 *
 * Gesture-driven bottom sheet with snap points and backdrop.
 */

import React, { useEffect, useCallback, useRef } from 'react';
import { View, TouchableOpacity, Dimensions, StyleSheet, findNodeHandle, AccessibilityInfo } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useThemeColors } from '../../context/ThemeContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Snap point as fraction of screen height (default: 0.5) */
  snapPoint?: number;
  children: React.ReactNode;
}

export function BottomSheet({ visible, onClose, snapPoint = 0.5, children }: BottomSheetProps) {
  const { colors, reducedMotion } = useThemeColors();
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const startY = useSharedValue(0);
  const sheetHeight = SCREEN_HEIGHT * snapPoint;
  const sheetRef = useRef<React.ComponentRef<typeof Animated.View>>(null);
  const reducedMotionRef = useRef(reducedMotion);
  useEffect(() => { reducedMotionRef.current = reducedMotion; }, [reducedMotion]);

  useEffect(() => {
    if (reducedMotion) {
      // Instant: skip the spring, jump directly to final position
      translateY.value = visible ? 0 : SCREEN_HEIGHT;
    } else {
      translateY.value = withSpring(visible ? 0 : SCREEN_HEIGHT, { damping: 20, stiffness: 200 });
    }
  }, [visible, reducedMotion]);

  // Move screen-reader focus into the sheet when it opens so the user is not
  // left focused on the now-hidden screen behind it.
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => {
      const node = sheetRef.current && findNodeHandle(sheetRef.current);
      if (node) AccessibilityInfo.setAccessibilityFocus(node);
    }, 200);
    return () => clearTimeout(t);
  }, [visible]);

  const gesture = Gesture.Pan()
    .onStart(() => { startY.value = translateY.value; })
    .onUpdate((e) => { translateY.value = Math.max(0, startY.value + e.translationY); })
    .onEnd((e) => {
      if (e.translationY > sheetHeight * 0.3 || e.velocityY > 500) {
        translateY.value = reducedMotionRef.current ? SCREEN_HEIGHT : withSpring(SCREEN_HEIGHT, { damping: 20 });
        runOnJS(onClose)();
      } else {
        translateY.value = reducedMotionRef.current ? 0 : withSpring(0, { damping: 20 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: visible ? 0.5 : 0,
  }));

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} accessibilityRole="none">
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }, backdropStyle]}
        importantForAccessibility="no-hide-descendants"
      >
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} accessibilityRole="button" accessibilityLabel="Close sheet" />
      </Animated.View>

      <GestureDetector gesture={gesture}>
        <Animated.View
          ref={sheetRef}
          style={[sheetStyle, {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: sheetHeight,
            backgroundColor: colors.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
          }]}
          accessible
          accessibilityViewIsModal={true}
          accessibilityLabel="Bottom sheet"
        >
          {/* Handle bar */}
          <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 8 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.textSecondary, opacity: 0.4 }} />
          </View>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
