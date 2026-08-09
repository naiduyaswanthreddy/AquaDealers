-- supabase/migrations/20260809000002_estimates_unique_fix.sql
-- Fix 1: unique constraint on (dealer_id, estimate_number) to prevent race-condition duplicates
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_estimates_dealer_number'
  ) THEN
    ALTER TABLE public.estimates
      ADD CONSTRAINT uq_estimates_dealer_number UNIQUE (dealer_id, estimate_number);
  END IF;
END $$;

-- Fix 2: guard against empty items in create_estimate_v1
CREATE OR REPLACE FUNCTION public.create_estimate_v1(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dealer_id      UUID    := (p_payload->>'dealer_id')::UUID;
  v_farmer_id      UUID    := (p_payload->>'farmer_id')::UUID;
  v_branch_id      UUID    := NULLIF(p_payload->>'branch_id', '')::UUID;
  v_estimate_id    UUID    := gen_random_uuid();
  v_estimate_number TEXT;
  v_seq            INTEGER;
  v_item           JSONB;
BEGIN
  PERFORM public.assert_dealer_access(v_dealer_id);

  IF v_farmer_id IS NULL THEN
    RAISE EXCEPTION 'farmer_id is required for estimates';
  END IF;

  IF jsonb_array_length(COALESCE(p_payload->'items', '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'estimate must have at least one item';
  END IF;

  -- Per-dealer sequential estimate number (EST-0001, EST-0002, ...)
  SELECT COALESCE(MAX(
    CASE WHEN estimate_number ~ '^EST-[0-9]+$'
    THEN CAST(SUBSTRING(estimate_number FROM 5) AS INTEGER)
    ELSE 0 END
  ), 0) + 1
  INTO v_seq
  FROM public.estimates
  WHERE dealer_id = v_dealer_id;

  v_estimate_number := 'EST-' || LPAD(v_seq::TEXT, 4, '0');

  INSERT INTO public.estimates (
    id, estimate_number, dealer_id, branch_id, farmer_id,
    farmer_name_snapshot, branch_name_snapshot, estimate_date,
    subtotal, gst_amount, discount_amount, total, notes, status
  ) VALUES (
    v_estimate_id,
    v_estimate_number,
    v_dealer_id,
    v_branch_id,
    v_farmer_id,
    p_payload->>'farmer_name_snapshot',
    p_payload->>'branch_name_snapshot',
    COALESCE(NULLIF(p_payload->>'estimate_date','')::DATE, CURRENT_DATE),
    COALESCE((p_payload->>'subtotal')::NUMERIC,        0),
    COALESCE((p_payload->>'gst_amount')::NUMERIC,      0),
    COALESCE((p_payload->>'discount_amount')::NUMERIC, 0),
    COALESCE((p_payload->>'total')::NUMERIC,           0),
    NULLIF(p_payload->>'notes', ''),
    'active'
  );

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'items') LOOP
    INSERT INTO public.estimate_items (
      estimate_id, product_id, product_name, hsn_code,
      quantity, unit_price, discount_percentage, gst_rate, total_price
    ) VALUES (
      v_estimate_id,
      NULLIF(v_item->>'product_id', '')::UUID,
      v_item->>'product_name',
      NULLIF(v_item->>'hsn_code', ''),
      (v_item->>'quantity')::NUMERIC,
      (v_item->>'unit_price')::NUMERIC,
      COALESCE((v_item->>'discount_percentage')::NUMERIC, 0),
      COALESCE((v_item->>'gst_rate')::NUMERIC,            0),
      (v_item->>'total_price')::NUMERIC
    );
  END LOOP;

  RETURN jsonb_build_object(
    'estimate_id',     v_estimate_id,
    'estimate_number', v_estimate_number
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_estimate_v1(JSONB) TO authenticated;

NOTIFY pgrst, 'reload schema';
