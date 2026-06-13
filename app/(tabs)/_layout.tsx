/**
 * GAS Template, Dynamic Tab Bar Layout
 *
 * Reads tab configuration from gasConfig.navigation.tabs and renders
 * an Expo Router Tabs navigator dynamically.
 *
 * Features:
 * - Maps lucide-react-native icon names (strings) to actual icon components
 * - Renders Tabs.Screen for each configured tab
 * - Hides screens listed in gasConfig.navigation.hiddenScreens (via href: null)
 * - Theme-aware tab bar styling (dark background, primary active color)
 * - Wrapped in ErrorBoundary for crash resilience
 * - Supports the full lucide icon set, add new icons to the ICON_MAP as needed
 *
 * How the DevAgent uses this:
 * 1. The DevAgent writes gasConfig.navigation.tabs with icon names as strings
 * 2. This layout resolves those strings to actual icon components at runtime
 * 3. Screens in hiddenScreens[] are still navigable but hidden from the tab bar
 *
 * Dependencies: expo-router, lucide-react-native, gasConfig, ThemeContext, ErrorBoundary
 */

import { Tabs } from 'expo-router';
import {
  Home,
  Compass,
  Settings,
  Search,
  Bell,
  User,
  Heart,
  Star,
  BookMarked,
  TrendingUp,
  BarChart3,
  Calendar,
  MessageCircle,
  ShoppingCart,
  Folder,
  Map,
  Music,
  Camera,
  Image,
  Film,
  Zap,
  Award,
  Target,
  Layers,
  Grid,
  List,
  Clock,
  Shield,
  Globe,
  Smartphone,
  LayoutDashboard,
  Users,
  PieChart,
  Activity,
  Briefcase,
  Coffee,
  Dumbbell,
  Brain,
  Wallet,
  CircleDollarSign,
  Flame,
  Leaf,
  Lightbulb,
  Sparkles,
  Trophy,
  type LucideIcon,
} from 'lucide-react-native';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useThemeColors } from '@/context/ThemeContext';
import { gasConfig } from '../../gas.config';

// --- Icon name -> component mapping ---
// The DevAgent writes icon names as strings in gasConfig.navigation.tabs.
// This map resolves those strings to actual React components at runtime.
// Add additional icons here as needed for new apps.
const ICON_MAP: Record<string, LucideIcon> = {
  Home,
  Compass,
  Settings,
  Search,
  Bell,
  User,
  Heart,
  Star,
  BookMarked,
  TrendingUp,
  BarChart3,
  Calendar,
  MessageCircle,
  ShoppingCart,
  Folder,
  Map,
  Music,
  Camera,
  Image,
  Film,
  Zap,
  Award,
  Target,
  Layers,
  Grid,
  List,
  Clock,
  Shield,
  Globe,
  Smartphone,
  LayoutDashboard,
  Users,
  PieChart,
  Activity,
  Briefcase,
  Coffee,
  Dumbbell,
  Brain,
  Wallet,
  CircleDollarSign,
  Flame,
  Leaf,
  Lightbulb,
  Sparkles,
  Trophy,
};

/**
 * TabIcon, Renders a lucide icon at the standard tab bar size.
 * Used internally by the tab bar for each tab's icon.
 */
import React from 'react';

const TabIcon = React.memo(function TabIcon({ Icon, color }: { Icon: LucideIcon; color: string }) {
  return <Icon size={24} color={color} />;
});

/**
 * Resolve an icon name string to a lucide component.
 * Falls back to Home if the icon name is not found in the map.
 */
function resolveIcon(iconName: string): LucideIcon {
  return ICON_MAP[iconName] ?? Home;
}

// --- Config ---
const tabs = gasConfig.navigation.tabs;
const hiddenScreens = new Set(gasConfig.navigation.hiddenScreens);

/**
 * TabsLayout, Dynamic tab navigator driven by gasConfig.
 *
 * This is the main layout for the (tabs) route group.
 * Expo Router requires a _layout.tsx in each route group.
 *
 * Tab bar appearance:
 * - Dark background matching the theme
 * - Primary color for active tab
 * - Muted color for inactive tabs
 * - 1px top border
 */
export default function TabsLayout() {
  const { colors } = useThemeColors();
  const primary = gasConfig.design.colors.primary;

  return (
    <ErrorBoundary>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: primary,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarStyle: {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            borderTopWidth: 1,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
          },
        }}
      >
        {/* Render configured tabs */}
        {tabs.map((tab) => {
          const Icon = resolveIcon(tab.icon);
          return (
            <Tabs.Screen
              key={tab.id}
              name={tab.file}
              options={{
                title: tab.label,
                tabBarIcon: ({ color }) => <TabIcon Icon={Icon} color={color} />,
              }}
            />
          );
        })}

        {/* Hide screens listed in hiddenScreens (still navigable, just not in tab bar) */}
        {gasConfig.navigation.hiddenScreens.map((screen) => (
          <Tabs.Screen
            key={`hidden-${screen}`}
            name={screen}
            options={{ href: null }}
          />
        ))}

        {/* Hide the placeholder screen from the tab bar (it's a reference, not a real tab) */}
        <Tabs.Screen name="placeholder" options={{ href: null }} />
      </Tabs>
    </ErrorBoundary>
  );
}
