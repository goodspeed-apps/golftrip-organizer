// supabase/functions/_shared/expo-push.ts
// Shared Expo Push API constants used by send_push and check_push_receipts.

export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
export const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
export const EXPO_PUSH_BATCH_SIZE = 100;
