// App-specific types for GolfTrip Organizer.
// Do NOT re-export or shadow types already in types/index.ts (User, Notification, Bookmark, Achievement, SubscriptionState, ApiResponse, PaginatedResponse).

// ─── Enums / Literals ─────────────────────────────────────────────────────────

export type TripStatus = 'active' | 'archived' | 'draft';
export type MemberRole = 'organizer' | 'member' | 'guest';
export type RsvpStatus = 'accepted' | 'declined' | 'pending';
export type SplitType = 'equal' | 'custom' | 'percentage';
export type ExpenseCategory = 'green_fees' | 'accommodation' | 'food' | 'transport' | 'other';
export type ParseStatus = 'pending' | 'success' | 'failed' | 'manual_review';
export type OfflineMutationStatus = 'queued' | 'replayed' | 'failed';
export type SubscriptionTier = 'golftrip_free' | 'golftrip_recap_onetime' | 'golftrip_pro_annual';
export type ThemePreference = 'light' | 'dark' | 'system';
export type TeeTimeSource = 'manual' | 'email_import' | 'api';

// ─── Database Row Types ───────────────────────────────────────────────────────

/** maps to `users` table (separate from auth.users / profiles in base schema) */
export interface UserRow {
  id: string;
  email: string | null;
  phone: string | null;
  display_name: string;
  avatar_url: string | null;
  handicap: number | null;
  subscription_tier: SubscriptionTier;
  revenuecat_user_id: string | null;
  push_token: string | null;
  theme_preference: ThemePreference;
  trip_streak: number;
  total_rounds_played: number;
  avg_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface Trip {
  id: string;
  organizer_id: string;
  name: string;
  start_date: string;
  end_date: string;
  invite_code: string;
  invite_email_address: string | null;
  status: TripStatus;
  member_limit: number;
  recap_unlocked: boolean;
  recap_product_id: string | null;
  cover_image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface TripMember {
  id: string;
  trip_id: string;
  user_id: string | null;
  guest_name: string | null;
  guest_email: string | null;
  role: MemberRole;
  rsvp_status: RsvpStatus;
  days_playing: string[] | null;
  notifications_muted: boolean;
  joined_at: string;
  updated_at: string;
}

export interface TeeTime {
  id: string;
  trip_id: string;
  course_name: string;
  course_city: string | null;
  tee_date: string;
  tee_time: string;
  player_count: number;
  confirmation_number: string | null;
  source: TeeTimeSource;
  import_raw: Record<string, unknown> | null;
  player_ids: string[] | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  trip_id: string;
  category: ExpenseCategory;
  description: string;
  amount_cents: number;
  currency: string;
  paid_by_member_id: string;
  split_type: SplitType;
  split_member_ids: string[] | null;
  split_date: string | null;
  expense_date: string;
  is_settled: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ExpenseSettlement {
  id: string;
  trip_id: string;
  from_member_id: string;
  to_member_id: string;
  amount_cents: number;
  currency: string;
  is_paid: boolean;
  venmo_deeplink: string | null;
  paypal_deeplink: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface Round {
  id: string;
  trip_id: string;
  tee_time_id: string | null;
  course_name: string;
  round_date: string;
  is_complete: boolean;
  created_by: string;
  created_at: string;
}

export interface HoleScore {
  score: number;
  par: number;
  putts?: number | null;
  fairway_hit?: boolean | null;
  gir?: boolean | null;
}

export interface Score {
  id: string;
  round_id: string;
  trip_id: string;
  member_id: string;
  total_score: number | null;
  score_relative_to_par: number | null;
  hole_scores: Record<string, HoleScore> | null;
  is_verified: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  trip_id: string;
  sender_member_id: string | null;
  guest_name: string | null;
  body: string;
  thread_date: string | null;
  is_announcement: boolean;
  is_deleted: boolean;
  created_at: string;
}

export interface Announcement {
  id: string;
  trip_id: string;
  message_id: string | null;
  body: string;
  created_by: string;
  is_active: boolean;
  created_at: string;
}

export interface EmailImport {
  id: string;
  trip_id: string;
  raw_email_body: string;
  sender_email: string | null;
  parsed_course_name: string | null;
  parsed_tee_date: string | null;
  parsed_tee_time: string | null;
  parsed_player_count: number | null;
  parsed_confirmation_number: string | null;
  parse_status: ParseStatus;
  tee_time_id: string | null;
  received_at: string;
}

export interface TripRecap {
  id: string;
  trip_id: string;
  winner_member_id: string | null;
  best_round_score: number | null;
  group_avg_score: number | null;
  total_cost_per_person_cents: number | null;
  recap_image_url: string | null;
  generated_at: string | null;
  purchase_transaction_id: string | null;
  created_at: string;
}

export interface OfflineMutationQueue {
  id: string;
  user_id: string;
  trip_id: string;
  operation: string;
  table_name: string;
  payload: Record<string, unknown>;
  created_at: string;
  replayed_at: string | null;
  status: OfflineMutationStatus;
}

// ─── Composite / View Types ───────────────────────────────────────────────────

export interface TripWorkspace {
  trip: Trip;
  trip_members: TripMember[];
  tee_times: TeeTime[];
  announcements: (Announcement & { messages: Message | null })[];
  round_count: number;
}

export interface LeaderboardEntry {
  member_id: string;
  display_name: string;
  total_score: number | null;
  rounds: Array<{ course_name: string; score: number }>;
}

export interface LeaderboardStats {
  group_avg: number | null;
  low_round: number | null;
  most_birdies: number;
}

export interface SettlementView extends ExpenseSettlement {
  from_display_name?: string | null;
  to_display_name?: string | null;
}

export interface WeatherForecast {
  date: string;
  temp_max: number | null;
  temp_min: number | null;
  precipitation_mm: number | null;
  weather_code: number | null;
}

export interface SearchResults {
  trips: Pick<Trip, 'id' | 'name' | 'start_date' | 'status'>[];
  tee_times: Pick<TeeTime, 'id' | 'course_name' | 'tee_date' | 'trip_id'>[];
  members: Pick<TripMember, 'id' | 'guest_name' | 'trip_id' | 'user_id'>[];
  expenses: Pick<Expense, 'id' | 'description' | 'amount_cents' | 'trip_id'>[];
}

// ─── RevenueCat Webhook ───────────────────────────────────────────────────────

export type RevenueCatEventType =
  | 'INITIAL_PURCHASE'
  | 'RENEWAL'
  | 'CANCELLATION'
  | 'EXPIRATION'
  | 'PRODUCT_CHANGE';

export interface RevenueCatWebhookPayload {
  event: {
    type: RevenueCatEventType;
    app_user_id: string;
    product_id: SubscriptionTier;
    period_type?: string | null;
    purchased_at_ms?: number | null;
    expiration_at_ms?: number | null;
    transaction_id?: string | null;
  };
}

// ─── Formatted Display Helpers ────────────────────────────────────────────────

/** Safe formatter: guards nulls returned from DB numeric columns */
export function formatHandicap(value: number | null | undefined): string {
  return value != null ? (value ?? 0).toFixed(1) : '--';
}

export function formatAvgScore(value: number | null | undefined): string {
  return value != null ? (value ?? 0).toFixed(2) : '--';
}

export function formatGroupAvg(value: number | null | undefined): string {
  return value != null ? (value ?? 0).toFixed(1) : '--';
}

export function centsToDisplay(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}
