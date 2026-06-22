/**
 * GolfTrip Organizer — App-specific types.
 * Extends the GAS Template types/index.ts — do NOT re-declare types already there.
 */

// ─── Enums / Union Types ──────────────────────────────────────────────────────

export type TripStatus = 'draft' | 'active' | 'completed' | 'archived';
export type MemberRole = 'organizer' | 'member' | 'guest';
export type RsvpStatus = 'pending' | 'accepted' | 'declined' | 'maybe';
export type SplitType = 'equal' | 'custom' | 'percentage' | 'shares';
export type TeeTimeSource = 'manual' | 'email_import' | 'api';
export type ParseStatus = 'pending' | 'success' | 'failed' | 'review_required';
export type SubscriptionTier = 'golftrip_free' | 'golftrip_recap_onetime' | 'golftrip_pro_annual';
export type OfflineMutationStatus = 'pending' | 'replayed' | 'failed';
export type ExpenseCategory =
  | 'green_fees'
  | 'cart'
  | 'accommodation'
  | 'food_beverage'
  | 'transport'
  | 'other';

// ─── Supabase Row Types ───────────────────────────────────────────────────────

export interface GolfUser {
  id: string;
  email: string | null;
  phone: string | null;
  display_name: string;
  avatar_url: string | null;
  handicap: number | null;
  subscription_tier: SubscriptionTier;
  revenuecat_user_id: string | null;
  push_token: string | null;
  theme_preference: string;
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

export interface Score {
  id: string;
  round_id: string;
  trip_id: string;
  member_id: string;
  total_score: number | null;
  score_relative_to_par: number | null;
  hole_scores: Record<string, number> | null;
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
  members: TripMember[];
  tee_times: TeeTime[];
  announcements: Announcement[];
  round_count: number;
}

export interface LeaderboardEntry {
  member_id: string;
  total_score: number;
  rounds: Score[];
  score_display: string;
}

export interface TripStats {
  group_avg: number;
  low_round: number;
  total_rounds: number;
}

export interface SettlementBalance {
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

export interface WeatherForecast {
  date: string;
  weathercode: number;
  temp_max: number;
  temp_min: number;
  precipitation_mm: number;
}

export interface SearchResults {
  trips: Pick<Trip, 'id' | 'name' | 'start_date' | 'status'>[];
  expenses: Pick<Expense, 'id' | 'description' | 'amount_cents' | 'trip_id'>[];
  members: Pick<TripMember, 'id' | 'trip_id' | 'guest_name' | 'user_id'>[];
}

// ─── Insert / Update Helpers ──────────────────────────────────────────────────

export type TripInsert = Omit<Trip, 'id' | 'created_at' | 'updated_at' | 'invite_code'>;
export type TripUpdate = Partial<Omit<Trip, 'id' | 'organizer_id' | 'created_at'>>;

export type TripMemberInsert = Omit<TripMember, 'id' | 'joined_at' | 'updated_at'>;
export type TripMemberUpdate = Partial<Pick<TripMember, 'rsvp_status' | 'notifications_muted' | 'days_playing'>>;

export type TeeTimeInsert = Omit<TeeTime, 'id' | 'created_at' | 'updated_at'>;
export type TeeTimeUpdate = Partial<Omit<TeeTime, 'id' | 'trip_id' | 'created_by' | 'created_at'>>;

export type ExpenseInsert = Omit<Expense, 'id' | 'created_at' | 'updated_at'>;
export type ExpenseUpdate = Partial<Omit<Expense, 'id' | 'trip_id' | 'created_by' | 'created_at'>>;

export type ScoreInsert = Omit<Score, 'id' | 'created_at' | 'updated_at'>;
export type ScoreUpdate = Partial<Pick<Score, 'total_score' | 'score_relative_to_par' | 'hole_scores' | 'is_verified'>>;

export type MessageInsert = Omit<Message, 'id' | 'created_at'>;
export type RoundInsert = Omit<Round, 'id' | 'created_at'>;

// ─── RevenueCat / Entitlements ────────────────────────────────────────────────

export interface RevenueCatWebhookEvent {
  event: 'INITIAL_PURCHASE' | 'RENEWAL' | 'CANCELLATION' | 'EXPIRATION' | 'NON_RENEWING_PURCHASE';
  app_user_id: string;
  product_id: string;
  transaction_id: string | null;
  expires_at: string | null;
}

export interface EntitlementState {
  tier: SubscriptionTier;
  is_pro: boolean;
  has_recap: boolean;
  hole_by_hole_entry: boolean;
}

export function resolveEntitlements(tier: SubscriptionTier): EntitlementState {
  return {
    tier,
    is_pro: tier === 'golftrip_pro_annual',
    has_recap: tier === 'golftrip_recap_onetime' || tier === 'golftrip_pro_annual',
    hole_by_hole_entry: tier === 'golftrip_pro_annual',
  };
}

// ─── Score Display Helpers ────────────────────────────────────────────────────

/** Null-guarded score display — DB returns null for unscored rows */
export function formatScore(score: number | null): string {
  if (score === null) return '–';
  return score.toString();
}

export function formatAvgScore(avg: number | null): string {
  return (avg ?? 0).toFixed(1);
}

export function formatGroupAvg(avg: number | null): string {
  return (avg ?? 0).toFixed(2);
}

export function formatAmountCents(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}
