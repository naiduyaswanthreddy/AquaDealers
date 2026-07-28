-- Repair older deployed product fan-out functions that referenced the retired
-- inventory.current_stock column. Inventory uses quantity_in_stock everywhere.

CREATE OR REPLACE FUNCTION public.fanout_product_to_branches()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.inventory (dealer_id, branch_id, product_id, quantity_in_stock, min_stock_alert)
  SELECT NEW.dealer_id, b.id, NEW.id, 0, 0
    FROM public.branches b
   WHERE b.dealer_id = NEW.dealer_id
     AND b.is_active = true
  ON CONFLICT (dealer_id, branch_id, product_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fanout_branch_to_products()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.inventory (dealer_id, branch_id, product_id, quantity_in_stock, min_stock_alert)
  SELECT NEW.dealer_id, NEW.id, p.id, 0, 0
    FROM public.products p
   WHERE p.dealer_id = NEW.dealer_id
  ON CONFLICT (dealer_id, branch_id, product_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.bulk_create_products(p_rows JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_dealer_id UUID := COALESCE(auth.uid(), public.staff_dealer_id());
DECLARE v_count INTEGER;
BEGIN
  IF v_dealer_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF jsonb_typeof(p_rows) <> 'array' THEN RAISE EXCEPTION 'p_rows must be a JSON array'; END IF;
  WITH src AS (
    SELECT * FROM jsonb_to_recordset(p_rows) AS x(type TEXT, company TEXT, name TEXT, variant TEXT, category TEXT, unit TEXT, hsn_code TEXT, gst_rate NUMERIC, default_price NUMERIC, track_expiry BOOLEAN, medicine_discount_percentage NUMERIC)
  ), inserted AS (
    INSERT INTO public.products (dealer_id, type, company, name, variant, category, unit, hsn_code, gst_rate, default_price, track_expiry, is_active, medicine_discount_percentage)
    SELECT v_dealer_id, COALESCE(NULLIF(trim(type), ''), 'feed'), NULLIF(trim(company), ''), NULLIF(trim(name), ''), NULLIF(trim(variant), ''), NULLIF(trim(category), ''), COALESCE(NULLIF(trim(unit), ''), 'bag'), NULLIF(trim(hsn_code), ''), COALESCE(gst_rate, 0), default_price, COALESCE(track_expiry, false), TRUE, COALESCE(medicine_discount_percentage, 0)
    FROM src WHERE NULLIF(trim(name), '') IS NOT NULL RETURNING id, dealer_id
  )
  INSERT INTO public.inventory (dealer_id, branch_id, product_id, quantity_in_stock, min_stock_alert)
  SELECT i.dealer_id, b.id, i.id, 0, 0 FROM inserted i JOIN public.branches b ON b.dealer_id = i.dealer_id AND b.is_active = true
  ON CONFLICT (dealer_id, branch_id, product_id) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bulk_create_products(JSONB) TO authenticated;
NOTIFY pgrst, 'reload schema';
