-- Bulk product creation defaulted every new item's low-stock threshold to 0,
-- meaning newly added SKUs (including via Excel import) never triggered a
-- low-stock alert until someone manually edited each one afterward. Add an
-- optional min_stock_alert column to the row payload; omitted/NULL still
-- defaults to 0, matching prior behavior exactly for any existing caller.
--
-- This also restores SET LOCAL session_replication_role = 'replica' to the
-- function, which was silently dropped by migration 20260720000000_fix_inventory_quantity_column.sql.
-- Without it, the trigger trg_fanout_product_to_branches (which inserts inventory
-- rows with min_stock_alert hardcoded to 0) wins the ON CONFLICT DO NOTHING race,
-- defeating the dealer-entered threshold value.

CREATE OR REPLACE FUNCTION public.bulk_create_products(p_rows JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dealer_id UUID := COALESCE(auth.uid(), public.staff_dealer_id());
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
      medicine_discount_percentage NUMERIC,
      min_stock_alert NUMERIC
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
  INSERT INTO public.inventory (dealer_id, branch_id, product_id, quantity_in_stock, min_stock_alert)
  SELECT i.dealer_id, b.id, i.id, 0, (SELECT COALESCE(min_stock_alert, 0) FROM src LIMIT 1)
    FROM inserted i
    JOIN public.branches b ON b.dealer_id = i.dealer_id AND b.is_active = true
  ON CONFLICT (dealer_id, branch_id, product_id) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  SELECT COUNT(*) INTO v_count
    FROM public.products
   WHERE dealer_id = v_dealer_id
     AND created_at >= now() - interval '5 seconds';
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bulk_create_products(JSONB) TO authenticated;
NOTIFY pgrst, 'reload schema';
