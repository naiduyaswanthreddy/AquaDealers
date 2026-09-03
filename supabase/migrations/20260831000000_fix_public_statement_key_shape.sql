-- Regression fix: 20260808000003 rewrote get_farmer_public_statement and
-- re-authored its RETURN block with NESTED camelCase keys
-- (dealer.shopName, farmer.name, farmer.totalDue) while dropping generated_at.
-- FarmerStatementPage.tsx reads the FLAT snake_case keys every prior version
-- emitted, so on the farmer's public page:
--   shop_name  -> undefined -> falls back to the literal "Your Dealer"
--   farmer_name-> undefined -> blank name line
--   total_due  -> Number(undefined) || 0 -> shows "Rs.0 / All clear - no dues!"
-- Only `transactions` kept its top-level key, which is why the bill rows and
-- the client-computed Total Billed / Paid were right while the header said 0.
--
-- Same rewrite also silently dropped, vs 20260717000013:
--   * p.deleted_at IS NULL  -> soft-deleted payments reappeared on the page
--   * the p.bill_id fallback -> payments booked against a bill with no
--     farmer_id went missing from the farmer's statement
-- and, vs 20260717000001, the 'adjustment' tx_type the client still branches on.
-- All restored here. The is_estimate exclusion from 20260808000003 is kept.

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
        SELECT CASE WHEN b.type = 'adjustment' THEN 'adjustment'::TEXT
                    ELSE 'bill'::TEXT END AS tx_type,
               b.bill_number AS ref,
               b.bill_date::date AS tx_date,
               b.created_at,
               b.total AS amount,
               b.balance_due AS balance,
               COALESCE(b.branch_name_snapshot, br.name) AS branch_name,
               b.is_verified,
               -- Only echo the PIN while the bill is still unverified.
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
         WHERE p.dealer_id = v_farmer.dealer_id
           AND p.deleted_at IS NULL
           AND (p.farmer_id = v_farmer.id
                OR p.bill_id IN (SELECT id FROM bills
                                  WHERE farmer_id = v_farmer.id
                                    AND deleted_at IS NULL))
         ORDER BY p.payment_date DESC
         LIMIT 50
      )
    ) t;

  RETURN jsonb_build_object(
    'shop_name',     v_dealer.shop_name,
    'shop_phone',    v_dealer.phone,
    'shop_address',  v_dealer.address,
    'shop_district', v_dealer.district,
    'farmer_name',   v_farmer.name,
    'village',       v_farmer.village,
    'total_due',     v_farmer.total_due,
    'transactions',  v_transactions,
    'generated_at',  now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_farmer_public_statement(UUID) TO anon, authenticated;

-- Shape guard: the next person who re-authors this RETURN block fails the
-- migration instead of shipping a farmer page that reads "Rs.0 / All clear".
DO $guard$
DECLARE
  v_token UUID;
  v_out   JSONB;
  v_key   TEXT;
BEGIN
  SELECT share_token INTO v_token
    FROM farmers WHERE share_token IS NOT NULL AND is_active = true LIMIT 1;

  IF v_token IS NULL THEN
    RAISE NOTICE 'get_farmer_public_statement shape guard skipped: no farmer with a share_token';
    RETURN;
  END IF;

  v_out := public.get_farmer_public_statement(v_token);

  FOREACH v_key IN ARRAY ARRAY[
    'shop_name','shop_phone','shop_address','shop_district',
    'farmer_name','village','total_due','transactions','generated_at'
  ] LOOP
    IF NOT (v_out ? v_key) THEN
      RAISE EXCEPTION 'get_farmer_public_statement is missing top-level key "%" that FarmerStatementPage.tsx reads', v_key;
    END IF;
  END LOOP;
END
$guard$;

NOTIFY pgrst, 'reload schema';
