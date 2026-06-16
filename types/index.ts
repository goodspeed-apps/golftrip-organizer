/**
 * GAS Template — Base Type Definitions
 *
 * These types are common to all apps. The DevAgent extends this file
 * with app-specific domain types (e.g., Thread, Subreddit, Workout, Recipe).
 */

// ─── User & Profile ───────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  subscription_tier: string;
  onboarding_completed: boolean;
  notification_preferences: Record<string, boolean>;
  theme_preference: 'system' | 'dark' | 'light';
  push_token: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Notifications ────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

// ─── Bookmarks ────────────────────────────────────────────────────────────────

export interface Bookmark {
  id: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  notes: string | null;
  created_at: string;
}

// ─── Gamification ─────────────────────────────────────────────────────────────

export interface Achievement {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon_name: string;
  category: string;
  created_at: string;
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_slug: string;
  unlocked_at: string;
}

// ─── Subscription ─────────────────────────────────────────────────────────────

export type SubscriptionTier = string; // Defined by gasConfig.features.inAppPurchases.tiers

export interface SubscriptionState {
  tier: SubscriptionTier;
  isTrialing: boolean;
  trialEndsAt: string | null;
  isPaid: boolean;
  isLoading: boolean;
}

// ─── Payment Models ──────────────────────────────────────────────────────────

export type TransactionType =
  | 'subscription'
  | 'one_time'
  | 'credit_purchase'
  | 'credit_spend'
  | 'credit_grant'
  | 'marketplace_purchase'
  | 'marketplace_payout'
  | 'marketplace_refund';

export type TransactionStatus =
  | 'pending'
  | 'completed'
  | 'failed'
  | 'refunded'
  | 'disputed';

export interface Transaction {
  id: string;
  user_id: string;
  type: TransactionType;
  status: TransactionStatus;
  amount_cents: number;
  currency: string;
  product_id: string | null;
  credits_amount: number | null;
  marketplace_listing_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ─── Credits ─────────────────────────────────────────────────────────────────

export interface CreditBalance {
  user_id: string;
  balance: number;
  lifetime_earned: number;
  lifetime_spent: number;
  updated_at: string;
}

export interface CreditLedgerEntry {
  id: string;
  user_id: string;
  amount: number;
  balance_after: number;
  reason: string;
  reference_id: string | null;
  created_at: string;
}

// ─── One-Time Purchases ──────────────────────────────────────────────────────

export interface OwnedProduct {
  id: string;
  user_id: string;
  product_id: string;
  purchased_at: string;
  transaction_id: string | null;
}

// ─── Marketplace ─────────────────────────────────────────────────────────────

export type ListingStatus =
  | 'draft'
  | 'pending_approval'
  | 'active'
  | 'sold'
  | 'cancelled'
  | 'suspended';

export interface MarketplaceListing {
  id: string;
  seller_id: string;
  title: string;
  description: string;
  category: string;
  price_cents: number;
  currency: string;
  status: ListingStatus;
  images: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'delivered'
  | 'completed'
  | 'refunded'
  | 'disputed';

export interface MarketplaceOrder {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  amount_cents: number;
  platform_fee_cents: number;
  seller_payout_cents: number;
  currency: string;
  status: OrderStatus;
  stripe_payment_intent_id: string | null;
  created_at: string;
  updated_at: string;
}

// ─── API Helpers ──────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  hasMore: boolean;
}

// ─── Push Tokens ──────────────────────────────────────────────────────────────

export interface PushToken {
  id: string;
  user_id: string;
  token: string;
  platform: 'ios' | 'android';
  created_at: string;
}
