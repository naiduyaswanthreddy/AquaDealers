-- Bulk-create products RPC — same pattern as bulk_create_farmers.
-- Bypasses the 30/min rate-limit trigger (fires per inventory row) so legitimate
-- Excel/manual bulk product entry works. Forces dealer_id to auth.uid() and
-- manually fans out empty inventory rows to every active branch (the fanout
-- trigger is disabled inside this transaction since session_replication_role
-- is set to replica).

CREATE OR REPLACE FUNCTION public.bulk_create_products(p_rows JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dealer_id UUID := auth.uid();
  v_count INTEGER;
BEGIN
  IF v_dealer_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF jsonb_typeof(p_rows) <> 'array' THEN RAISE EXCEPTION 'p_rows must be a JSON array'; END IF;

  SET LOCAL session_replication_role = 'replica';

  WITH src AS (
    SELECT * FROM jsonb_to_recordset(p_rows) AS x(
      type TEXT,
      company TEXT,
      name TEXT,
      variant TEXT,
      category TEXT,
      unit TEXT,
      hsn_code TEXT,
      gst_rate NUMERIC,
      default_price NUMERIC,
      track_expiry BOOLEAN,
      medicine_discount_percentage NUMERIC
    )
  ),
  inserted AS (
    INSERT INTO public.products (
      dealer_id, type, company, name, variant, category, unit, hsn_code,
      gst_rate, default_price, track_expiry, is_active, medicine_discount_percentage
    )
    SELECT
      v_dealer_id,
      COALESCE(NULLIF(trim(src.type), ''), 'feed'),
      NULLIF(trim(src.company), ''),
      NULLIF(trim(src.name), ''),
      NULLIF(trim(src.variant), ''),
      NULLIF(trim(src.category), ''),
      COALESCE(NULLIF(trim(src.unit), ''), 'bag'),
      NULLIF(trim(src.hsn_code), ''),
      COALESCE(src.gst_rate, 0),
      src.default_price,
      COALESCE(src.track_expiry, false),
      TRUE,
      COALESCE(src.medicine_discount_percentage, 0)
    FROM src
    WHERE NULLIF(trim(src.name), '') IS NOT NULL
    RETURNING id, dealer_id
  )
  -- Fan out to every active branch of this dealer (trigger is disabled).
  INSERT INTO public.inventory (dealer_id, branch_id, product_id, quantity_in_stock, min_stock_alert)
  SELECT i.dealer_id, b.id, i.id, 0, 0
    FROM inserted i
    JOIN public.branches b ON b.dealer_id = i.dealer_id AND b.is_active = true
  ON CONFLICT (dealer_id, branch_id, product_id) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  -- ROW_COUNT above is the number of inventory rows fanned out. Return the
  -- number of PRODUCTS inserted for a more useful client-visible count.
  SELECT COUNT(*) INTO v_count
    FROM public.products
   WHERE dealer_id = v_dealer_id
     AND created_at >= now() - interval '5 seconds';
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_create_products(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bulk_create_products(JSONB) TO authenticated;
NOTIFY pgrst, 'reload schema';
