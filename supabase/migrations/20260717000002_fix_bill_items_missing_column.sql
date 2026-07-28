-- get_public_bill_items referenced bill_items.medicine_discount_percentage,
-- a column that only exists on products/inventory/inventory_lots — never on
-- bill_items. PL/pgSQL validates columns at run time, so the function created
-- fine but EVERY call threw 42703; the client swallowed the error and rendered
-- "No items found" for all bills on the shared statement link.
-- Derive the discount % from mrp vs unit_price instead.

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
             'medicine_discount_percentage',
               CASE WHEN COALESCE(mrp, 0) > 0 AND unit_price < mrp
                    THEN round((1 - unit_price / mrp) * 100, 2)
                    ELSE 0 END,
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
