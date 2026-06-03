-- ═══════════════════════════════════════════════════════════════
-- AquaDealer Subscription Features
-- Migration 016: Adds custom_features to dealers and updates plans
-- ═══════════════════════════════════════════════════════════════

-- 1. Add custom_features JSONB to dealers table
ALTER TABLE dealers
  ADD COLUMN IF NOT EXISTS custom_features JSONB DEFAULT '[]'::jsonb;

-- 2. Update Plan Definitions with new prices and features
-- Trial
UPDATE plan_definitions
SET 
  features = '["core"]'::jsonb
WHERE name = 'trial';

-- Basic (now 3499/year)
UPDATE plan_definitions
SET 
  price_annual = 3499,
  price_monthly = 349,
  branch_limit = 1,
  features = '["core", "expenses", "cashbook", "suppliers", "export", "whatsapp"]'::jsonb
WHERE name = 'basic';

-- Pro (now 4999/year)
UPDATE plan_definitions
SET 
  price_annual = 4999,
  price_monthly = 499,
  branch_limit = 3,
  features = '["core", "expenses", "cashbook", "suppliers", "export", "whatsapp", "gst", "reports", "voice", "multilang", "pdf", "priority_support", "app_pin"]'::jsonb
WHERE name = 'pro';

-- Pro+ (new plan, 6999/year)
INSERT INTO plan_definitions (name, display_name, price_monthly, price_annual, farmer_limit, bill_limit, branch_limit, staff_login_limit, features, sort_order)
VALUES (
  'pro_plus', 
  'Pro+ Plan', 
  699, 
  6999, 
  NULL, 
  NULL, 
  NULL, -- unlimited branches
  10,   -- staff limit
  '["core", "expenses", "cashbook", "suppliers", "export", "whatsapp", "gst", "reports", "voice", "multilang", "pdf", "priority_support", "app_pin", "staff", "signature_proof", "farmer_photo"]'::jsonb, 
  3
) ON CONFLICT (name) DO UPDATE 
SET 
  price_annual = 6999,
  features = '["core", "expenses", "cashbook", "suppliers", "export", "whatsapp", "gst", "reports", "voice", "multilang", "pdf", "priority_support", "app_pin", "staff", "signature_proof", "farmer_photo"]'::jsonb,
  branch_limit = NULL;

-- 3. In RPCs or queries, feature evaluation should consider both plan_definitions and custom_features
-- We will handle this in the frontend / API logic, but this schema sets it up.
