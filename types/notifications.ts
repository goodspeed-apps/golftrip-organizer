/**
 * GAS Template — Notification category types
 *
 * Shared between the React Native client (services/push.ts) and the
 * send_push edge function (supabase/functions/send_push/handler.ts).
 */

export const NOTIFICATION_CATEGORIES = ['transactional', 'product', 'marketing'] as const;
export type NotificationCategory = typeof NOTIFICATION_CATEGORIES[number];
