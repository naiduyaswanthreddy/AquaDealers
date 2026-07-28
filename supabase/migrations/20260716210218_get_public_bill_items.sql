-- Create RPC to securely fetch bill items using share_token
CREATE OR REPLACE FUNCTION public.get_public_bill_items(p_token UUID, p_bill_number TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_farmer RECORD;
  v_bill_id UUID;
  v_items JSONB;
BEGIN
  -- Verify token and get farmer
  SELECT id INTO v_farmer
    FROM farmers
   WHERE share_token = p_token
     AND is_active = true;
     
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Find the bill
  SELECT id INTO v_bill_id
    FROM bills
   WHERE farmer_id = v_farmer.id
     AND bill_number = p_bill_number;

  IF NOT FOUND THEN
    RETURN '[]'::jsonb;
  END IF;

  -- Get items
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
