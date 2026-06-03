-- ═══════════════════════════════════════════════════════════════
-- AquaDealer Admin Portal — Database Schema Extension
-- Migration 004: Admin tables (service role only, RLS USING false)
-- ═══════════════════════════════════════════════════════════════

-- ═══ admin_users ═══
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'support'
    CHECK (role IN ('super_admin', 'support', 'sales')),
  is_active BOOLEAN DEFAULT true,
  two_factor_enabled BOOLEAN DEFAULT false,
  two_factor_secret TEXT,
  last_login_at TIMESTAMPTZ,
  last_login_ip INET,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES admin_users(id)
);
ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS role TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS two_factor_secret TEXT,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_login_ip INET,
  ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE admin_users
  ALTER COLUMN role SET DEFAULT 'support',
  ALTER COLUMN is_active SET DEFAULT true,
  ALTER COLUMN two_factor_enabled SET DEFAULT false,
  ALTER COLUMN created_at SET DEFAULT now();
UPDATE admin_users
SET
  password_hash = COALESCE(password_hash, ''),
  role = COALESCE(role, 'support'),
  is_active = COALESCE(is_active, true),
  two_factor_enabled = COALESCE(two_factor_enabled, false)
WHERE
  password_hash IS NULL
  OR role IS NULL
  OR is_active IS NULL
  OR two_factor_enabled IS NULL;
ALTER TABLE admin_users
  ALTER COLUMN password_hash SET NOT NULL,
  ALTER COLUMN role SET NOT NULL,
  ALTER COLUMN email SET NOT NULL,
  ALTER COLUMN name SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'admin_users_role_check'
      AND conrelid = 'admin_users'::regclass
  ) THEN
    ALTER TABLE admin_users
      ADD CONSTRAINT admin_users_role_check
      CHECK (role IN ('super_admin', 'support', 'sales'));
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);

-- ═══ admin_sessions ═══
CREATE TABLE IF NOT EXISTS admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admin_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin ON admin_sessions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(token_hash) WHERE revoked_at IS NULL;

-- ═══ admin_audit_log (append-only) ═══
DROP TABLE IF EXISTS admin_audit_log CASCADE;
CREATE TABLE admin_audit_log (
  id BIGSERIAL PRIMARY KEY,
  admin_id UUID REFERENCES admin_users(id),
  admin_email TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  target_name TEXT,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  performed_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_admin_time ON admin_audit_log(admin_id, performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_target ON admin_audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_time ON admin_audit_log(performed_at DESC);

-- ═══ plan_definitions (extended) ═══
-- Drop and recreate if already exists from seed
DROP TABLE IF EXISTS plan_definitions CASCADE;
CREATE TABLE plan_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  price_monthly NUMERIC(8,2) NOT NULL DEFAULT 0,
  price_annual NUMERIC(8,2),
  farmer_limit INT,
  bill_limit INT,
  branch_limit INT DEFAULT 1,
  staff_login_limit INT DEFAULT 0,
  features JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Re-seed plan definitions
INSERT INTO plan_definitions (name, display_name, price_monthly, price_annual, farmer_limit, bill_limit, branch_limit, staff_login_limit, features, sort_order)
VALUES
  ('trial', 'Free Trial', 0, NULL, 10, 50, 1, 0, '{"core":true}', 0),
  ('basic', 'Basic Plan', 299, 2990, NULL, NULL, 3, 1, '{"core":true,"expenses":true,"cashbook":true,"suppliers":true,"export":true,"whatsapp":true}', 1),
  ('pro', 'Pro Plan', 499, 4990, NULL, NULL, NULL, 5, '{"core":true,"gst":true,"reports":true,"voice":true,"multilang":true,"pdf":true,"staff":true,"priority_support":true}', 2);

-- ═══ dealer_subscriptions (extended) ═══
-- Drop and recreate
DROP TABLE IF EXISTS dealer_subscriptions CASCADE;
CREATE TABLE dealer_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES plan_definitions(id),
  plan_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'cancelled', 'suspended', 'trial')),
  billing_cycle TEXT DEFAULT 'monthly'
    CHECK (billing_cycle IN ('monthly', 'annual', 'manual')),
  amount_paid NUMERIC(8,2),
  payment_method TEXT,
  razorpay_payment_id TEXT,
  notes TEXT,
  auto_renew BOOLEAN DEFAULT false,
  granted_by UUID REFERENCES admin_users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dealer_sub_status ON dealer_subscriptions(dealer_id, status);
CREATE INDEX IF NOT EXISTS idx_dealer_sub_expiry ON dealer_subscriptions(end_date) WHERE status = 'active';

-- ═══ subscription_payment_history ═══
CREATE TABLE IF NOT EXISTS subscription_payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id UUID REFERENCES dealers(id),
  subscription_id UUID REFERENCES dealer_subscriptions(id),
  amount NUMERIC(8,2) NOT NULL,
  currency TEXT DEFAULT 'INR',
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT NOT NULL,
  razorpay_payment_id TEXT,
  razorpay_order_id TEXT,
  status TEXT DEFAULT 'success'
    CHECK (status IN ('success', 'failed', 'refunded', 'pending')),
  receipt_url TEXT,
  notes TEXT,
  recorded_by UUID REFERENCES admin_users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══ onboarding_progress (extended) ═══
DROP TABLE IF EXISTS onboarding_progress CASCADE;
CREATE TABLE onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE UNIQUE,
  step_1_shop_details_at TIMESTAMPTZ,
  step_2_language_at TIMESTAMPTZ,
  step_3_first_product_at TIMESTAMPTZ,
  step_4_first_farmer_at TIMESTAMPTZ,
  step_5_first_bill_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  nudge_sent_at TIMESTAMPTZ,
  nudge_count INT DEFAULT 0,
  stuck_since TIMESTAMPTZ,
  assigned_to UUID REFERENCES admin_users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_onboarding_incomplete ON onboarding_progress(completed_at) WHERE completed_at IS NULL;

-- ═══ support_tickets (extended) ═══
DROP TABLE IF EXISTS support_tickets CASCADE;
CREATE TABLE support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id UUID REFERENCES dealers(id),
  dealer_phone TEXT,
  dealer_name TEXT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  category TEXT DEFAULT 'general'
    CHECK (category IN ('billing', 'technical', 'onboarding', 'feature', 'complaint', 'general')),
  priority TEXT DEFAULT 'normal'
    CHECK (priority IN ('urgent', 'high', 'normal', 'low')),
  status TEXT DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'waiting_dealer', 'resolved', 'closed')),
  assigned_to UUID REFERENCES admin_users(id),
  first_response_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES admin_users(id),
  satisfaction_score INT CHECK (satisfaction_score BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets(status, priority, created_at);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned ON support_tickets(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_tickets_dealer ON support_tickets(dealer_id);

-- ═══ ticket_messages ═══
CREATE TABLE IF NOT EXISTS ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('dealer', 'admin', 'system')),
  sender_id UUID,
  sender_name TEXT NOT NULL,
  message TEXT NOT NULL,
  attachments JSONB DEFAULT '[]',
  is_internal BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ticket_msgs ON ticket_messages(ticket_id, created_at);

-- ═══ broadcast_messages (extended) ═══
DROP TABLE IF EXISTS broadcast_messages CASCADE;
CREATE TABLE broadcast_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admin_users(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  message_te TEXT,
  message_hi TEXT,
  target_segment TEXT NOT NULL
    CHECK (target_segment IN (
      'all', 'trial', 'basic', 'pro', 'expiring_7days', 'inactive_30days',
      'onboarding_stuck', 'specific_dealers', 'district', 'state'
    )),
  target_dealer_ids UUID[],
  target_district TEXT,
  target_state TEXT,
  channel TEXT DEFAULT 'in_app'
    CHECK (channel IN ('in_app', 'whatsapp', 'both')),
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  delivery_count INT DEFAULT 0,
  read_count INT DEFAULT 0,
  status TEXT DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'sent', 'failed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══ dealer_notifications ═══
CREATE TABLE IF NOT EXISTS dealer_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,
  broadcast_id UUID REFERENCES broadcast_messages(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info'
    CHECK (type IN ('info', 'warning', 'success', 'upgrade', 'system')),
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  action_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dealer_notifs ON dealer_notifications(dealer_id, is_read, created_at DESC);

-- ═══ impersonation_sessions ═══
CREATE TABLE IF NOT EXISTS impersonation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admin_users(id),
  dealer_id UUID REFERENCES dealers(id),
  token_hash TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  reason TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_impersonation_active ON impersonation_sessions(token_hash) WHERE ended_at IS NULL;

-- ═══ platform_metrics (daily snapshot) ═══
CREATE TABLE IF NOT EXISTS platform_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  total_dealers INT DEFAULT 0,
  active_dealers INT DEFAULT 0,
  trial_dealers INT DEFAULT 0,
  basic_dealers INT DEFAULT 0,
  pro_dealers INT DEFAULT 0,
  expired_dealers INT DEFAULT 0,
  new_signups INT DEFAULT 0,
  churned INT DEFAULT 0,
  total_bills_today INT DEFAULT 0,
  total_bill_value_today NUMERIC(15,2) DEFAULT 0,
  mrr NUMERIC(10,2) DEFAULT 0,
  arr NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══ dealer_activity_log ═══
CREATE TABLE IF NOT EXISTS dealer_activity_log (
  id BIGSERIAL PRIMARY KEY,
  dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  metadata JSONB,
  ip_address INET,
  device_info TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dealer_activity ON dealer_activity_log(dealer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dealer_activity_type ON dealer_activity_log(event_type, created_at DESC);

-- ═══ feature_changelog ═══
CREATE TABLE IF NOT EXISTS feature_changelog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT CHECK (type IN ('feature', 'fix', 'improvement', 'breaking')),
  affects_plans TEXT[],
  published_at TIMESTAMPTZ,
  is_published BOOLEAN DEFAULT false,
  created_by UUID REFERENCES admin_users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══ feature_flags ═══
CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  is_enabled_global BOOLEAN DEFAULT false,
  enabled_dealer_ids UUID[] DEFAULT '{}',
  enabled_plans TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════
-- RLS: All admin tables → USING (false) — service role only
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dealer_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_payment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE dealer_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE impersonation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE dealer_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_changelog ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- Block all access via anon/authenticated key
DROP POLICY IF EXISTS admin_users_deny ON admin_users;
DROP POLICY IF EXISTS admin_sessions_deny ON admin_sessions;
DROP POLICY IF EXISTS admin_audit_log_deny ON admin_audit_log;
DROP POLICY IF EXISTS plan_defs_read ON plan_definitions;
DROP POLICY IF EXISTS plan_defs_deny_write ON plan_definitions;
DROP POLICY IF EXISTS dealer_subs_deny ON dealer_subscriptions;
DROP POLICY IF EXISTS sub_payments_deny ON subscription_payment_history;
DROP POLICY IF EXISTS onboarding_deny ON onboarding_progress;
DROP POLICY IF EXISTS onboarding_progress_select ON onboarding_progress;
DROP POLICY IF EXISTS onboarding_progress_insert ON onboarding_progress;
DROP POLICY IF EXISTS onboarding_progress_update ON onboarding_progress;
DROP POLICY IF EXISTS onboarding_progress_delete ON onboarding_progress;
DROP POLICY IF EXISTS support_tickets_deny ON support_tickets;
DROP POLICY IF EXISTS ticket_messages_deny ON ticket_messages;
DROP POLICY IF EXISTS broadcast_deny ON broadcast_messages;
DROP POLICY IF EXISTS dealer_notifs_read ON dealer_notifications;
DROP POLICY IF EXISTS dealer_notifs_update ON dealer_notifications;
DROP POLICY IF EXISTS impersonation_deny ON impersonation_sessions;
DROP POLICY IF EXISTS platform_metrics_deny ON platform_metrics;
DROP POLICY IF EXISTS dealer_activity_deny ON dealer_activity_log;
DROP POLICY IF EXISTS changelog_read ON feature_changelog;
DROP POLICY IF EXISTS changelog_deny_write ON feature_changelog;
DROP POLICY IF EXISTS feature_flags_deny ON feature_flags;

CREATE POLICY admin_users_deny ON admin_users FOR ALL USING (false);
CREATE POLICY admin_sessions_deny ON admin_sessions FOR ALL USING (false);
CREATE POLICY admin_audit_log_deny ON admin_audit_log FOR ALL USING (false);
CREATE POLICY plan_defs_read ON plan_definitions FOR SELECT USING (true);
CREATE POLICY plan_defs_deny_write ON plan_definitions FOR ALL USING (false);
CREATE POLICY dealer_subs_deny ON dealer_subscriptions FOR ALL USING (false);
CREATE POLICY sub_payments_deny ON subscription_payment_history FOR ALL USING (false);
CREATE POLICY support_tickets_deny ON support_tickets FOR ALL USING (false);
CREATE POLICY ticket_messages_deny ON ticket_messages FOR ALL USING (false);
CREATE POLICY broadcast_deny ON broadcast_messages FOR ALL USING (false);
CREATE POLICY dealer_notifs_read ON dealer_notifications FOR SELECT USING (dealer_id = auth.uid());
CREATE POLICY dealer_notifs_update ON dealer_notifications FOR UPDATE USING (dealer_id = auth.uid());
CREATE POLICY impersonation_deny ON impersonation_sessions FOR ALL USING (false);
CREATE POLICY platform_metrics_deny ON platform_metrics FOR ALL USING (false);
CREATE POLICY dealer_activity_deny ON dealer_activity_log FOR ALL USING (false);
CREATE POLICY changelog_read ON feature_changelog FOR SELECT USING (is_published = true);
CREATE POLICY changelog_deny_write ON feature_changelog FOR ALL USING (false);
CREATE POLICY feature_flags_deny ON feature_flags FOR ALL USING (false);
CREATE POLICY onboarding_progress_select ON onboarding_progress FOR SELECT USING (dealer_id = auth.uid());
CREATE POLICY onboarding_progress_insert ON onboarding_progress FOR INSERT WITH CHECK (dealer_id = auth.uid());
CREATE POLICY onboarding_progress_update ON onboarding_progress FOR UPDATE USING (dealer_id = auth.uid());
CREATE POLICY onboarding_progress_delete ON onboarding_progress FOR DELETE USING (dealer_id = auth.uid());

-- ═══ Auth RPC: admin login (service-side password verification) ═══
CREATE OR REPLACE FUNCTION admin_login(p_email TEXT, p_password TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  email TEXT,
  role TEXT,
  is_active BOOLEAN,
  two_factor_enabled BOOLEAN,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_admin admin_users%ROWTYPE;
BEGIN
  SELECT *
  INTO v_admin
  FROM admin_users
  WHERE lower(admin_users.email) = lower(trim(p_email))
    AND admin_users.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_admin.password_hash IS NULL OR v_admin.password_hash = '' THEN
    RETURN;
  END IF;

  IF v_admin.password_hash <> extensions.crypt(p_password, v_admin.password_hash) THEN
    RETURN;
  END IF;

  UPDATE admin_users
  SET last_login_at = now()
  WHERE admin_users.id = v_admin.id;

  RETURN QUERY
  SELECT
    v_admin.id,
    v_admin.name,
    v_admin.email,
    v_admin.role,
    v_admin.is_active,
    v_admin.two_factor_enabled,
    now(),
    v_admin.created_at;
END;
$$;

REVOKE ALL ON FUNCTION admin_login(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_login(TEXT, TEXT) TO anon, authenticated, service_role;

-- ═══ Seed initial super admin ═══
-- Password: AquaAdmin@2025 (bcrypt hash)
INSERT INTO admin_users (name, email, password_hash, role)
VALUES ('Super Admin', 'admin@aquadealer.in', '$2a$12$LJ3UlGm1CjV5r3vXBqSMPeJfWkOgjOkNzV.DNmOqKHcbSxh4D6Xpa', 'super_admin')
ON CONFLICT (email) DO UPDATE
SET
  name = EXCLUDED.name,
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  is_active = true;

-- ═══ Seed feature flags ═══
INSERT INTO feature_flags (name, description, is_enabled_global) VALUES
  ('voice_search', 'Voice-based product search in Telugu', false),
  ('offline_mode', 'Offline data sync with Service Worker', false),
  ('whatsapp_reminders', 'Auto send payment reminders via WhatsApp', false),
  ('gst_filing', 'Auto-fill GSTR-1 returns', false),
  ('multi_staff', 'Allow multiple staff logins per dealer', false)
ON CONFLICT (name) DO UPDATE
SET
  description = EXCLUDED.description,
  is_enabled_global = EXCLUDED.is_enabled_global,
  updated_at = now();
