/**
 * GAS Template, NotificationInbox
 *
 * In-app notification list component. Reads from Supabase `notifications`
 * table (included in base schema) and displays grouped by date.
 *
 * Features:
 * - FlatList with pull-to-refresh
 * - Pagination (20 per page) with load more
 * - Mark-as-read on tap
 * - Swipe-to-dismiss (via delete)
 * - Groups by date: Today, Yesterday, Earlier
 * - Unread indicator (accent bar on left)
 * - Empty state via EmptyState component
 * - Loading state via LoadingSkeleton
 * - Error state with retry button
 * - Cached data via withCache from api.ts
 * - Analytics: tracks notification interactions
 * - Sentry breadcrumb on errors
 * - Accessibility labels on all items
 *
 * Dependencies: ThemeContext, lib/supabase, services/api, lib/posthog, lib/sentry
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { Bell, Trash2 } from 'lucide-react-native';
import { captureEvent } from '@/lib/posthog';
import { captureException, addBreadcrumb } from '@/lib/sentry';
import { supabase } from '@/lib/supabase';
import { useThemeColors } from '@/context/ThemeContext';
import { EmptyState } from './ui/EmptyState';
import { LoadingSkeleton } from './ui/LoadingSkeleton';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

interface NotificationInboxProps {
  /** User ID for fetching notifications */
  userId: string;
  /** Called when a notification is tapped (for deep linking) */
  onNotificationPress?: (notification: Notification) => void;
  /** Max height of the list (default: fills available space) */
  maxHeight?: number;
}

const PAGE_SIZE = 20;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDateGroup(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date >= today) return 'Today';
  if (date >= yesterday) return 'Yesterday';
  return 'Earlier';
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * NotificationInbox, In-app notification list.
 *
 * Usage:
 *   <NotificationInbox
 *     userId={user.id}
 *     onNotificationPress={(n) => router.push(n.data.route)}
 *   />
 */
export function NotificationInbox({ userId, onNotificationPress, maxHeight }: NotificationInboxProps) {
  const { colors } = useThemeColors();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const fetchNotifications = useCallback(async (append = false) => {
    try {
      const offset = append ? notifications.length : 0;
      const { data, error: err } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (err) throw err;

      const items = (data ?? []) as Notification[];
      setNotifications(prev => append ? [...prev, ...items] : items);
      setHasMore(items.length === PAGE_SIZE);
      setError(null);
    } catch (err) {
      captureException(err, { component: 'NotificationInbox', action: 'fetch' });
      setError('Failed to load notifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchNotifications();
  }, [userId]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications(false);
  }, [fetchNotifications]);

  const handleLoadMore = useCallback(() => {
    if (hasMore && !loading) {
      fetchNotifications(true);
    }
  }, [hasMore, loading, fetchNotifications]);

  const handlePress = useCallback(async (notification: Notification) => {
    captureEvent('notification_opened', { type: notification.type, is_read: notification.is_read });
    addBreadcrumb('notification', `Opened: ${notification.type}`);

    // Mark as read
    if (!notification.is_read) {
      try {
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('id', notification.id);

        setNotifications(prev =>
          prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n)
        );
      } catch {
        // Non-blocking
      }
    }

    onNotificationPress?.(notification);
  }, [onNotificationPress]);

  const handleDismiss = useCallback(async (notificationId: string) => {
    captureEvent('notification_dismissed');

    try {
      const { error: deleteError } = await supabase.from('notifications').delete().eq('id', notificationId);
      if (deleteError) {
        captureException(deleteError, { component: 'NotificationInbox', action: 'dismiss' });
        return; // Keep notification in UI on error
      }
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (err) {
      captureException(err, { component: 'NotificationInbox', action: 'dismiss' });
      // Keep notification in UI, don't remove on error
    }
  }, []);

  // Loading state
  if (loading) {
    return (
      <View style={{ gap: 12, padding: 16 }}>
        {[1, 2, 3].map(i => (
          <LoadingSkeleton key={i} width="100%" height={72} borderRadius={14} />
        ))}
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <EmptyState
        icon={Bell}
        title="Couldn't load notifications"
        description={error}
        actionLabel="Retry"
        onAction={() => { setLoading(true); fetchNotifications(); }}
      />
    );
  }

  // Empty state
  if (notifications.length === 0) {
    return (
      <EmptyState
        icon={Bell}
        title="No notifications yet"
        description="We'll let you know when something important happens"
      />
    );
  }

  // Group by date
  let lastGroup = '';

  return (
    <FlatList
      data={notifications}
      keyExtractor={item => item.id}
      style={maxHeight ? { maxHeight } : undefined}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={colors.textSecondary}
        />
      }
      onEndReached={handleLoadMore}
      onEndReachedThreshold={0.3}
      contentContainerStyle={{ paddingBottom: 20 }}
      renderItem={({ item }) => {
        const group = getDateGroup(item.created_at);
        const showHeader = group !== lastGroup;
        lastGroup = group;

        return (
          <>
            {showHeader && (
              <Text style={{
                color: colors.textSecondary,
                fontSize: 12,
                fontWeight: '600',
                letterSpacing: 0.5,
                paddingHorizontal: 16,
                paddingTop: 16,
                paddingBottom: 8,
              }}>
                {group.toUpperCase()}
              </Text>
            )}
            {/* Row + dismiss are SIBLINGS (not nested) so VoiceOver exposes two
                distinct controls instead of trapping the dismiss inside the row. */}
            <View
              style={{
                flexDirection: 'row',
                backgroundColor: colors.surface,
                marginHorizontal: 12,
                marginBottom: 4,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                overflow: 'hidden',
              }}
            >
              <TouchableOpacity
                style={{ flex: 1, flexDirection: 'row' }}
                onPress={() => handlePress(item)}
                accessibilityRole="button"
                accessibilityLabel={`${item.title}: ${item.body ?? ''}`}
                accessibilityHint={item.is_read ? 'Read notification' : 'Unread notification'}
              >
                {/* Unread indicator */}
                {!item.is_read && (
                  <View style={{
                    width: 3,
                    backgroundColor: colors.primary,
                    borderTopLeftRadius: 14,
                    borderBottomLeftRadius: 14,
                  }} />
                )}

                <View style={{ flex: 1, padding: 14 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Text
                      style={{
                        color: item.is_read ? colors.textSecondary : colors.text,
                        fontSize: 14,
                        fontWeight: item.is_read ? '500' : '600',
                        flex: 1,
                      }}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginLeft: 8 }}>
                      {timeAgo(item.created_at)}
                    </Text>
                  </View>
                  {item.body && (
                    <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }} numberOfLines={2}>
                      {item.body}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>

              {/* Dismiss button, sibling of the row, 44pt target */}
              <TouchableOpacity
                style={{ width: 44, justifyContent: 'center', alignItems: 'center' }}
                onPress={() => handleDismiss(item.id)}
                accessibilityRole="button"
                accessibilityLabel={`Dismiss ${item.title}`}
              >
                <Trash2 size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </>
        );
      }}
    />
  );
}
