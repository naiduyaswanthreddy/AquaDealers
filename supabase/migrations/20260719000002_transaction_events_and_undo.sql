-- =============================================================================
-- UNIVERSAL TRANSACTIONS AND SAFE 48-HOUR UNDO
-- =============================================================================
-- Transaction events are an immutable audit index. Source rows remain the
-- accounting truth; an undo changes the source row to its inactive state (or
-- removes a reversible operational record) and marks this event as undone.

CREATE TABLE IF NOT EXISTS public.transaction_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id UUID NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL,
  source_id UUID NOT NULL,
  reference TEXT,
  party_name TEXT,
  amount NUMERIC(12,2),
  quantity NUMERIC(12,2),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  undo_expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'read_only', 'undone')),
  undone_at TIMESTAMPTZ,
  undone_by UUID,
  undo_reason TEXT,
  CONSTRAINT transaction_events_source_unique UNIQUE (source_type, source_id)
);

CREATE INDEX IF NOT EXISTS idx_transaction_events_dealer_created
  ON public.transaction_events(dealer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transaction_events_dealer_branch_created
  ON public.transaction_events(dealer_id, branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transaction_events_active_expiry
  ON public.transaction_events(undo_expires_at) WHERE status = 'active';

ALTER TABLE public.transaction_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS transaction_events_dealer_select ON public.transaction_events;
CREATE POLICY transaction_events_dealer_select ON public.transaction_events
  FOR SELECT USING (dealer_id = auth.uid() OR dealer_id = public.staff_dealer_id());

CREATE OR REPLACE FUNCTION public.log_transaction_event_v1(
  p_dealer_id UUID,
  p_branch_id UUID,
  p_source_type TEXT,
  p_source_id UUID,
  p_reference TEXT,
  p_party_name TEXT,
  p_amount NUMERIC,
  p_quantity NUMERIC,
  p_details JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.transaction_events (
    dealer_id, branch_id, source_type, source_id, reference, party_name,
    amount, quantity, details, created_by, undo_expires_at
  ) VALUES (
    p_dealer_id, p_branch_id, p_source_type, p_source_id, p_reference, p_party_name,
    p_amount, p_quantity, COALESCE(p_details, '{}'::jsonb), COALESCE(auth.uid(), public.staff_dealer_id()), now() + interval '48 hours'
  )
  ON CONFLICT (source_type, source_id) DO NOTHING;
END;
$$;

-- New records are indexed automatically. The trigger intentionally records one
-- bill event instead of a duplicate farmer-payment event for the bill's initial
-- payment; later farmer payments remain individual transaction events.
CREATE OR REPLACE FUNCTION public.trg_transaction_event_bill_v1()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.log_transaction_event_v1(
    NEW.dealer_id, NEW.branch_id, 'bill', NEW.id, NEW.bill_number,
    NEW.farmer_name_snapshot, NEW.total, NULL,
    jsonb_build_object('payment_type', NEW.payment_type, 'amount_paid', COALESCE(NEW.amount_paid, 0), 'balance_due', COALESCE(NEW.balance_due, 0))
  );
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS transaction_event_bill ON public.bills;
CREATE TRIGGER transaction_event_bill AFTER INSERT ON public.bills
FOR EACH ROW EXECUTE FUNCTION public.trg_transaction_event_bill_v1();

CREATE OR REPLACE FUNCTION public.trg_transaction_event_purchase_v1()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_supplier_name TEXT;
BEGIN
  SELECT name INTO v_supplier_name FROM public.suppliers WHERE id = NEW.supplier_id;
  PERFORM public.log_transaction_event_v1(NEW.dealer_id, NEW.branch_id, 'stock_purchase', NEW.id,
    COALESCE(NEW.invoice_number, 'Purchase'), v_supplier_name, NEW.total_amount, NEW.quantity,
    jsonb_build_object('is_paid', COALESCE(NEW.is_paid, false), 'product_id', NEW.product_id));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS transaction_event_stock_purchase ON public.stock_purchases;
CREATE TRIGGER transaction_event_stock_purchase AFTER INSERT ON public.stock_purchases
FOR EACH ROW EXECUTE FUNCTION public.trg_transaction_event_purchase_v1();

CREATE OR REPLACE FUNCTION public.trg_transaction_event_supplier_payment_v1()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_supplier_name TEXT;
BEGIN
  SELECT name INTO v_supplier_name FROM public.suppliers WHERE id = NEW.supplier_id;
  PERFORM public.log_transaction_event_v1(NEW.dealer_id, NULL, 'supplier_payment', NEW.id,
    'Supplier payment', v_supplier_name, NEW.amount, NULL, jsonb_build_object('purchase_id', NEW.purchase_id, 'method', NEW.method));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS transaction_event_supplier_payment ON public.supplier_payments;
CREATE TRIGGER transaction_event_supplier_payment AFTER INSERT ON public.supplier_payments
FOR EACH ROW EXECUTE FUNCTION public.trg_transaction_event_supplier_payment_v1();

CREATE OR REPLACE FUNCTION public.trg_transaction_event_farmer_payment_v1()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_farmer_name TEXT;
BEGIN
  -- A payment created in the same transaction as a bill is represented by the bill event.
  IF NEW.bill_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.bills b WHERE b.id = NEW.bill_id AND b.created_at = NEW.created_at
  ) THEN RETURN NEW; END IF;
  SELECT name INTO v_farmer_name FROM public.farmers WHERE id = NEW.farmer_id;
  PERFORM public.log_transaction_event_v1(NEW.dealer_id, NEW.branch_id, 'farmer_payment', NEW.id,
    'Farmer payment', v_farmer_name, NEW.amount, NULL, jsonb_build_object('method', NEW.method, 'bill_id', NEW.bill_id));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS transaction_event_farmer_payment ON public.payments;
CREATE TRIGGER transaction_event_farmer_payment AFTER INSERT ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.trg_transaction_event_farmer_payment_v1();

CREATE OR REPLACE FUNCTION public.trg_transaction_event_return_v1()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_farmer_name TEXT;
BEGIN
  SELECT name INTO v_farmer_name FROM public.farmers WHERE id = NEW.farmer_id;
  PERFORM public.log_transaction_event_v1(NEW.dealer_id, NEW.branch_id, 'bill_return', NEW.id,
    NEW.return_number, v_farmer_name, NEW.total_amount, NULL, jsonb_build_object('bill_id', NEW.bill_id));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS transaction_event_bill_return ON public.bill_returns;
CREATE TRIGGER transaction_event_bill_return AFTER INSERT ON public.bill_returns
FOR EACH ROW EXECUTE FUNCTION public.trg_transaction_event_return_v1();

CREATE OR REPLACE FUNCTION public.trg_transaction_event_transfer_v1()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.log_transaction_event_v1(NEW.dealer_id, NEW.from_branch_id, 'stock_transfer', NEW.id,
    NEW.transfer_number, COALESCE(NEW.from_branch_name, '') || ' to ' || COALESCE(NEW.to_branch_name, ''),
    NULL, NEW.total_quantity, jsonb_build_object('to_branch_id', NEW.to_branch_id));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS transaction_event_stock_transfer ON public.stock_transfers;
CREATE TRIGGER transaction_event_stock_transfer AFTER INSERT ON public.stock_transfers
FOR EACH ROW EXECUTE FUNCTION public.trg_transaction_event_transfer_v1();

CREATE OR REPLACE FUNCTION public.trg_transaction_event_expense_v1()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.log_transaction_event_v1(NEW.dealer_id, NEW.branch_id, 'expense', NEW.id,
    COALESCE(NEW.category, 'Expense'), NULL, NEW.amount, NULL,
    jsonb_build_object('paid_via', NEW.paid_via, 'description', NEW.description));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS transaction_event_expense ON public.expenses;
CREATE TRIGGER transaction_event_expense AFTER INSERT ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.trg_transaction_event_expense_v1();

CREATE OR REPLACE FUNCTION public.trg_transaction_event_manual_cash_v1()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF COALESCE(NEW.source, '') IN ('bill', 'farmer_payment', 'supplier_payment', 'stock_purchase', 'expense') THEN
    RETURN NEW;
  END IF;
  PERFORM public.log_transaction_event_v1(NEW.dealer_id, NEW.branch_id, 'cash_entry', NEW.id,
    COALESCE(NEW.source, 'Cash entry'), NULL, NEW.amount, NULL,
    jsonb_build_object('entry_type', NEW.entry_type, 'notes', NEW.notes));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS transaction_event_manual_cash ON public.cash_book;
CREATE TRIGGER transaction_event_manual_cash AFTER INSERT ON public.cash_book
FOR EACH ROW EXECUTE FUNCTION public.trg_transaction_event_manual_cash_v1();

-- Existing history is useful for traceability but is intentionally read-only.
INSERT INTO public.transaction_events (dealer_id, branch_id, source_type, source_id, reference, party_name, amount, quantity, created_at, status)
SELECT b.dealer_id, b.branch_id, 'bill', b.id, b.bill_number, b.farmer_name_snapshot, b.total, NULL, b.created_at, 'read_only'
FROM public.bills b ON CONFLICT (source_type, source_id) DO NOTHING;
INSERT INTO public.transaction_events (dealer_id, branch_id, source_type, source_id, reference, amount, quantity, created_at, status)
SELECT p.dealer_id, p.branch_id, 'stock_purchase', p.id, COALESCE(p.invoice_number, 'Purchase'), p.total_amount, p.quantity, p.created_at, 'read_only'
FROM public.stock_purchases p ON CONFLICT (source_type, source_id) DO NOTHING;
INSERT INTO public.transaction_events (dealer_id, branch_id, source_type, source_id, reference, amount, created_at, status)
SELECT e.dealer_id, e.branch_id, 'expense', e.id, COALESCE(e.category, 'Expense'), e.amount, e.created_at, 'read_only'
FROM public.expenses e ON CONFLICT (source_type, source_id) DO NOTHING;
INSERT INTO public.transaction_events (dealer_id, branch_id, source_type, source_id, reference, amount, created_at, status)
SELECT p.dealer_id, p.branch_id, 'farmer_payment', p.id, 'Farmer payment', p.amount, p.created_at, 'read_only'
FROM public.payments p ON CONFLICT (source_type, source_id) DO NOTHING;
INSERT INTO public.transaction_events (dealer_id, source_type, source_id, reference, amount, created_at, status)
SELECT p.dealer_id, 'supplier_payment', p.id, 'Supplier payment', p.amount, p.created_at, 'read_only'
FROM public.supplier_payments p ON CONFLICT (source_type, source_id) DO NOTHING;
INSERT INTO public.transaction_events (dealer_id, branch_id, source_type, source_id, reference, amount, created_at, status)
SELECT r.dealer_id, r.branch_id, 'bill_return', r.id, r.return_number, r.total_amount, r.created_at, 'read_only'
FROM public.bill_returns r ON CONFLICT (source_type, source_id) DO NOTHING;
INSERT INTO public.transaction_events (dealer_id, branch_id, source_type, source_id, reference, quantity, created_at, status)
SELECT t.dealer_id, t.from_branch_id, 'stock_transfer', t.id, t.transfer_number, t.total_quantity, t.created_at, 'read_only'
FROM public.stock_transfers t ON CONFLICT (source_type, source_id) DO NOTHING;
INSERT INTO public.transaction_events (dealer_id, branch_id, source_type, source_id, reference, amount, created_at, status)
SELECT c.dealer_id, c.branch_id, 'cash_entry', c.id, COALESCE(c.source, 'Cash entry'), c.amount, c.created_at, 'read_only'
FROM public.cash_book c
WHERE COALESCE(c.source, '') NOT IN ('bill', 'farmer_payment', 'supplier_payment', 'stock_purchase', 'purchase', 'expense')
ON CONFLICT (source_type, source_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_transaction_events_v1(
  p_branch_id UUID DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_type TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_dealer_id UUID := COALESCE(auth.uid(), public.staff_dealer_id());
DECLARE v_total BIGINT;
DECLARE v_data JSONB;
BEGIN
  IF v_dealer_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT count(*) INTO v_total FROM public.transaction_events e
   WHERE e.dealer_id = v_dealer_id
     AND (p_branch_id IS NULL OR e.branch_id = p_branch_id)
     AND (p_start_date IS NULL OR e.created_at::date >= p_start_date)
     AND (p_end_date IS NULL OR e.created_at::date <= p_end_date)
     AND (p_type IS NULL OR e.source_type = p_type)
     AND (p_status IS NULL OR e.status = p_status)
     AND (p_search IS NULL OR concat_ws(' ', e.reference, e.party_name, e.source_type) ILIKE '%' || p_search || '%');
  SELECT COALESCE(jsonb_agg(row_to_json(x) ORDER BY x.created_at DESC), '[]'::jsonb) INTO v_data FROM (
    SELECT e.*, b.name AS branch_name,
      (e.status = 'active' AND e.undo_expires_at > now()
       AND e.source_type IN ('bill', 'farmer_payment', 'stock_purchase', 'supplier_payment', 'stock_transfer', 'expense', 'cash_entry')) AS can_undo,
      CASE WHEN e.status = 'undone' THEN 'Undone'
           WHEN e.status = 'read_only' THEN 'History only'
           WHEN e.undo_expires_at <= now() THEN 'Undo window ended'
           ELSE 'Undo available' END AS undo_state
    FROM public.transaction_events e LEFT JOIN public.branches b ON b.id = e.branch_id
    WHERE e.dealer_id = v_dealer_id
      AND (p_branch_id IS NULL OR e.branch_id = p_branch_id)
      AND (p_start_date IS NULL OR e.created_at::date >= p_start_date)
      AND (p_end_date IS NULL OR e.created_at::date <= p_end_date)
      AND (p_type IS NULL OR e.source_type = p_type)
      AND (p_status IS NULL OR e.status = p_status)
      AND (p_search IS NULL OR concat_ws(' ', e.reference, e.party_name, e.source_type) ILIKE '%' || p_search || '%')
    ORDER BY e.created_at DESC LIMIT LEAST(GREATEST(p_limit, 1), 100) OFFSET GREATEST(p_offset, 0)
  ) x;
  RETURN jsonb_build_object('data', v_data, 'total', v_total);
END;
$$;

-- This function is deliberately conservative. It performs reversals only where
-- the original source can be reconstructed exactly; later dependent activity
-- produces an actionable error instead of corrupting inventory or balances.
CREATE OR REPLACE FUNCTION public.undo_transaction_v1(p_event_id UUID, p_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_dealer_id UUID := COALESCE(auth.uid(), public.staff_dealer_id());
  v_event public.transaction_events%ROWTYPE;
  v_bill public.bills%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_purchase public.stock_purchases%ROWTYPE;
  v_supplier_payment public.supplier_payments%ROWTYPE;
  v_expense public.expenses%ROWTYPE;
  v_cash public.cash_book%ROWTYPE;
  v_return public.bill_returns%ROWTYPE;
  v_transfer public.stock_transfers%ROWTYPE;
  v_item RECORD;
  v_farmer_due NUMERIC;
BEGIN
  IF v_dealer_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF length(trim(COALESCE(p_reason, ''))) < 3 THEN RAISE EXCEPTION 'An undo reason of at least 3 characters is required'; END IF;
  SELECT * INTO v_event FROM public.transaction_events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND OR v_event.dealer_id <> v_dealer_id THEN RAISE EXCEPTION 'Transaction not found'; END IF;
  IF v_event.status <> 'active' THEN RAISE EXCEPTION 'This transaction has already been %', v_event.status; END IF;
  IF v_event.undo_expires_at IS NULL OR v_event.undo_expires_at <= now() THEN RAISE EXCEPTION 'The 48-hour undo window has ended'; END IF;

  IF v_event.source_type = 'bill' THEN
    SELECT * INTO v_bill FROM public.bills WHERE id = v_event.source_id FOR UPDATE;
    IF NOT FOUND OR v_bill.status = 'cancelled' OR v_bill.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'The bill is already inactive'; END IF;
    IF COALESCE(v_bill.is_edited, false) THEN RAISE EXCEPTION 'This bill was edited later and must be handled from the bill editor'; END IF;
    IF EXISTS (SELECT 1 FROM public.bill_returns WHERE bill_id = v_bill.id) THEN RAISE EXCEPTION 'A return was recorded against this bill'; END IF;
    IF EXISTS (SELECT 1 FROM public.payment_allocations pa JOIN public.payments p ON p.id = pa.payment_id WHERE pa.bill_id = v_bill.id AND p.created_at > v_bill.created_at) THEN RAISE EXCEPTION 'A later farmer payment was allocated to this bill'; END IF;
    FOR v_item IN SELECT lot_id, inventory_id, product_id, quantity FROM public.bill_item_lot_allocations WHERE bill_id = v_bill.id FOR UPDATE LOOP
      UPDATE public.inventory_lots SET remaining_quantity = remaining_quantity + v_item.quantity WHERE id = v_item.lot_id;
      UPDATE public.inventory SET quantity_in_stock = quantity_in_stock + v_item.quantity, updated_at = now() WHERE id = v_item.inventory_id;
    END LOOP;
    DELETE FROM public.inventory_movements WHERE reference_type = 'bill' AND reference_id = v_bill.id;
    DELETE FROM public.cash_book
     WHERE (source = 'bill' AND reference_id = v_bill.id)
        OR (source IN ('farmer_payment', 'cash_sale') AND reference_id IN (SELECT id FROM public.payments WHERE bill_id = v_bill.id));
    DELETE FROM public.payment_allocations WHERE payment_id IN (SELECT id FROM public.payments WHERE bill_id = v_bill.id);
    DELETE FROM public.payments WHERE bill_id = v_bill.id;
    UPDATE public.bills SET status = 'cancelled', balance_due = 0, amount_paid = 0 WHERE id = v_bill.id;
    IF v_bill.farmer_id IS NOT NULL THEN
      SELECT COALESCE(SUM(balance_due), 0) INTO v_farmer_due FROM public.bills WHERE farmer_id = v_bill.farmer_id AND dealer_id = v_dealer_id AND deleted_at IS NULL AND status <> 'cancelled';
      UPDATE public.farmers SET total_due = v_farmer_due WHERE id = v_bill.farmer_id;
    END IF;
  ELSIF v_event.source_type = 'farmer_payment' THEN
    SELECT * INTO v_payment FROM public.payments WHERE id = v_event.source_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'The payment is no longer active'; END IF;
    IF EXISTS (SELECT 1 FROM public.bill_returns r JOIN public.payment_allocations pa ON pa.bill_id = r.bill_id WHERE pa.payment_id = v_payment.id) THEN RAISE EXCEPTION 'A later return affects a bill paid by this payment'; END IF;
    UPDATE public.bills b SET balance_due = b.balance_due + a.allocated_amount, amount_paid = GREATEST(0, b.amount_paid - a.allocated_amount)
      FROM public.payment_allocations a WHERE a.payment_id = v_payment.id AND b.id = a.bill_id;
    DELETE FROM public.cash_book WHERE source = 'farmer_payment' AND reference_id = v_payment.id;
    DELETE FROM public.payment_allocations WHERE payment_id = v_payment.id;
    DELETE FROM public.payments WHERE id = v_payment.id;
    SELECT COALESCE(SUM(balance_due), 0) INTO v_farmer_due FROM public.bills WHERE farmer_id = v_payment.farmer_id AND dealer_id = v_dealer_id AND deleted_at IS NULL AND status <> 'cancelled';
    UPDATE public.farmers SET total_due = v_farmer_due WHERE id = v_payment.farmer_id;
  ELSIF v_event.source_type = 'stock_purchase' THEN
    SELECT * INTO v_purchase FROM public.stock_purchases WHERE id = v_event.source_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'The purchase is no longer active'; END IF;
    IF EXISTS (SELECT 1 FROM public.inventory_lots WHERE stock_purchase_id = v_purchase.id AND remaining_quantity < quantity_received) THEN RAISE EXCEPTION 'Some stock from this purchase was sold, returned, adjusted, or transferred later'; END IF;
    FOR v_item IN SELECT inventory_id, product_id, quantity_received FROM public.inventory_lots WHERE stock_purchase_id = v_purchase.id FOR UPDATE LOOP
      UPDATE public.inventory SET quantity_in_stock = quantity_in_stock - v_item.quantity_received, updated_at = now() WHERE id = v_item.inventory_id AND quantity_in_stock >= v_item.quantity_received;
      IF NOT FOUND THEN RAISE EXCEPTION 'Current stock no longer permits undoing this purchase'; END IF;
    END LOOP;
    DELETE FROM public.inventory_movements WHERE reference_type IN ('stock_purchase', 'purchase') AND reference_id = v_purchase.id;
    DELETE FROM public.inventory_lots WHERE stock_purchase_id = v_purchase.id;
    IF NOT COALESCE(v_purchase.is_paid, false) THEN UPDATE public.suppliers SET total_due = GREATEST(0, total_due - COALESCE(v_purchase.total_amount, 0)) WHERE id = v_purchase.supplier_id; END IF;
    DELETE FROM public.cash_book WHERE source IN ('stock_purchase', 'purchase') AND reference_id = v_purchase.id;
    DELETE FROM public.stock_purchases WHERE id = v_purchase.id;
  ELSIF v_event.source_type = 'supplier_payment' THEN
    SELECT * INTO v_supplier_payment FROM public.supplier_payments WHERE id = v_event.source_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'The supplier payment is no longer active'; END IF;
    UPDATE public.suppliers SET total_due = total_due + v_supplier_payment.amount WHERE id = v_supplier_payment.supplier_id;
    DELETE FROM public.cash_book WHERE source = 'supplier_payment' AND reference_id = v_supplier_payment.id;
    DELETE FROM public.supplier_payments WHERE id = v_supplier_payment.id;
  ELSIF v_event.source_type = 'expense' THEN
    SELECT * INTO v_expense FROM public.expenses WHERE id = v_event.source_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'The expense is no longer active'; END IF;
    DELETE FROM public.cash_book WHERE source = 'expense' AND reference_id = v_expense.id;
    DELETE FROM public.expenses WHERE id = v_expense.id;
  ELSIF v_event.source_type = 'cash_entry' THEN
    SELECT * INTO v_cash FROM public.cash_book WHERE id = v_event.source_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'The cash entry is no longer active'; END IF;
    DELETE FROM public.cash_book WHERE id = v_cash.id;
  ELSIF v_event.source_type = 'stock_transfer' THEN
    SELECT * INTO v_transfer FROM public.stock_transfers WHERE id = v_event.source_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'The transfer is no longer active'; END IF;
    IF EXISTS (SELECT 1 FROM public.stock_transfer_items i JOIN public.inventory_lots l ON l.id = i.to_lot_id WHERE i.transfer_id = v_transfer.id AND l.remaining_quantity < i.quantity) THEN RAISE EXCEPTION 'Transferred stock was used at the destination branch'; END IF;
    FOR v_item IN SELECT * FROM public.stock_transfer_items WHERE transfer_id = v_transfer.id FOR UPDATE LOOP
      IF v_item.from_lot_id IS NOT NULL THEN UPDATE public.inventory_lots SET remaining_quantity = remaining_quantity + v_item.quantity WHERE id = v_item.from_lot_id; END IF;
      IF v_item.to_lot_id IS NOT NULL THEN DELETE FROM public.inventory_lots WHERE id = v_item.to_lot_id; END IF;
      UPDATE public.inventory SET quantity_in_stock = quantity_in_stock + v_item.quantity, updated_at = now() WHERE dealer_id = v_dealer_id AND branch_id = v_transfer.from_branch_id AND product_id = v_item.product_id;
      UPDATE public.inventory SET quantity_in_stock = quantity_in_stock - v_item.quantity, updated_at = now() WHERE dealer_id = v_dealer_id AND branch_id = v_transfer.to_branch_id AND product_id = v_item.product_id AND quantity_in_stock >= v_item.quantity;
      IF NOT FOUND THEN RAISE EXCEPTION 'Destination stock no longer permits undoing this transfer'; END IF;
    END LOOP;
    DELETE FROM public.inventory_movements WHERE reference_type = 'transfer' AND reference_id = v_transfer.id;
    DELETE FROM public.stock_transfers WHERE id = v_transfer.id;
  ELSE
    RAISE EXCEPTION 'Undo is not available yet for transaction type %', v_event.source_type;
  END IF;
  UPDATE public.transaction_events SET status = 'undone', undone_at = now(), undone_by = COALESCE(auth.uid(), public.staff_dealer_id()), undo_reason = trim(p_reason) WHERE id = v_event.id;
  RETURN jsonb_build_object('event_id', v_event.id, 'status', 'undone');
END;
$$;

REVOKE ALL ON FUNCTION public.get_transaction_events_v1(UUID, DATE, DATE, TEXT, TEXT, TEXT, INT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.undo_transaction_v1(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_transaction_events_v1(UUID, DATE, DATE, TEXT, TEXT, TEXT, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.undo_transaction_v1(UUID, TEXT) TO authenticated;
