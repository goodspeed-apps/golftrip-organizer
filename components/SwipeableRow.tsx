/**
 * GAS Template, SwipeableRow
 *
 * Left/right swipe actions for list items (edit, delete, archive).
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useThemeColors } from '../context/ThemeContext';

export interface SwipeAction {
  label: string;
  color: string;
  icon?: React.ReactNode;
  onPress: () => void;
}

export interface SwipeableRowProps {
  leftActions?: SwipeAction[];
  rightActions?: SwipeAction[];
  children: React.ReactNode;
}

const ACTION_WIDTH = 72;

export function SwipeableRow({ leftActions = [], rightActions = [], children }: SwipeableRowProps) {
  const { colors } = useThemeColors();
  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);

  const maxLeft = leftActions.length * ACTION_WIDTH;
  const maxRight = rightActions.length * ACTION_WIDTH;

  const gesture = Gesture.Pan()
    .onStart(() => { startX.value = translateX.value; })
    .onUpdate((e) => {
      const next = startX.value + e.translationX;
      translateX.value = Math.max(-maxRight, Math.min(maxLeft, next));
    })
    .onEnd(() => {
      const threshold = ACTION_WIDTH * 0.6;
      if (translateX.value > threshold && leftActions.length > 0) {
        translateX.value = withSpring(maxLeft, { damping: 20 });
      } else if (translateX.value < -threshold && rightActions.length > 0) {
        translateX.value = withSpring(-maxRight, { damping: 20 });
      } else {
        translateX.value = withSpring(0, { damping: 20 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const close = () => { translateX.value = withSpring(0, { damping: 20 }); };

  const renderActions = (actions: SwipeAction[], side: 'left' | 'right') => (
    <View style={{
      position: 'absolute',
      [side]: 0,
      top: 0,
      bottom: 0,
      flexDirection: 'row',
      width: actions.length * ACTION_WIDTH,
    }}>
      {actions.map((action, i) => (
        <TouchableOpacity
          key={i}
          onPress={() => { close(); action.onPress(); }}
          style={{
            width: ACTION_WIDTH,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: action.color,
          }}
          accessibilityLabel={action.label}
          accessibilityRole="button"
        >
          {action.icon}
          <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '600', marginTop: 4 }}>
            {action.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <View style={{ overflow: 'hidden' }}>
      {leftActions.length > 0 && renderActions(leftActions, 'left')}
      {rightActions.length > 0 && renderActions(rightActions, 'right')}
      <GestureDetector gesture={gesture}>
        <Animated.View style={[animatedStyle, { backgroundColor: colors.surface }]}>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
