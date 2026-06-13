import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { MapPin, DollarSign, MessageCircle, Users } from 'lucide-react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

type TabKey = 'itinerary' | 'expenses' | 'chat' | 'members';

interface TripTabBarProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  tripId: string;
}

interface TabConfig {
  key: TabKey;
  label: string;
  Icon: React.FC<{ size: number; color: string }>;
}

const TABS: TabConfig[] = [
  { key: 'itinerary', label: 'Itinerary', Icon: MapPin },
  { key: 'expenses', label: 'Expenses', Icon: DollarSign },
  { key: 'chat', label: 'Chat', Icon: MessageCircle },
  { key: 'members', label: 'Members', Icon: Users },
];

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function TabItem({
  tab,
  isActive,
  onPress,
}: {
  tab: TabConfig;
  isActive: boolean;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  const { Icon } = tab;

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(isActive ? 1.08 : 1, { damping: 14, stiffness: 180 }) }],
  }));

  return (
    <AnimatedPressable
      style={[styles.tab, animStyle]}
      onPress={onPress}
      accessibilityLabel={`${tab.label} tab`}
      accessibilityHint={`Switch to ${tab.label}`}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
    >
      <Icon
        size={20}
        color={isActive ? colors.primary : colors.textSecondary}
      />
      <Text
        style={[
          styles.label,
          {
            color: isActive ? colors.primary : colors.textSecondary,
            fontFamily: isActive ? 'Inter_600SemiBold' : 'Inter_400Regular',
          },
        ]}
        numberOfLines={1}
      >
        {tab.label}
      </Text>
      {isActive && (
        <View style={[styles.indicator, { backgroundColor: colors.primary }]} />
      )}
    </AnimatedPressable>
  );
}

export function TripTabBar({ activeTab, onTabChange }: TripTabBarProps) {
  const colors = useThemeColors();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderBottomColor: colors.border,
          shadowColor: colors.shadow,
        },
      ]}
    >
      {TABS.map((tab) => (
        <TabItem
          key={tab.key}
          tab={tab}
          isActive={activeTab === tab.key}
          onPress={() => onTabChange(tab.key)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 3,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    minHeight: 56,
    position: 'relative',
    gap: 3,
  },
  label: {
    fontSize: 11,
    letterSpacing: 0.2,
  },
  indicator: {
    position: 'absolute',
    bottom: 0,
    left: 8,
    right: 8,
    height: 3,
    borderRadius: 2,
  },
});
