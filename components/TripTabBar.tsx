import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useThemeColors } from '@/context/ThemeContext';
import Animated, { useSharedValue, withSpring, useAnimatedStyle } from 'react-native-reanimated';
import {
  Calendar,
  MapPin,
  DollarSign,
  MessageCircle,
  Users,
} from 'lucide-react-native';

export type TripTab = 'itinerary' | 'courses' | 'costs' | 'chat' | 'members';

interface TripTabBarProps {
  activeTab: TripTab;
  onTabPress: (tab: TripTab) => void;
  unreadMessages?: number;
}

interface TabConfig {
  key: TripTab;
  label: string;
  Icon: React.ComponentType<{ size: number; color: string }>;
}

const TABS: TabConfig[] = [
  { key: 'itinerary', label: 'Schedule', Icon: Calendar },
  { key: 'courses', label: 'Courses', Icon: MapPin },
  { key: 'costs', label: 'Costs', Icon: DollarSign },
  { key: 'chat', label: 'Chat', Icon: MessageCircle },
  { key: 'members', label: 'Crew', Icon: Users },
];

function TabItem({
  tab,
  isActive,
  onPress,
  badge,
}: {
  tab: TabConfig;
  isActive: boolean;
  onPress: () => void;
  badge?: number;
}) {
  const colors = useThemeColors();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    scale.value = withSpring(0.97, { damping: 15 }, () => {
      scale.value = withSpring(1, { damping: 15 });
    });
    onPress();
  };

  const iconColor = isActive ? colors.primary : colors.textSecondary;
  const labelColor = isActive ? colors.primary : colors.textSecondary;

  return (
    <Pressable
      onPress={handlePress}
      accessibilityLabel={tab.label}
      accessibilityHint={`Switch to ${tab.label} tab`}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      style={styles.tabPressable}
    >
      <Animated.View style={[styles.tabContent, animatedStyle]}>
        <View style={styles.iconWrapper}>
          <tab.Icon size={22} color={iconColor} />
          {badge !== undefined && badge > 0 && (
            <View
              style={[
                styles.badge,
                { backgroundColor: colors.error },
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  { color: colors.textOnPrimary },
                ]}
              >
                {badge > 9 ? '9+' : String(badge)}
              </Text>
            </View>
          )}
        </View>
        <Text
          style={[
            styles.label,
            {
              color: labelColor,
              fontFamily: isActive ? 'Inter_600SemiBold' : 'Inter_400Regular',
            },
          ]}
          numberOfLines={1}
        >
          {tab.label}
        </Text>
        {isActive && (
          <View
            style={[styles.activeIndicator, { backgroundColor: colors.primary }]}
          />
        )}
      </Animated.View>
    </Pressable>
  );
}

export function TripTabBar({ activeTab, onTabPress, unreadMessages }: TripTabBarProps) {
  const colors = useThemeColors();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          shadowColor: colors.shadow,
        },
      ]}
    >
      {TABS.map((tab) => (
        <TabItem
          key={tab.key}
          tab={tab}
          isActive={activeTab === tab.key}
          onPress={() => onTabPress(tab.key)}
          badge={tab.key === 'chat' ? unreadMessages : undefined}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingBottom: 4,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
  tabPressable: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 4,
    width: '100%',
  },
  iconWrapper: {
    position: 'relative',
    marginBottom: 2,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    lineHeight: 12,
  },
  label: {
    fontSize: 11,
    lineHeight: 14,
  },
  activeIndicator: {
    marginTop: 4,
    width: 20,
    height: 3,
    borderRadius: 2,
  },
});

export default TripTabBar;
