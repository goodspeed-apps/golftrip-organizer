import { User } from '@/types';

export interface Trip {
  id: string;
  organizer_id: string;
  name: string;
  start_date: string;
  end_date: string;
  invite_code: string | null;
  invite_email_address: string | null;
  status: 'draft' | 'active' | 'completed' | 'archived';
  member_limit: number | null;
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
  role: 'organizer' | 'member';
  rsvp_status: 'pending' | 'accepted' | 'declined';
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
  source: string | null;
  import_raw: string | null;
  player_ids: string[] | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  trip_id: string;
  category: string;
  description: string;
  amount_cents: number;
  currency: string;
  paid_by_member_id: string;
  split_type: 'equal' | 'custom' | 'solo';
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
  hole_scores: number[] | null;
  is_verified: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  trip_id: string;
  sender_member_id: string;
  guest_name: string | null;
  body: string;
  thread_date: string;
  is_announcement: boolean;
  is_deleted: boolean;
  created_at: string;
}

export interface TripWithMemberCount extends Trip {
  member_count: number;
  days_until: number;
}

export type CategoryIcon = 'golf' | 'hotel' | 'utensils' | 'car' | 'beer' | 'trophy' | 'other';
