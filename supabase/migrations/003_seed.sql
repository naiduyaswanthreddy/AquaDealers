-- =============================================================================
-- AquaDealer Seed Data
-- Migration 003: Populate plan_definitions with realistic data
-- =============================================================================

-- =============================================================================
-- PLAN DEFINITIONS
-- =============================================================================
insert into plan_definitions (name, price_monthly, farmer_limit, bill_limit, features) values
(
  'trial',
  0,
  10,
  50,
  '{"core": true, "branches": 1}'::jsonb
),
(
  'basic',
  299,
  null,
  null,
  '{"core": true, "branches": 3, "expenses": true, "cashbook": true, "suppliers": true, "export": true, "whatsapp": true}'::jsonb
),
(
  'pro',
  499,
  null,
  null,
  '{"core": true, "branches": null, "gst": true, "reports": true, "voice": true, "multilang": true, "pdf": true, "staff": true, "priority_support": true}'::jsonb
);

