import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { MapPin, Calendar, DollarSign, MessageCircle } from 'lucide-react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

export type TripTab = 'itinerary' | 'tee-times' | 'costs' | 'chat';

interface TripTabBarProps {
  activeTab: TripTab;
  onTabPress: (tab: TripTab) => void;
  unreadCount?: number;
}

interface TabConfig {
  key: TripTab;
  label: string;
  Icon: React.FC<{ size: number; color: string }>;
}

const TABS: TabConfig[] = [
  { key: 'itinerary', label: 'Plan', Icon: Calendar },
  { key: 'tee-times', label: 'Tee Times', Icon: MapPin },
  { key: 'costs', label: 'Costs', Icon: DollarSign },
  { key: 'chat', label: 'Chat', Icon: MessageCircle },
];

function TabItem({
  config,
  isActive,
  onPress,
  badge,
}: {
  config: TabConfig;
  isActive: boolean;
  onPress: () => void;
  badge?: number;
}) {
  const colors = useThemeColors();
  const { Icon } = config;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(isActive ? 1.08 : 1, { damping: 12, stiffness: 180 }) }],
  }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={`${config.label} tab`}
      accessibilityHint={`Switch to the ${config.label} section`}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      style={styles.tabButton}
    >
      <Animated.View style={[styles.tabInner, animatedStyle]}>
        <View style={styles.iconWrapper}>
          <Icon
            size={22}
            color={isActive ? colors.primary : colors.textSecondary}
          />
          {badge !== undefined && badge > 0 && (
            <View
              style={[
                styles.badge,
                { backgroundColor: colors.accent },
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  { color: colors.textOnPrimary, fontFamily: 'Inter_700Bold' },
                ]}
              >
                {badge > 99 ? '99+' : String(badge)}
              </Text>
            </View>
          )}
        </View>
        <Text
          style={[
            styles.tabLabel,
            {
              color: isActive ? colors.primary : colors.textSecondary,
              fontFamily: isActive ? 'Inter_600SemiBold' : 'Inter_400Regular',
            },
          ]}
          numberOfLines={1}
        >
          {config.label}
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

export function TripTabBar({ activeTab, onTabPress, unreadCount }: TripTabBarProps) {
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
          config={tab}
          isActive={activeTab === tab.key}
          onPress={() => onTabPress(tab.key)}
          badge={tab.key === 'chat' ? unreadCount : undefined}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingBottom: 8,
    paddingTop: 4,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    position: 'relative',
  },
  iconWrapper: {
    position: 'relative',
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 11,
    letterSpacing: 0.2,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -4,
    left: '25%',
    right: '25%',
    height: 3,
    borderRadius: 2,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontSize: 9,
    lineHeight: 12,
  },
});
