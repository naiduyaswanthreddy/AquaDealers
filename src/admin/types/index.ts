/* ──────────────────────────────────────────────
   AquaDealer Admin Portal — Type Definitions
   Mirrors admin-specific Supabase/PostgreSQL schema.
   ────────────────────────────────────────────── */

export type AdminRole = 'super_admin' | 'support' | 'sales';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  password_hash?: string; // never sent to frontend
  role: AdminRole;
  is_active: boolean;
  two_factor_enabled: boolean;
  two_factor_secret?: string;
  last_login_at: string | null;
  last_login_ip: string | null;
  created_at: string;
  created_by: string | null;
}

export interface AdminSession {
  id: string;
  admin_id: string;
  token_hash: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
}

export interface AdminAuditEntry {
  id: number;
  admin_id: string | null;
  admin_email: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  target_name: string | null;
  details: Record<string, any> | null;
  ip_address: string | null;
  user_agent: string | null;
  performed_at: string;
}

export interface PlanDefinition {
  id: string;
  name: string;
  display_name: string;
  price_monthly: number;
  price_annual: number | null;
  farmer_limit: number | null;
  bill_limit: number | null;
  branch_limit: number;
  staff_login_limit: number;
  features: Record<string, boolean>;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export type SubscriptionStatus = 'active' | 'expired' | 'cancelled' | 'suspended' | 'trial';
export type BillingCycle = 'monthly' | 'annual' | 'manual';

export interface DealerSubscription {
  id: string;
  dealer_id: string;
  plan_id: string | null;
  plan_name: string;
  start_date: string;
  end_date: string;
  status: SubscriptionStatus;
  billing_cycle: BillingCycle;
  amount_paid: number | null;
  payment_method: string | null;
  razorpay_payment_id: string | null;
  notes: string | null;
  auto_renew: boolean;
  granted_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionPayment {
  id: string;
  dealer_id: string;
  subscription_id: string | null;
  amount: number;
  currency: string;
  payment_date: string;
  payment_method: string;
  razorpay_payment_id: string | null;
  razorpay_order_id: string | null;
  status: 'success' | 'failed' | 'refunded' | 'pending';
  receipt_url: string | null;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
}

export interface OnboardingProgress {
  id: string;
  dealer_id: string;
  step_1_shop_details_at: string | null;
  step_2_language_at: string | null;
  step_3_first_product_at: string | null;
  step_4_first_farmer_at: string | null;
  step_5_first_bill_at?: string | null;
  step_5_set_pin_at: string | null;
  completed_at: string | null;
  nudge_sent_at: string | null;
  nudge_count: number;
  stuck_since: string | null;
  assigned_to: string | null;
  notes: string | null;
  created_at: string;
}

export type TicketCategory = 'billing' | 'technical' | 'onboarding' | 'feature' | 'complaint' | 'general';
export type TicketPriority = 'urgent' | 'high' | 'normal' | 'low';
export type TicketStatus = 'open' | 'in_progress' | 'waiting_dealer' | 'resolved' | 'closed';

export interface SupportTicket {
  id: string;
  dealer_id: string | null;
  dealer_phone: string | null;
  dealer_name: string | null;
  subject: string;
  message: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  admin_reply?: string;
  assigned_to: string | null;
  first_response_at: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  satisfaction_score: number | null;
  created_at: string;
  updated_at: string;
  dealers?: {
    name: string;
    shop_name: string;
    phone: string;
  };
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_type: 'dealer' | 'admin' | 'system';
  sender_id: string | null;
  sender_name: string;
  message: string;
  attachments: Array<{ url: string; filename: string; size: number }>;
  is_internal: boolean;
  created_at: string;
}

export type BroadcastSegment = 'all' | 'trial' | 'basic' | 'pro' | 'expiring_7days' | 'inactive_30days' | 'onboarding_stuck' | 'specific_dealers' | 'district' | 'state';
export type BroadcastChannel = 'in_app' | 'whatsapp' | 'both';
export type BroadcastStatus = 'draft' | 'scheduled' | 'sent' | 'failed';

export interface BroadcastMessage {
  id: string;
  admin_id: string | null;
  title: string;
  message: string;
  message_te: string | null;
  message_hi: string | null;
  target_segment: BroadcastSegment;
  target_dealer_ids: string[] | null;
  target_district: string | null;
  target_state: string | null;
  channel: BroadcastChannel;
  scheduled_at: string | null;
  sent_at: string | null;
  delivery_count: number;
  read_count: number;
  status: BroadcastStatus;
  created_at: string;
  admin?: {
    name: string;
  };
}

export interface DealerNotification {
  id: string;
  dealer_id: string;
  broadcast_id: string | null;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'upgrade' | 'system';
  is_read: boolean;
  read_at: string | null;
  action_url: string | null;
  created_at: string;
}

export interface ImpersonationSession {
  id: string;
  admin_id: string;
  dealer_id: string;
  token_hash: string;
  started_at: string;
  expires_at: string;
  ended_at: string | null;
  reason: string;
}

export interface PlatformMetrics {
  id: string;
  date: string;
  total_dealers: number;
  active_dealers: number;
  trial_dealers: number;
  basic_dealers: number;
  pro_dealers: number;
  expired_dealers: number;
  new_signups: number;
  churned: number;
  total_bills_today: number;
  total_bill_value_today: number;
  mrr: number;
  arr: number;
  created_at: string;
}

export interface DealerActivityEntry {
  id: number;
  dealer_id: string;
  event_type: string;
  metadata: Record<string, any> | null;
  ip_address: string | null;
  device_info: string | null;
  created_at: string;
}

export interface FeatureChangelog {
  id: string;
  version: string;
  title: string;
  description: string;
  type: 'feature' | 'fix' | 'improvement' | 'breaking';
  affects_plans: string[] | null;
  published_at: string | null;
  is_published: boolean;
  created_by: string | null;
  created_at: string;
}

export interface FeatureFlag {
  id: string;
  name: string;
  description: string | null;
  is_enabled_global: boolean;
  enabled_dealer_ids: string[];
  enabled_plans: string[];
  created_at: string;
  updated_at: string;
}

// ─── Computed / UI types ───

export interface AdminDealerListItem {
  id: string;
  name: string;
  shop_name: string;
  phone: string;
  email: string | null;
  district: string | null;
  state: string;
  plan: string;
  plan_expires_at: string | null;
  is_active: boolean;
  created_at: string;
  // computed
  farmer_count?: number;
  bill_count_30d?: number;
  last_activity_at?: string | null;
  onboarding_pct?: number;
  subscription_days_remaining?: number;
  custom_features?: string[];
}

export interface AdminNavItem {
  path: string;
  label: string;
  icon: string;
  requiresRole?: AdminRole;
  badge?: number;
}
