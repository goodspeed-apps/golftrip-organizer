export type Trip = {
  id: string;
  organizer_id: string;
  name: string;
  start_date: string;
  end_date: string;
  invite_code: string | null;
  invite_email_address: string | null;
  status: 'planning' | 'confirmed' | 'completed' | 'archived';
  member_limit: number | null;
  recap_unlocked: boolean;
  recap_product_id: string | null;
  cover_image_url: string | null;
  created_at: string;
  updated_at: string;
};

export type TripMember = {
  id: string;
  trip_id: string;
  user_id: string | null;
  guest_name: string | null;
  guest_email: string | null;
  role: 'organizer' | 'member' | 'guest';
  rsvp_status: 'pending' | 'accepted' | 'declined';
  days_playing: string[] | null;
  notifications_muted: boolean;
  joined_at: string | null;
  updated_at: string;
};

export type TeeTime = {
  id: string;
  trip_id: string;
  course_name: string;
  course_city: string | null;
  tee_date: string;
  tee_time: string;
  player_count: number;
  confirmation_number: string | null;
  source: string | null;
  player_ids: string[] | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type Expense = {
  id: string;
  trip_id: string;
  category: string;
  description: string;
  amount_cents: number;
  currency: string;
  paid_by_member_id: string;
  split_type: 'equal' | 'custom' | 'solo';
  split_member_ids: string[] | null;
  expense_date: string;
  is_settled: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type TripWithMemberCount = Trip & {
  member_count: number;
  my_rsvp: TripMember['rsvp_status'] | null;
};
