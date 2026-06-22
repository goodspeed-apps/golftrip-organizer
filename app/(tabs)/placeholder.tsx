/**
 * GAS Template, Placeholder Tab Screen
 *
 * REFERENCE IMPLEMENTATION for the DevAgent.
 *
 * This file demonstrates the standard patterns for building a tab screen:
 * - SafeAreaView from 'react-native-safe-area-context' (NOT from 'react-native')
 * - useThemeColors() for all color values
 * - useAnalytics() for screen view tracking
 * - VirtualList (FlashList-backed) with pull-to-refresh, generated list
 *   screens inherit virtualization instead of plain RN FlatList
 * - EmptyState component for when there's no data
 * - LoadingSkeleton for loading states
 * - HelpButton in the header
 * - Proper null guards on numeric DB values (value ?? 0)
 *
 * This screen is hidden from the tab bar via _layout.tsx.
 * The DevAgent uses this as a blueprint when generating app-specific tab screens.
 *
 * DO NOT import this file in production. It exists purely as a code reference.
 *
 * Dependencies:
 *   hooks: useAnalytics, useAuth
 *   context: ThemeContext
 *   components: EmptyState, LoadingSkeleton, HelpButton
 */

import { useEffect, useState, useCallback } from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Inbox } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useAuth } from '@/hooks/useAuth';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { HelpButton } from '@/components/HelpButton';
import { VirtualList } from '@/components/VirtualList';
import { gasConfig } from '../../gas.config';

// ─── Types ────────────────────────────────────────────────────────────────────
// Define your data type here. The DevAgent replaces this with actual schema types.

interface PlaceholderItem {
  id: string;
  title: string;
  description: string;
  score: number | null; // IMPORTANT: DB values can be null, always guard with ?? 0
  createdAt: string;
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────
// Shows while data is being fetched. Renders a few skeleton rows.

function SkeletonList() {
  const { colors } = useThemeColors();
  return (
    <View style={{ padding: 16 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <View
          key={i}
          style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 16,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <LoadingSkeleton width={180} height={18} borderRadius={4} />
          <LoadingSkeleton
            width="100%"
            height={14}
            borderRadius={4}
            style={{ marginTop: 8 }}
          />
          <LoadingSkeleton
            width="60%"
            height={14}
            borderRadius={4}
            style={{ marginTop: 4 }}
          />
        </View>
      ))}
    </View>
  );
}

// ─── List Item ────────────────────────────────────────────────────────────────
// Individual row in the FlatList. Uses inline styles (not NativeWind)
// for production reliability.

function ItemCard({ item }: { item: PlaceholderItem }) {
  const { colors } = useThemeColors();
  const primary = gasConfig.design.colors.primary;

  // IMPORTANT: Null guard on numeric values from the database.
  // Supabase can return null for unscored rows even if TypeScript says `number`.
  // Always use (value ?? 0) before .toFixed(), arithmetic, or display.
  const safeScore = (item.score ?? 0).toFixed(0);

  // Color-code the score: green >= 70, amber >= 50, grey < 50
  const scoreNum = item.score ?? 0;
  const scoreColor =
    scoreNum >= 70
      ? gasConfig.design.colors.success
      : scoreNum >= 50
        ? gasConfig.design.colors.warning
        : colors.textSecondary;

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 18,
        padding: 16,
        marginHorizontal: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      {/* Title row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text
          style={{ color: colors.text, fontSize: 16, fontWeight: '700', flex: 1, marginRight: 8 }}
          numberOfLines={1}
        >
          {item.title}
        </Text>
        {/* Score badge */}
        <View
          style={{
            backgroundColor: scoreColor + '18',
            borderRadius: 8,
            paddingHorizontal: 8,
            paddingVertical: 3,
          }}
        >
          <Text style={{ color: scoreColor, fontSize: 12, fontWeight: '700' }}>{safeScore}</Text>
        </View>
      </View>

      {/* Description */}
      <Text
        style={{ color: colors.textSecondary, fontSize: 13, marginTop: 6, lineHeight: 18 }}
        numberOfLines={2}
      >
        {item.description}
      </Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function PlaceholderScreen() {
  const { colors } = useThemeColors();
  const { track } = useAnalytics();
  const { user } = useAuth();

  // --- State ---
  const [items, setItems] = useState<PlaceholderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // --- Analytics: track screen view on mount ---
  useEffect(() => {
    track('screen_view', { screen: 'placeholder' });
  }, []);

  // --- Data fetching ---
  // The DevAgent replaces this with actual Supabase queries.
  const fetchData = useCallback(async () => {
    try {
      // TODO: Replace with actual data fetch from Supabase
      // Example:
      //   const { data, error } = await supabase
      //     .from('items')
      //     .select('*')
      //     .eq('user_id', user?.id)
      //     .order('created_at', { ascending: false });
      //   if (error) throw error;
      //   setItems(data ?? []);

      // Simulated empty state for template
      setItems([]);
    } catch (e) {
      console.error('[PlaceholderScreen] Failed to fetch data:', e);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Fetch on mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- Pull-to-refresh handler ---
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
    track('pull_to_refresh', { screen: 'placeholder' });
  }, [fetchData, track]);

  // --- Loading state ---
  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 }}>
          <Text style={{ color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 }}>
            Placeholder
          </Text>
        </View>
        <SkeletonList />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: 8,
        }}
      >
        <Text style={{ color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 }}>
          Placeholder
        </Text>
        {/* Help button, positioned top-right of the header */}
        <HelpButton />
      </View>

      {/* List or empty state, VirtualList (FlashList-backed) so generated
          list screens inherit virtualization for long datasets. */}
      <VirtualList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ItemCard item={item} />}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={
          <EmptyState
            icon={Inbox}
            title="No items yet"
            description="Items will appear here once you add them. Pull down to refresh."
            actionLabel="Get Started"
            onAction={() => {
              // TODO: DevAgent connects to the relevant action
              track('empty_state_cta_tapped', { screen: 'placeholder' });
            }}
          />
        }
      />
    </SafeAreaView>
  );
}
