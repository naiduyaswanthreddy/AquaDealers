-- Shared statement previously flagged every bill as type='bill', so rate
-- adjustments (bills.type='adjustment', bill_number prefix AD-) rendered a
-- "Tap to view items" chevron that always resolved to "No items found" —
-- adjustments have no bill_items by design.
-- Emit the real bill type so the client can render adjustments as their own row.

CREATE OR REPLACE FUNCTION public.get_farmer_public_statement(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_farmer RECORD;
  v_dealer RECORD;
  v_transactions JSONB;
BEGIN
  SELECT id, dealer_id, name, village, total_due
    INTO v_farmer
    FROM farmers
   WHERE (share_token = p_token OR id = p_token)
     AND is_active = true;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT shop_name, phone, address, district
    INTO v_dealer
    FROM dealers
   WHERE id = v_farmer.dealer_id;

  SELECT COALESCE(
           jsonb_agg(
             jsonb_build_object(
               'type', t.tx_type,
               'ref', t.ref,
               'date', t.tx_date,
               'amount', t.amount,
               'balance', t.balance
             )
             ORDER BY t.tx_date DESC, t.created_at DESC
           ),
           '[]'::jsonb
         )
    INTO v_transactions
    FROM (
      (
        SELECT CASE WHEN b.type = 'adjustment' THEN 'adjustment'::TEXT ELSE 'bill'::TEXT END AS tx_type,
               b.bill_number AS ref,
               b.bill_date::date AS tx_date,
               b.created_at,
               b.total AS amount,
               b.balance_due AS balance
          FROM bills b
         WHERE b.farmer_id = v_farmer.id
           AND b.dealer_id = v_farmer.dealer_id
           AND b.deleted_at IS NULL
         ORDER BY b.bill_date DESC
         LIMIT 50
      )
      UNION ALL
      (
        SELECT 'payment'::TEXT,
               COALESCE(p.receipt_number, upper(COALESCE(p.method, 'payment'))),
               p.payment_date::date,
               p.created_at,
               p.amount,
               NULL::NUMERIC
          FROM payments p
         WHERE p.dealer_id = v_farmer.dealer_id
           AND (
             p.farmer_id = v_farmer.id
             OR p.bill_id IN (SELECT id FROM bills WHERE farmer_id = v_farmer.id)
           )
         ORDER BY p.payment_date DESC
         LIMIT 50
      )
    ) t;

  RETURN jsonb_build_object(
    'shop_name', v_dealer.shop_name,
    'shop_phone', v_dealer.phone,
    'shop_address', v_dealer.address,
    'shop_district', v_dealer.district,
    'farmer_name', v_farmer.name,
    'village', v_farmer.village,
    'total_due', v_farmer.total_due,
    'transactions', v_transactions,
    'generated_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_farmer_public_statement(UUID) TO anon, authenticated;
