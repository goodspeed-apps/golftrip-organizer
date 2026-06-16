/**
 * GAS Template, ImageViewer
 *
 * Full-screen image viewer with pinch-to-zoom.
 */

import React, { useState } from 'react';
import { View, TouchableOpacity, Dimensions, FlatList } from 'react-native';
import { Image } from 'expo-image';
import { X, Share2 } from 'lucide-react-native';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { shareContent } from '../lib/sharing';
import { useThemeColors } from '@/context/ThemeContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface ImageViewerProps {
  images: string[];
  initialIndex?: number;
  visible: boolean;
  onClose: () => void;
}

export function ImageViewer({ images, initialIndex = 0, visible, onClose }: ImageViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const { colors } = useThemeColors();
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => { scale.value = savedScale.value * e.scale; })
    .onEnd(() => {
      if (scale.value < 1) scale.value = 1;
      savedScale.value = scale.value;
    });

  const doubleTap = Gesture.Tap().numberOfTaps(2).onEnd(() => {
    scale.value = scale.value > 1 ? 1 : 2.5;
    savedScale.value = scale.value;
  });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if (!visible) return null;

  return (
    <View style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: '#000', zIndex: 9999,
    }}>
      {/* Header */}
      <View style={{
        position: 'absolute', top: 50, left: 16, right: 16, zIndex: 10,
        flexDirection: 'row', justifyContent: 'space-between',
      }}>
        <TouchableOpacity
          onPress={onClose}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
          accessibilityRole="button"
          accessibilityLabel="Close image viewer"
        >
          <X size={24} color={colors.textOnPrimary} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => shareContent({ message: images[currentIndex] })}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
          accessibilityRole="button"
          accessibilityLabel="Share image"
        >
          <Share2 size={20} color={colors.textOnPrimary} />
        </TouchableOpacity>
      </View>

      {images.length === 1 ? (
        <GestureDetector gesture={Gesture.Simultaneous(pinch, doubleTap)}>
          <Animated.View style={[{ flex: 1, justifyContent: 'center' }, animatedStyle]}>
            <Image source={{ uri: images[0] }} style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.7 }} contentFit="contain" />
          </Animated.View>
        </GestureDetector>
      ) : (
        <FlatList
          data={images}
          horizontal
          pagingEnabled
          initialScrollIndex={initialIndex}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            setCurrentIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH));
          }}
          keyExtractor={(_, i) => String(i)}
          getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
          renderItem={({ item }) => (
            <View style={{ width: SCREEN_WIDTH, justifyContent: 'center' }}>
              <Image source={{ uri: item }} style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.7 }} contentFit="contain" />
            </View>
          )}
        />
      )}
    </View>
  );
}
