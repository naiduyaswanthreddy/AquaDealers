-- Update RPC to fetch targets for Rate Adjustment (ONLY UNPAID BILLS)
CREATE OR REPLACE FUNCTION public.get_rate_adjustment_targets(
  p_dealer_id UUID,
  p_product_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  farmer_id UUID,
  farmer_name TEXT,
  farmer_phone TEXT,
  total_quantity NUMERIC,
  avg_unit_price NUMERIC,
  bill_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    b.farmer_id,
    f.name as farmer_name,
    f.phone as farmer_phone,
    SUM(bi.quantity) as total_quantity,
    SUM(bi.total_price) / NULLIF(SUM(bi.quantity), 0) as avg_unit_price,
    COUNT(DISTINCT b.id) as bill_count
  FROM bills b
  JOIN bill_items bi ON b.id = bi.bill_id
  JOIN farmers f ON b.farmer_id = f.id
  WHERE b.dealer_id = p_dealer_id
    AND b.status = 'active'
    AND COALESCE(b.type, 'sale') = 'sale'
    AND bi.product_id = p_product_id
    AND b.bill_date >= p_start_date
    AND b.bill_date <= p_end_date
    AND b.balance_due > 0
  GROUP BY b.farmer_id, f.name, f.phone
  HAVING SUM(bi.quantity) > 0
  ORDER BY f.name;
$$;
