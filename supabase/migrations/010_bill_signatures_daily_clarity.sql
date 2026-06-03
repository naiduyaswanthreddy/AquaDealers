-- =============================================================================
-- AquaDealer Daily Clarity + Bill Signatures
-- Migration 010: Customer signature proof for existing bill flow.
-- =============================================================================

CREATE TABLE IF NOT EXISTS bill_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  storage_path TEXT,
  signature_data JSONB,
  canvas_width INT NOT NULL DEFAULT 600,
  canvas_height INT NOT NULL DEFAULT 220,
  signer_name TEXT,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bill_id),
  CONSTRAINT bill_signatures_has_data CHECK (
    storage_path IS NOT NULL OR signature_data IS NOT NULL
  )
);

ALTER TABLE bill_signatures
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS signature_data JSONB,
  ADD COLUMN IF NOT EXISTS canvas_width INT NOT NULL DEFAULT 600,
  ADD COLUMN IF NOT EXISTS canvas_height INT NOT NULL DEFAULT 220;

ALTER TABLE bill_signatures
  ALTER COLUMN storage_path DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bill_signatures_dealer_bill
  ON bill_signatures(dealer_id, bill_id);

ALTER TABLE bill_signatures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bill_signatures_select ON bill_signatures;
DROP POLICY IF EXISTS bill_signatures_insert ON bill_signatures;
DROP POLICY IF EXISTS bill_signatures_update ON bill_signatures;
DROP POLICY IF EXISTS bill_signatures_delete ON bill_signatures;

CREATE POLICY bill_signatures_select ON bill_signatures
  FOR SELECT USING (dealer_id = auth.uid());

CREATE POLICY bill_signatures_insert ON bill_signatures
  FOR INSERT WITH CHECK (dealer_id = auth.uid());

CREATE POLICY bill_signatures_update ON bill_signatures
  FOR UPDATE USING (dealer_id = auth.uid());

CREATE POLICY bill_signatures_delete ON bill_signatures
  FOR DELETE USING (dealer_id = auth.uid());
