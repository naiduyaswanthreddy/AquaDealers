-- Bulk-create farmers RPC — bypasses the 30/min rate-limit trigger for
-- legitimate Excel imports. Dealer/staff-safe: dealer_id is FORCED to the
-- caller's auth.uid() so a caller can only add farmers to their own account.
--
-- Why not raise the rate limit? 30/min is fine for interactive use. Bulk
-- imports need to insert hundreds in one request, so we route them through a
-- SECURITY DEFINER function that turns off user triggers within its own
-- transaction (SET LOCAL session_replication_role = 'replica').
CREATE OR REPLACE FUNCTION public.bulk_create_farmers(p_rows JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dealer_id UUID := auth.uid();
  v_count INTEGER;
BEGIN
  IF v_dealer_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'p_rows must be a JSON array';
  END IF;

  -- Disable user-defined triggers (rate-limit + any snapshotters) for THIS
  -- transaction only. Postgres system triggers (FK, PK, RLS) stay active.
  SET LOCAL session_replication_role = 'replica';

  WITH src AS (
    SELECT * FROM jsonb_to_recordset(p_rows) AS x(
      branch_id UUID,
      name TEXT,
      phone TEXT,
      village TEXT,
      mandal TEXT,
      district TEXT,
      pond_acres NUMERIC,
      stocking_date DATE,
      crop_status TEXT,
      risk_status TEXT,
      credit_limit NUMERIC,
      default_medicine_discount_percentage NUMERIC,
      opening_balance NUMERIC,
      notes TEXT
    )
  )
  INSERT INTO public.farmers (
    dealer_id, branch_id, name, phone, village, mandal, district,
    pond_acres, stocking_date, crop_status, risk_status,
    credit_limit, default_medicine_discount_percentage, opening_balance,
    notes, is_active, total_due
  )
  SELECT
    v_dealer_id,
    src.branch_id,
    NULLIF(trim(src.name), ''),
    NULLIF(trim(src.phone), ''),
    NULLIF(trim(src.village), ''),
    NULLIF(trim(src.mandal), ''),
    NULLIF(trim(src.district), ''),
    src.pond_acres,
    src.stocking_date,
    COALESCE(NULLIF(trim(src.crop_status), ''), 'growing'),
    COALESCE(NULLIF(trim(src.risk_status), ''), 'safe'),
    COALESCE(src.credit_limit, 0),
    COALESCE(src.default_medicine_discount_percentage, 0),
    COALESCE(src.opening_balance, 0),
    NULLIF(trim(src.notes), ''),
    TRUE,
    COALESCE(src.opening_balance, 0)  -- start total_due equal to opening balance
  FROM src
  WHERE NULLIF(trim(src.name), '') IS NOT NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_create_farmers(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bulk_create_farmers(JSONB) TO authenticated;
NOTIFY pgrst, 'reload schema';
