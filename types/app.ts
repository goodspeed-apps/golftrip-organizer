// App-specific types for GolfTrip Organizer
// Base types (User, Notification, Bookmark, Achievement, SubscriptionState,
// ApiResponse, PaginatedResponse) live in types/index.ts — not duplicated here.

// ─── Database Row Types ───────────────────────────────────────────────────────

export interface GolfTripUser {
  id: string;
  email: string | null;
  phone: string | null;
  display_name: string;
  avatar_url: string | null;
  handicap: number | null;
  subscription_tier: string;
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

export type TripStatus = 'draft' | 'active' | 'complete' | 'archived';

export interface TripMember {
  id: string;
  trip_id: string;
  user_id: string | null;
  guest_name: string | null;
  guest_email: string | null;
  role: TripMemberRole;
  rsvp_status: RsvpStatus;
  days_playing: string[] | null;
  notifications_muted: boolean;
  joined_at: string;
  updated_at: string;
}

export type TripMemberRole = 'organizer' | 'member' | 'guest';
export type RsvpStatus = 'pending' | 'accepted' | 'declined' | 'maybe';

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

export type TeeTimeSource = 'manual' | 'email_import' | 'api';

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

export type ExpenseCategory = 'greens_fees' | 'cart' | 'food' | 'lodging' | 'transport' | 'other';
export type SplitType = 'equal' | 'custom' | 'solo';

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
  hole_scores: HoleScores | null;
  is_verified: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type HoleScores = Record<string, number | null>;

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
  parse_status: EmailParseStatus;
  tee_time_id: string | null;
  received_at: string;
}

export type EmailParseStatus = 'pending' | 'success' | 'failed' | 'review_needed';

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

export type OfflineMutationStatus = 'pending' | 'replaying' | 'success' | 'failed';

// ─── Composite / API Response Types ───────────────────────────────────────────

export interface UpcomingPastTrips {
  upcoming: Trip[];
  past: Trip[];
}

export interface TripWorkspace {
  id: string;
  organizer_id: string;
  name: string;
  start_date: string;
  end_date: string;
  invite_code: string;
  status: TripStatus;
  member_limit: number;
  recap_unlocked: boolean;
  cover_image_url: string | null;
  trip_members: TripMemberWithScore[];
  tee_times: TeeTime[];
  announcements: AnnouncementWithMessage[];
  rounds: Pick<Round, 'id' | 'is_complete' | 'round_date'>[];
}

export interface TripMemberWithScore extends TripMember {
  scores: Pick<Score, 'total_score'>[];
}

export interface AnnouncementWithMessage extends Announcement {
  messages: Pick<Message, 'body' | 'created_at'> | null;
}

export interface ExpensesAndSettlements {
  expenses: Expense[];
  settlements: ExpenseSettlement[];
}

export interface LeaderboardStanding {
  memberId: string;
  total: number;
}

export interface TripStats {
  groupAvg: number | null;
  lowRound: number | null;
}

export interface Leaderboard {
  standings: LeaderboardStanding[];
  roundBreakdowns: Score[];
  stats: TripStats;
  hasNewLeader?: boolean;
}

export interface PaginatedMessages {
  messages: Message[];
  total: number;
  page: number;
}

export interface WeatherForecast {
  date: string;
  weathercode: number;
  temp_max: number | null;
  temp_min: number | null;
  precipitation_sum: number | null;
}

export interface SearchResults {
  trips: Pick<Trip, 'id' | 'name' | 'start_date' | 'status'>[];
  teeTimes: Pick<TeeTime, 'id' | 'trip_id' | 'course_name' | 'tee_date'>[];
  expenses: Pick<Expense, 'id' | 'trip_id' | 'description' | 'amount_cents' | 'category'>[];
}

// ─── Mutation Payload Types ───────────────────────────────────────────────────

export interface UpsertTeeTimePayload {
  id?: string;
  trip_id: string;
  course_name: string;
  course_city?: string | null;
  tee_date: string;
  tee_time: string;
  player_count: number;
  confirmation_number?: string | null;
  notes?: string | null;
  player_ids?: string[] | null;
}

export interface UpsertExpensePayload {
  id?: string;
  trip_id: string;
  category: ExpenseCategory;
  description: string;
  amount_cents: number;
  currency: string;
  paid_by_member_id: string;
  split_type: SplitType;
  split_member_ids?: string[] | null;
  expense_date: string;
}

export interface SubmitScoresPayload {
  trip_id: string;
  round_id: string;
  scores: {
    member_id: string;
    total_score: number;
    score_relative_to_par?: number | null;
    hole_scores?: HoleScores | null;
  }[];
}

export interface CreateTripPayload {
  name: string;
  start_date: string;
  end_date: string;
  member_limit: number;
  cover_image_url?: string | null;
}

export interface CreateTripResult {
  trip: Trip;
  invite_link: string;
  invite_code: string;
}

export interface JoinTripPayload {
  invite_code: string;
  guest_name?: string | null;
  guest_email?: string | null;
  rsvp_status?: RsvpStatus;
}

export interface JoinTripResult {
  trip_member: TripMember;
  trip: Pick<Trip, 'id' | 'name' | 'start_date' | 'end_date'>;
}

export interface RecapCardResult {
  recap_image_url: string;
  trip_recap: TripRecap;
}

// ─── Subscription / Entitlement ───────────────────────────────────────────────

export type GolfTripProductId =
  | 'golftrip_free'
  | 'golftrip_recap_onetime'
  | 'golftrip_pro_annual';

export type RevenueCatEventType =
  | 'INITIAL_PURCHASE'
  | 'RENEWAL'
  | 'CANCELLATION'
  | 'EXPIRATION';

export interface RevenueCatWebhookPayload {
  event: {
    type: RevenueCatEventType;
    app_user_id: string;
    product_id: GolfTripProductId;
    purchased_at_ms: number;
    expiration_at_ms: number | null;
  };
}

// ─── Notification Types ────────────────────────────────────────────────────────

export type GolfTripNotificationType =
  | 'tee_time_added'
  | 'tee_time_updated'
  | 'new_member_joined'
  | 'expense_updated'
  | 'score_submitted'
  | 'new_leader'
  | 'new_announcement'
  | 'recap_ready';

export interface PushNotificationPayload {
  trip_id: string;
  member_ids: string[];
  notification_type: GolfTripNotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}
