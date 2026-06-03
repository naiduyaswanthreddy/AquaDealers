-- =============================================================================
-- AquaDealer Signature Preference
-- Migration 011: Dealer-level switch for bill signature capture.
-- =============================================================================

ALTER TABLE dealers
  ADD COLUMN IF NOT EXISTS bill_signature_enabled BOOLEAN NOT NULL DEFAULT true;
