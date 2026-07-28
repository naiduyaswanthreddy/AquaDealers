-- Public statement RPC now returns delivery_pin + is_verified for each bill,
-- so the farmer sees the PIN for their unverified bills on the share link
-- (`/f/<share_token>`) and can read it out to the dealer at delivery time.
-- This restores the actual proof-of-delivery semantics — the dealer no longer
-- sees the PIN; only the holder of the unguessable share_token does.

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
               'type',   t.tx_type,
               'ref',    t.ref,
               'date',   t.tx_date,
               'amount', t.amount,
               'balance', t.balance,
               'branch', t.branch_name,
               'is_verified', t.is_verified,
               'delivery_pin', t.delivery_pin
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
               -- Only emit the PIN while the bill is still unverified. Once
               -- the dealer marks it verified the PIN is no longer useful and
               -- we stop echoing it back on the public page.
               CASE WHEN b.is_verified = false THEN b.delivery_pin ELSE NULL END AS delivery_pin
          FROM bills b
          LEFT JOIN branches br ON br.id = b.branch_id
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
               NULL::NUMERIC,
               COALESCE(p.branch_name_snapshot, br.name),
               TRUE,        -- payments are always "verified"
               NULL::TEXT   -- no delivery PIN for payments
          FROM payments p
          LEFT JOIN branches br ON br.id = p.branch_id
         WHERE p.dealer_id = v_farmer.dealer_id
           AND p.deleted_at IS NULL
           AND (p.farmer_id = v_farmer.id
                OR p.bill_id IN (SELECT id FROM bills WHERE farmer_id = v_farmer.id AND deleted_at IS NULL))
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
NOTIFY pgrst, 'reload schema';
