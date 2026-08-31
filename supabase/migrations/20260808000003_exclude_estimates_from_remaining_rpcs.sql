-- Patch two remaining RPCs that included estimate bills in financial/public output.

-- ── 1. get_realized_profit ────────────────────────────────────────────────────
-- Estimates insert bill_items but no stock was consumed. Including them inflates
-- the gross margin shown in the Business Snapshot.
CREATE OR REPLACE FUNCTION public.get_realized_profit(
  p_dealer_id uuid,
  p_branch_id uuid,
  p_start      date,
  p_end        date
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result NUMERIC;
BEGIN
  PERFORM public.assert_dealer_access(p_dealer_id);

  SELECT COALESCE(SUM(
    (bi.unit_price - COALESCE(inv.cost_price, 0)) * bi.quantity
  ), 0)
  INTO v_result
  FROM bill_items bi
  JOIN bills b ON b.id = bi.bill_id
  LEFT JOIN inventory inv ON inv.id = bi.inventory_id_snapshot
  WHERE b.dealer_id = p_dealer_id
    AND b.deleted_at IS NULL
    AND b.status != 'cancelled'
    AND COALESCE(b.is_estimate, false) = false
    AND b.bill_date >= p_start
    AND b.bill_date <= p_end
    AND (p_branch_id IS NULL OR b.branch_id = p_branch_id);

  RETURN v_result;
END;
$$;

-- ── 2. get_farmer_public_statement ────────────────────────────────────────────
-- Estimates show up on the farmer's public share-link page as phantom charges.
-- Farmers see a "bill" row for goods that were never delivered. Exclude them.
CREATE OR REPLACE FUNCTION public.get_farmer_public_statement(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_farmer       RECORD;
  v_dealer       RECORD;
  v_transactions JSONB;
BEGIN
  SELECT id, dealer_id, name, village, total_due
    INTO v_farmer
    FROM farmers
   WHERE share_token = p_token
     AND is_active = true;

  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT shop_name, phone, address, district
    INTO v_dealer
    FROM dealers
   WHERE id = v_farmer.dealer_id;

  SELECT COALESCE(
           jsonb_agg(
             jsonb_build_object(
               'type',        t.tx_type,
               'ref',         t.ref,
               'date',        t.tx_date,
               'amount',      t.amount,
               'balance',     t.balance,
               'branch',      t.branch_name,
               'is_verified', t.is_verified,
               'delivery_pin',t.delivery_pin
             )
             ORDER BY t.tx_date DESC, t.created_at DESC
           ),
           '[]'::jsonb
         )
    INTO v_transactions
    FROM (
      (
        SELECT 'bill'::TEXT AS tx_type,
               b.bill_number AS ref,
               b.bill_date::date AS tx_date,
               b.created_at,
               b.total AS amount,
               b.balance_due AS balance,
               COALESCE(b.branch_name_snapshot, br.name) AS branch_name,
               b.is_verified,
               CASE WHEN b.is_verified = false THEN b.delivery_pin ELSE NULL END AS delivery_pin
          FROM bills b
          LEFT JOIN branches br ON br.id = b.branch_id
         WHERE b.farmer_id = v_farmer.id
           AND b.dealer_id = v_farmer.dealer_id
           AND b.deleted_at IS NULL
           AND COALESCE(b.is_estimate, false) = false
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
               NULL::NUMERIC,
               COALESCE(p.branch_name_snapshot, br.name),
               TRUE,
               NULL::TEXT
          FROM payments p
          LEFT JOIN branches br ON br.id = p.branch_id
         WHERE p.farmer_id = v_farmer.id
           AND p.dealer_id = v_farmer.dealer_id
         ORDER BY p.payment_date DESC
         LIMIT 50
      )
    ) t;

  RETURN jsonb_build_object(
    'farmer',       jsonb_build_object(
      'name',    v_farmer.name,
      'village', v_farmer.village,
      'totalDue',v_farmer.total_due
    ),
    'dealer',       jsonb_build_object(
      'shopName', v_dealer.shop_name,
      'phone',    v_dealer.phone,
      'address',  v_dealer.address,
      'district', v_dealer.district
    ),
    'transactions', v_transactions
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
