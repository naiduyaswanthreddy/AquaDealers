-- Server-side aggregated top sold products — replaces client-side bill_items + bills join
-- that downloaded thousands of rows for a 5-item widget.
CREATE OR REPLACE FUNCTION get_top_sold_products_v1(
  p_dealer_id  uuid,
  p_branch_id  uuid,
  p_start_date date,
  p_limit      int DEFAULT 5
) RETURNS TABLE (
  product_id   uuid,
  product_name text,
  product_type text,
  unit         text,
  total_qty    numeric
) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    bi.product_id,
    p.name,
    p.type,
    COALESCE(p.unit, 'units'),
    SUM(bi.quantity)::numeric
  FROM bill_items bi
  JOIN bills b     ON b.id = bi.bill_id
  JOIN products p  ON p.id = bi.product_id
  WHERE b.dealer_id = p_dealer_id
    AND b.status    = 'active'
    AND b.bill_date >= p_start_date
    AND (p_branch_id IS NULL OR b.branch_id = p_branch_id)
  GROUP BY bi.product_id, p.name, p.type, p.unit
  ORDER BY SUM(bi.quantity) DESC
  LIMIT p_limit;
$$;

-- Server-side aggregated items sold today.
CREATE OR REPLACE FUNCTION get_today_sold_items_v1(
  p_dealer_id uuid,
  p_branch_id uuid,
  p_date      date
) RETURNS TABLE (
  product_id   uuid,
  product_name text,
  product_type text,
  unit         text,
  total_qty    numeric
) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    bi.product_id,
    p.name,
    p.type,
    COALESCE(p.unit, 'units'),
    SUM(bi.quantity)::numeric
  FROM bill_items bi
  JOIN bills b     ON b.id = bi.bill_id
  JOIN products p  ON p.id = bi.product_id
  WHERE b.dealer_id = p_dealer_id
    AND b.status    = 'active'
    AND b.bill_date = p_date
    AND (p_branch_id IS NULL OR b.branch_id = p_branch_id)
  GROUP BY bi.product_id, p.name, p.type, p.unit
  ORDER BY SUM(bi.quantity) DESC;
$$;
