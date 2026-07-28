-- =============================================================================
-- Snapshot branch name on bills + payments so UI can render without joins.
-- Backfill from the current branches table, then install a BEFORE INSERT
-- trigger that populates the snapshot from branch_id. If a caller sets
-- branch_name_snapshot explicitly (e.g. offline sync), that value wins.
-- =============================================================================

ALTER TABLE public.bills    ADD COLUMN IF NOT EXISTS branch_name_snapshot TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS branch_name_snapshot TEXT;

UPDATE public.bills b
   SET branch_name_snapshot = br.name
  FROM public.branches br
 WHERE b.branch_id = br.id
   AND b.branch_name_snapshot IS NULL;

UPDATE public.payments p
   SET branch_name_snapshot = br.name
  FROM public.branches br
 WHERE p.branch_id = br.id
   AND p.branch_name_snapshot IS NULL;

CREATE OR REPLACE FUNCTION public.snapshot_branch_name_on_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.branch_name_snapshot IS NULL AND NEW.branch_id IS NOT NULL THEN
    SELECT name INTO NEW.branch_name_snapshot FROM public.branches WHERE id = NEW.branch_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bills_snapshot_branch ON public.bills;
CREATE TRIGGER trg_bills_snapshot_branch
BEFORE INSERT ON public.bills
FOR EACH ROW EXECUTE FUNCTION public.snapshot_branch_name_on_write();

DROP TRIGGER IF EXISTS trg_payments_snapshot_branch ON public.payments;
CREATE TRIGGER trg_payments_snapshot_branch
BEFORE INSERT ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.snapshot_branch_name_on_write();

-- Public statement RPC: include branch_name in each transaction row.
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
               'branch', t.branch_name
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
               COALESCE(b.branch_name_snapshot, br.name) AS branch_name
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
               COALESCE(p.branch_name_snapshot, br.name)
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

-- Extend the paginated ledger RPC too, so farmer detail page shows branch per row.
CREATE OR REPLACE FUNCTION public.get_farmer_ledger_page(
  p_farmer_id     UUID,
  p_dealer_id     UUID,
  p_page          INT  DEFAULT 1,
  p_limit         INT  DEFAULT 20,
  p_start_date    DATE DEFAULT NULL,
  p_end_date      DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offset INT;
  v_total  BIGINT;
  v_rows   JSONB;
BEGIN
  v_offset := (p_page - 1) * p_limit;

  SELECT COUNT(*) INTO v_total FROM (
    SELECT id FROM bills
     WHERE farmer_id = p_farmer_id
       AND dealer_id = p_dealer_id
       AND status <> 'cancelled'
       AND (p_start_date IS NULL OR bill_date >= p_start_date)
       AND (p_end_date IS NULL OR bill_date <= p_end_date)
    UNION ALL
    SELECT id FROM payments
     WHERE farmer_id = p_farmer_id
       AND dealer_id = p_dealer_id
       AND (p_start_date IS NULL OR payment_date >= p_start_date)
       AND (p_end_date IS NULL OR payment_date <= p_end_date)
  ) t;

  SELECT jsonb_agg(row_to_json(r)) INTO v_rows
  FROM (
    SELECT b.id,
           'bill' AS type,
           b.bill_number AS ref_number,
           b.bill_date AS date,
           b.total AS amount,
           b.balance_due,
           b.created_at,
           COALESCE(b.branch_name_snapshot, br.name) AS branch_name
      FROM bills b
      LEFT JOIN branches br ON br.id = b.branch_id
     WHERE b.farmer_id = p_farmer_id
       AND b.dealer_id = p_dealer_id
       AND b.status <> 'cancelled'
       AND (p_start_date IS NULL OR b.bill_date >= p_start_date)
       AND (p_end_date IS NULL OR b.bill_date <= p_end_date)
    UNION ALL
    SELECT p.id,
           'payment' AS type,
           COALESCE(p.receipt_number, UPPER(p.method), 'PAYMENT') AS ref_number,
           p.payment_date AS date,
           p.amount,
           NULL AS balance_due,
           p.created_at,
           COALESCE(p.branch_name_snapshot, br.name) AS branch_name
      FROM payments p
      LEFT JOIN branches br ON br.id = p.branch_id
     WHERE p.farmer_id = p_farmer_id
       AND p.dealer_id = p_dealer_id
       AND (p_start_date IS NULL OR p.payment_date >= p_start_date)
       AND (p_end_date IS NULL OR p.payment_date <= p_end_date)
    ORDER BY created_at DESC
    LIMIT p_limit OFFSET v_offset
  ) r;

  RETURN jsonb_build_object('total', v_total, 'page', p_page, 'limit', p_limit, 'data', COALESCE(v_rows, '[]'::jsonb));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_farmer_public_statement(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_farmer_ledger_page(UUID, UUID, INT, INT, DATE, DATE) TO authenticated;
NOTIFY pgrst, 'reload schema';
