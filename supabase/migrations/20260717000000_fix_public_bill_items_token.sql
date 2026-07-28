-- get_public_bill_items rejected links whose token is the farmer id (older
-- shared links do this — get_farmer_public_statement already accepts both).
-- Result: statement loaded but per-bill items were always empty.
-- Match the same OR predicate the statement RPC uses.

CREATE OR REPLACE FUNCTION public.get_public_bill_items(p_token UUID, p_bill_number TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_farmer_id UUID;
  v_bill_id UUID;
  v_items JSONB;
BEGIN
  SELECT id INTO v_farmer_id
    FROM farmers
   WHERE (share_token = p_token OR id = p_token)
     AND is_active = true;

  IF NOT FOUND THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT id INTO v_bill_id
    FROM bills
   WHERE farmer_id = v_farmer_id
     AND bill_number = p_bill_number;

  IF NOT FOUND THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(
           jsonb_build_object(
             'id', id,
             'product_name_snapshot', product_name_snapshot,
             'quantity', quantity,
             'unit_price', unit_price,
             'mrp', mrp,
             'medicine_discount_percentage', medicine_discount_percentage,
             'gst_rate', gst_rate,
             'gst_amount', gst_amount,
             'total_price', total_price
           )
         ), '[]'::jsonb)
    INTO v_items
    FROM bill_items
   WHERE bill_id = v_bill_id;

  RETURN v_items;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_bill_items(UUID, TEXT) TO anon, authenticated;
