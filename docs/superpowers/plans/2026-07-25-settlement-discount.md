# Settlement Discount Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a settlement discount field to bills so a dealer can reduce the effective bill amount when a farmer pays less than the full total, with the shortfall recorded as a bill-level discount rather than a write-off.

**Architecture:** A new `settlement_discount_amount` column on `bills` stores the post-creation negotiated discount. `balance_due = total - settlement_discount_amount - amount_paid`. A new `apply_settlement_discount_v1` RPC applies it atomically on existing bills, and `create_bill_v2` is updated to accept it at bill-creation time. The frontend adds the field to `PaymentStep`, a button+modal to `BillDetailsPage`, a line to all 5 bill templates, and shows the effective amount in the farmer ledger.

**Tech Stack:** PostgreSQL (Supabase), TypeScript, React, Zustand, TanStack Query, Tailwind CSS, Vitest

## Global Constraints

- All money columns: `NUMERIC(12,2)`
- Migrations: timestamped `YYYYMMDDNNNNNN_name.sql` in `supabase/migrations/`
- Today's date for new migrations: `20260725`
- `settlement_discount_amount` is always `>= 0` and `<= bill.total - bill.amount_paid`
- Farmer `total_due` must always equal sum of `balance_due` across active bills — the RPC must keep this in sync
- Settlement discount cannot be applied to cancelled bills
- Walk-in customers (`farmer_id IS NULL`) can have settlement discounts applied at creation only (no post-creation, since they must pay in full)
- No new npm dependencies

---

## Task 1: DB Migration — Schema + RPCs

**Files:**
- Create: `supabase/migrations/20260725000000_settlement_discount.sql`

**Interfaces:**
- Produces: `bills.settlement_discount_amount`, `bills.settlement_discount_reason`, `apply_settlement_discount_v1(JSONB)` RPC, updated `create_bill_v2`, updated `get_farmer_ledger_page`

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/20260725000000_settlement_discount.sql

-- ──────────────────────────────────────────────────────────────
-- 1. Schema: add settlement discount columns to bills
-- ──────────────────────────────────────────────────────────────
ALTER TABLE bills
  ADD COLUMN IF NOT EXISTS settlement_discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS settlement_discount_reason TEXT;

-- ──────────────────────────────────────────────────────────────
-- 2. Update create_bill_v2 to accept settlement_discount_amount
--    Changes from 20260717000016:
--    • New variable v_settlement_discount read from payload
--    • balance_due now: total - settlement_discount - amount_paid
--    • bills INSERT includes settlement_discount_amount column
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_bill_v2(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $create_bill_fifo$
DECLARE
  v_bill_id UUID;
  v_bill_number TEXT;
  v_payment_id UUID;
  v_item JSONB;
  v_lot RECORD;
  v_inventory RECORD;
  v_bill_item_id UUID;
  v_farmer_due_add NUMERIC(12,2);
  v_balance_due NUMERIC(12,2);
  v_subtotal NUMERIC(12,2) := 0;
  v_gst_amount NUMERIC(12,2) := 0;
  v_total NUMERIC(12,2);
  v_amount_paid NUMERIC(12,2);
  v_dealer_id UUID;
  v_branch_id UUID;
  v_is_historical BOOLEAN;
  v_reduce_stock BOOLEAN;
  v_remaining NUMERIC;
  v_take NUMERIC;
  v_unit_price NUMERIC;
  v_line_subtotal NUMERIC;
  v_line_gst NUMERIC;
  v_payload_discount NUMERIC;
  v_settlement_discount NUMERIC(12,2);
BEGIN
  v_dealer_id := (p_payload->>'dealer_id')::UUID;
  v_branch_id := NULLIF(p_payload->>'branch_id', '')::UUID;
  v_is_historical := COALESCE((p_payload->>'is_historical')::BOOLEAN, false);
  v_reduce_stock := COALESCE((p_payload->>'reduce_stock')::BOOLEAN, true);
  v_payload_discount := COALESCE((p_payload->>'discount_amount')::NUMERIC, 0);
  v_settlement_discount := COALESCE((p_payload->>'settlement_discount_amount')::NUMERIC, 0);
  v_amount_paid := COALESCE((p_payload->>'amount_paid')::NUMERIC, 0);
  v_bill_number := COALESCE(NULLIF(p_payload->>'bill_number', ''), public.generate_receipt_number('AD'));

  PERFORM public.assert_dealer_access(v_dealer_id);

  IF NOT v_reduce_stock THEN
    v_subtotal := COALESCE((p_payload->>'subtotal')::NUMERIC, 0);
    v_gst_amount := COALESCE((p_payload->>'gst_amount')::NUMERIC, 0);
  ELSE
    SELECT subtotal, gst_amount
    INTO v_subtotal, v_gst_amount
    FROM jsonb_to_record(public.preview_fifo_bill_lines(p_payload)) AS x(subtotal NUMERIC, gst_amount NUMERIC);
  END IF;

  v_total := GREATEST(ROUND(v_subtotal + v_gst_amount - v_payload_discount, 2), 0);
  v_balance_due := GREATEST(v_total - v_settlement_discount - v_amount_paid, 0);
  v_farmer_due_add := v_balance_due;

  INSERT INTO bills (
    bill_number, dealer_id, branch_id, farmer_id, farmer_name_snapshot, farmer_gstin, bill_date,
    subtotal, gst_amount, cgst_amount, sgst_amount, igst_amount, discount_amount, total,
    settlement_discount_amount, settlement_discount_reason,
    amount_paid, balance_due, payment_type, upi_ref, cheque_number, notes, status,
    credit_override_used, credit_override_reason, is_historical, type, is_verified, verification_method, delivery_pin
  ) VALUES (
    v_bill_number, v_dealer_id, v_branch_id, NULLIF(p_payload->>'farmer_id', '')::UUID,
    NULLIF(p_payload->>'farmer_name_snapshot', ''), NULLIF(p_payload->>'farmer_gstin', ''),
    COALESCE(NULLIF(p_payload->>'bill_date', '')::DATE, CURRENT_DATE),
    v_subtotal, v_gst_amount, ROUND(v_gst_amount / 2, 2), ROUND(v_gst_amount / 2, 2),
    COALESCE((p_payload->>'igst_amount')::NUMERIC, 0), v_payload_discount, v_total,
    v_settlement_discount, NULLIF(p_payload->>'settlement_discount_reason', ''),
    v_amount_paid, v_balance_due, NULLIF(p_payload->>'payment_type', ''), NULLIF(p_payload->>'upi_ref', ''),
    NULLIF(p_payload->>'cheque_number', ''), NULLIF(p_payload->>'notes', ''), 'active',
    COALESCE((p_payload->>'credit_override_used')::BOOLEAN, false), NULLIF(p_payload->>'credit_override_reason', ''),
    v_is_historical, 'sale', COALESCE((p_payload->>'is_verified')::BOOLEAN, true), NULLIF(p_payload->>'verification_method', ''), NULLIF(p_payload->>'delivery_pin', '')
  )
  RETURNING id INTO v_bill_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'items', '[]'::jsonb))
  LOOP
    SELECT *
    INTO v_inventory
    FROM inventory
    WHERE id = (v_item->>'inventory_id')::UUID
      AND dealer_id = v_dealer_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Inventory item % not found', v_item->>'inventory_id';
    END IF;

    IF v_reduce_stock AND COALESCE(v_inventory.quantity_in_stock, 0) < COALESCE((v_item->>'quantity')::NUMERIC, 0) THEN
      RAISE EXCEPTION 'Insufficient stock for product %', v_item->>'product_name';
    END IF;

    IF NOT v_reduce_stock THEN
      v_line_subtotal := ROUND(COALESCE((v_item->>'quantity')::NUMERIC, 0) * COALESCE((v_item->>'unit_price')::NUMERIC, 0), 2);
      v_line_gst := ROUND(v_line_subtotal * COALESCE((v_item->>'gst_rate')::NUMERIC, 0) / 100, 2);
      INSERT INTO bill_items (
        bill_id, product_id, product_name_snapshot, hsn_code_snapshot, quantity, unit_price, mrp,
        gst_rate, gst_amount, cgst_amount, sgst_amount, total_price, inventory_id_snapshot
      ) VALUES (
        v_bill_id, NULLIF(v_item->>'product_id', '')::UUID, NULLIF(v_item->>'product_name', ''),
        NULLIF(v_item->>'hsn_code', ''), COALESCE((v_item->>'quantity')::NUMERIC, 0),
        COALESCE((v_item->>'unit_price')::NUMERIC, 0), NULLIF(v_item->>'mrp', '')::NUMERIC,
        COALESCE((v_item->>'gst_rate')::NUMERIC, 0), v_line_gst, ROUND(v_line_gst / 2, 2),
        ROUND(v_line_gst / 2, 2), v_line_subtotal + v_line_gst, v_inventory.id
      );
      CONTINUE;
    END IF;

    v_remaining := COALESCE((v_item->>'quantity')::NUMERIC, 0);
    FOR v_lot IN
      SELECT *
      FROM inventory_lots
      WHERE dealer_id = v_dealer_id
        AND inventory_id = v_inventory.id
        AND remaining_quantity > 0
      ORDER BY expiry_date NULLS LAST, received_at, created_at
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_take := LEAST(v_lot.remaining_quantity, v_remaining);

      v_unit_price := COALESCE(
        NULLIF(v_item->>'unit_price', '')::NUMERIC,
        v_lot.final_unit_price,
        v_lot.selling_price,
        v_inventory.selling_price,
        0
      );
      v_line_subtotal := ROUND(v_take * v_unit_price, 2);
      v_line_gst := ROUND(v_line_subtotal * COALESCE((v_item->>'gst_rate')::NUMERIC, 0) / 100, 2);

      INSERT INTO bill_items (
        bill_id, product_id, product_name_snapshot, hsn_code_snapshot, quantity, unit_price, mrp,
        gst_rate, gst_amount, cgst_amount, sgst_amount, total_price, inventory_id_snapshot
      ) VALUES (
        v_bill_id, v_inventory.product_id, NULLIF(v_item->>'product_name', ''), NULLIF(v_item->>'hsn_code', ''),
        v_take, v_unit_price, COALESCE(v_lot.mrp, v_inventory.mrp), COALESCE((v_item->>'gst_rate')::NUMERIC, 0),
        v_line_gst, ROUND(v_line_gst / 2, 2), ROUND(v_line_gst / 2, 2), v_line_subtotal + v_line_gst, v_inventory.id
      )
      RETURNING id INTO v_bill_item_id;

      UPDATE inventory_lots
      SET remaining_quantity = remaining_quantity - v_take
      WHERE id = v_lot.id;

      INSERT INTO bill_item_lot_allocations (
        dealer_id, bill_id, bill_item_id, inventory_id, lot_id, product_id, quantity, unit_price
      ) VALUES (
        v_dealer_id, v_bill_id, v_bill_item_id, v_inventory.id, v_lot.id, v_inventory.product_id, v_take, v_unit_price
      );

      INSERT INTO inventory_movements (
        dealer_id, branch_id, inventory_id, product_id, lot_id, reference_type, reference_id, quantity_change, notes, created_at
      ) VALUES (
        v_dealer_id, v_branch_id, v_inventory.id, v_inventory.product_id, v_lot.id, 'bill', v_bill_id, -v_take,
        'Consumed through FIFO-priced bill', COALESCE(NULLIF(p_payload->>'bill_date', '')::TIMESTAMPTZ, now())
      );

      v_remaining := v_remaining - v_take;
    END LOOP;

    UPDATE inventory
    SET quantity_in_stock = quantity_in_stock - COALESCE((v_item->>'quantity')::NUMERIC, 0),
        updated_at = now()
    WHERE id = v_inventory.id;
  END LOOP;

  IF NULLIF(p_payload->>'farmer_id', '') IS NOT NULL AND v_farmer_due_add > 0 THEN
    UPDATE farmers
    SET total_due = COALESCE(total_due, 0) + v_farmer_due_add
    WHERE id = (p_payload->>'farmer_id')::UUID
      AND dealer_id = v_dealer_id;
  END IF;

  IF v_amount_paid > 0 THEN
    INSERT INTO payments (
      dealer_id, branch_id, farmer_id, bill_id, amount, payment_date, method, upi_ref, cheque_no,
      notes, allocation_mode, receipt_number
    ) VALUES (
      v_dealer_id, v_branch_id, NULLIF(p_payload->>'farmer_id', '')::UUID, v_bill_id, v_amount_paid,
      COALESCE(NULLIF(p_payload->>'bill_date', '')::DATE, CURRENT_DATE), NULLIF(p_payload->>'payment_type', ''),
      NULLIF(p_payload->>'upi_ref', ''), NULLIF(p_payload->>'cheque_number', ''), NULLIF(p_payload->>'notes', ''),
      'specific_bill', public.generate_receipt_number('RCPT')
    )
    RETURNING id INTO v_payment_id;

    INSERT INTO payment_allocations (dealer_id, payment_id, bill_id, farmer_id, allocated_amount, allocation_order)
    VALUES (v_dealer_id, v_payment_id, v_bill_id, NULLIF(p_payload->>'farmer_id', '')::UUID, v_amount_paid, 1);

    INSERT INTO cash_book (dealer_id, branch_id, entry_type, source, reference_id, amount, notes, entry_date)
    VALUES (
      v_dealer_id, v_branch_id, 'income',
      CASE WHEN NULLIF(p_payload->>'farmer_id', '') IS NULL THEN 'cash_sale' ELSE 'farmer_payment' END,
      v_payment_id, v_amount_paid, 'Payment received for bill ' || v_bill_number,
      COALESCE(NULLIF(p_payload->>'bill_date', '')::DATE, CURRENT_DATE)
    );
  END IF;

  RETURN jsonb_build_object(
    'bill_id', v_bill_id,
    'bill_number', v_bill_number,
    'payment_id', v_payment_id,
    'balance_due', v_balance_due,
    'subtotal', v_subtotal,
    'gst_amount', v_gst_amount,
    'total', v_total
  );
END;
$create_bill_fifo$;

GRANT EXECUTE ON FUNCTION public.create_bill_v2(JSONB) TO authenticated;

-- ──────────────────────────────────────────────────────────────
-- 3. Update get_farmer_ledger_page: bill amount = effective total
--    (total - settlement_discount_amount) so running balance is correct
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_farmer_ledger_page(
  p_farmer_id     UUID,
  p_dealer_id     UUID,
  p_page          INT DEFAULT 1,
  p_limit         INT DEFAULT 20,
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
    SELECT
      id,
      'bill' AS type,
      bill_number AS ref_number,
      bill_date AS date,
      (total - COALESCE(settlement_discount_amount, 0)) AS amount,
      balance_due,
      created_at
    FROM bills
    WHERE farmer_id = p_farmer_id
      AND dealer_id = p_dealer_id
      AND status <> 'cancelled'
      AND (p_start_date IS NULL OR bill_date >= p_start_date)
      AND (p_end_date IS NULL OR bill_date <= p_end_date)
    UNION ALL
    SELECT
      id,
      'payment' AS type,
      COALESCE(receipt_number, UPPER(method), 'PAYMENT') AS ref_number,
      payment_date AS date,
      amount,
      NULL AS balance_due,
      created_at
    FROM payments
    WHERE farmer_id = p_farmer_id
      AND dealer_id = p_dealer_id
      AND (p_start_date IS NULL OR payment_date >= p_start_date)
      AND (p_end_date IS NULL OR payment_date <= p_end_date)
    ORDER BY created_at DESC
    LIMIT p_limit OFFSET v_offset
  ) r;

  RETURN jsonb_build_object(
    'total', v_total,
    'page', p_page,
    'limit', p_limit,
    'data', COALESCE(v_rows, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_farmer_ledger_page(UUID, UUID, INT, INT, DATE, DATE) TO authenticated;

-- ──────────────────────────────────────────────────────────────
-- 4. New RPC: apply_settlement_discount_v1
--    Applies/updates settlement discount on an existing bill.
--    Atomically updates bill.balance_due and farmers.total_due.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.apply_settlement_discount_v1(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bill           bills%ROWTYPE;
  v_dealer_id      UUID;
  v_bill_id        UUID;
  v_amount         NUMERIC(12,2);
  v_reason         TEXT;
  v_old_settlement NUMERIC(12,2);
  v_delta          NUMERIC(12,2);
  v_new_balance    NUMERIC(12,2);
BEGIN
  v_dealer_id := (p_payload->>'dealer_id')::UUID;
  v_bill_id   := (p_payload->>'bill_id')::UUID;
  v_amount    := COALESCE((p_payload->>'amount')::NUMERIC, 0);
  v_reason    := NULLIF(p_payload->>'reason', '');

  PERFORM public.assert_dealer_access(v_dealer_id);

  SELECT * INTO v_bill
  FROM bills
  WHERE id = v_bill_id AND dealer_id = v_dealer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bill not found';
  END IF;
  IF v_bill.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot apply settlement discount to a cancelled bill';
  END IF;
  IF v_amount < 0 THEN
    RAISE EXCEPTION 'Settlement discount cannot be negative';
  END IF;
  IF v_amount > v_bill.total THEN
    RAISE EXCEPTION 'Settlement discount cannot exceed bill total';
  END IF;
  IF (v_bill.total - v_amount) < v_bill.amount_paid THEN
    RAISE EXCEPTION 'Settlement discount cannot reduce effective total below amount already paid';
  END IF;

  v_old_settlement := COALESCE(v_bill.settlement_discount_amount, 0);
  v_delta          := v_amount - v_old_settlement;
  v_new_balance    := GREATEST(v_bill.total - v_amount - v_bill.amount_paid, 0);

  UPDATE bills
  SET settlement_discount_amount = v_amount,
      settlement_discount_reason = v_reason,
      balance_due                = v_new_balance
  WHERE id = v_bill_id;

  IF v_bill.farmer_id IS NOT NULL THEN
    UPDATE farmers
    SET total_due = total_due - v_delta
    WHERE id = v_bill.farmer_id AND dealer_id = v_dealer_id;
  END IF;

  INSERT INTO bill_audit_logs (bill_id, dealer_id, action, old_value, new_value)
  VALUES (
    v_bill_id,
    v_dealer_id,
    'settlement_discount_applied',
    jsonb_build_object('settlement_discount_amount', v_old_settlement),
    jsonb_build_object('settlement_discount_amount', v_amount, 'reason', v_reason)
  );

  RETURN jsonb_build_object(
    'bill_id',                    v_bill_id,
    'settlement_discount_amount', v_amount,
    'balance_due',                v_new_balance
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_settlement_discount_v1(JSONB) TO authenticated;

NOTIFY pgrst, 'reload schema';
```

- [ ] **Step 2: Apply the migration to the Supabase project**

```bash
npx supabase db push --db-url "postgresql://postgres.fvcafioxkgbljcjomixs:PASSWORD@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
```

Or via Supabase dashboard SQL editor — paste and run the file contents.

- [ ] **Step 3: Verify schema change**

In Supabase dashboard or psql, run:
```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'bills'
  AND column_name IN ('settlement_discount_amount', 'settlement_discount_reason');
```
Expected: 2 rows returned with `numeric` and `text` types.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260725000000_settlement_discount.sql
git commit -m "feat: add settlement_discount_amount to bills — schema + 3 RPCs"
```

---

## Task 2: TypeScript Types + billingService

**Files:**
- Modify: `src/types/database.ts` (Bill interface, ~line 265)
- Modify: `src/features/billing/types.ts` (BillingPayload interface, ~line 26)
- Modify: `src/features/billing/services/billingService.ts` (add `applySettlementDiscount` method)

**Interfaces:**
- Consumes: `apply_settlement_discount_v1` RPC from Task 1
- Produces: `Bill.settlement_discount_amount`, `Bill.settlement_discount_reason`, `BillingPayload.settlement_discount_amount`, `billingService.applySettlementDiscount()`

- [ ] **Step 1: Add fields to the Bill interface in `src/types/database.ts`**

After `discount_amount: number;` (~line 279), add:
```typescript
  settlement_discount_amount: number;
  settlement_discount_reason: string | null;
```

- [ ] **Step 2: Add optional field to BillingPayload in `src/features/billing/types.ts`**

After `discount_amount: number;` (~line 38), add:
```typescript
  settlement_discount_amount?: number;
  settlement_discount_reason?: string | null;
```

- [ ] **Step 3: Add `applySettlementDiscount` to billingService**

In `src/features/billing/services/billingService.ts`, after `editBillPayment` (~line 233), add:
```typescript
  async applySettlementDiscount(payload: {
    dealer_id: string;
    bill_id: string;
    amount: number;
    reason?: string | null;
  }): Promise<{ bill_id: string; settlement_discount_amount: number; balance_due: number }> {
    const { data, error } = await supabase.rpc('apply_settlement_discount_v1', {
      p_payload: payload,
    });
    if (error) throw new Error(`Failed to apply settlement discount: ${error.message}`);
    return data;
  },
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors related to the new fields.

- [ ] **Step 5: Commit**

```bash
git add src/types/database.ts src/features/billing/types.ts src/features/billing/services/billingService.ts
git commit -m "feat: add settlement discount types and billingService.applySettlementDiscount"
```

---

## Task 3: Cart Store + useCheckout

**Files:**
- Modify: `src/features/billing/stores/cartStore.ts`
- Modify: `src/features/billing/hooks/useCheckout.ts`

**Interfaces:**
- Consumes: `BillingPayload.settlement_discount_amount` from Task 2
- Produces: `useCartStore().settlementDiscountAmount`, `useCartStore().setSettlementDiscount(amount)`; `buildPayload` includes `settlement_discount_amount`

- [ ] **Step 1: Write a failing test for buildPayload including settlement discount**

In `src/features/billing/stores/cartStore.test.ts`, add at the end:
```typescript
describe('settlementDiscountAmount state', () => {
  it('initialises to 0', () => {
    const { settlementDiscountAmount } = useCartStore.getState();
    expect(settlementDiscountAmount).toBe(0);
  });

  it('setSettlementDiscount updates the value', () => {
    useCartStore.getState().setSettlementDiscount(200);
    expect(useCartStore.getState().settlementDiscountAmount).toBe(200);
    // cleanup
    useCartStore.getState().setSettlementDiscount(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/features/billing/stores/cartStore.test.ts
```
Expected: FAIL — `settlementDiscountAmount` is undefined.

- [ ] **Step 3: Add `settlementDiscountAmount` to cartStore**

In `src/features/billing/stores/cartStore.ts`:

a) In `DraftFields` type (~line 8), add after `discountAmount: number;`:
```typescript
  settlementDiscountAmount: number;
```

b) In `CartState` interface (~line 31), add after `setDiscount`:
```typescript
  setSettlementDiscount: (amount: number) => void;
```

c) In `emptyDraftFields()` (~line 65), add after `discountAmount: 0,`:
```typescript
  settlementDiscountAmount: 0,
```

d) In `toActiveFields` (~line 89), add after `discountAmount: draft.discountAmount,`:
```typescript
  settlementDiscountAmount: draft.settlementDiscountAmount,
```

e) In the store actions (~line 226 after `setDiscount`), add:
```typescript
        setSettlementDiscount: (settlementDiscountAmount) => updateActiveDraft((draft) => ({ ...draft, settlementDiscountAmount })),
```

f) In `clearItems` action, reset it (already covered by spreading `emptyDraftFields()` — verify the clearItems function uses `emptyDraftFields` or add `settlementDiscountAmount: 0` explicitly if needed).

- [ ] **Step 4: Update useCheckout to include settlementDiscountAmount in buildPayload**

In `src/features/billing/hooks/useCheckout.ts`:

a) In the destructure of `useCartStore()` (~line 48), add after `discountAmount,`:
```typescript
    settlementDiscountAmount,
```

b) In `buildPayload` (~line 100 in the return object), add after `discount_amount: discountAmount,`:
```typescript
      settlement_discount_amount: settlementDiscountAmount || undefined,
```

c) Add `settlementDiscountAmount` to the `useCallback` deps array at the end of `buildPayload`.

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run src/features/billing/stores/cartStore.test.ts
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/features/billing/stores/cartStore.ts src/features/billing/hooks/useCheckout.ts src/features/billing/stores/cartStore.test.ts
git commit -m "feat: add settlementDiscountAmount to cart store and checkout payload"
```

---

## Task 4: PaymentStep — Settlement Discount Field

**Files:**
- Modify: `src/features/billing/components/PaymentStep.tsx`

**Interfaces:**
- Consumes: `useCartStore().settlementDiscountAmount`, `useCartStore().setSettlementDiscount()`
- Produces: Settlement discount input visible on both mobile and desktop; totals update reactively

- [ ] **Step 1: Pull settlementDiscountAmount from cartStore**

In `PaymentStep.tsx`, in the `useCartStore()` destructure (~line 21), add after `setNotes,`:
```typescript
    settlementDiscountAmount,
    setSettlementDiscount,
```

- [ ] **Step 2: Update the `totals` useMemo to derive effectiveTotal**

After the existing `totals` memo (~line 53), add:
```typescript
  const effectiveTotal = Math.max(0, totals.total - settlementDiscountAmount);
  const balanceDue = Math.max(0, effectiveTotal - amountPaid);
  const projectedDue = Math.max(0, farmerTotalDue + effectiveTotal - amountPaid);
```

Remove the existing `const balanceDue` and `const projectedDue` lines (they're currently computed from `totals.total` directly, ~line 53–55).

- [ ] **Step 3: Update handlePaymentTypeChange — credit branch sets amountPaid to 0; non-credit sets it to effectiveTotal**

Replace `setAmountPaid(totals.total)` (~line 70) with:
```typescript
      setAmountPaid(Math.max(0, totals.total - settlementDiscountAmount));
```

- [ ] **Step 4: Update handleAmountPaidChange clamp to use effectiveTotal**

Replace `setAmountPaid(Math.min(Math.max(0, ...), totals.total))` (~line 75) with:
```typescript
    setAmountPaid(Math.min(Math.max(0, Number.isNaN(value) ? 0 : value), effectiveTotal));
```

- [ ] **Step 5: Add settlement discount field to the form (left column, both mobile and desktop)**

In the `<div className="space-y-4 max-w-lg">` block (~line 230), after the "Amount Received" input block (before the UPI/cheque conditionals), add:
```tsx
            {paymentType !== 'credit' && (
              <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Settlement Discount <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400">₹</div>
                  <input
                    type="number"
                    min="0"
                    max={totals.total}
                    value={settlementDiscountAmount || ''}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      const clamped = Math.min(Math.max(0, Number.isNaN(v) ? 0 : v), totals.total);
                      setSettlementDiscount(clamped);
                      setAmountPaid(Math.max(0, totals.total - clamped));
                    }}
                    className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-lg font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white transition-all shadow-sm"
                    placeholder="0.00"
                  />
                </div>
                {settlementDiscountAmount > 0 && (
                  <p className="mt-1.5 text-xs font-bold text-emerald-600">
                    Effective total: {formatCurrency(effectiveTotal)}
                  </p>
                )}
              </div>
            )}
```

- [ ] **Step 6: Update BillSummary (mobile accordion) — show settlement discount row**

In the `BillSummary` component (~line 86), in the `<div className="px-4 py-3 space-y-2">` block, after the `discountAmount > 0` row (~line 122), add:
```tsx
        {settlementDiscountAmount > 0 && (
          <div className="flex justify-between text-xs font-bold text-emerald-600">
            <span>Settlement Discount</span>
            <span className="tabular-nums">-{formatCurrency(settlementDiscountAmount)}</span>
          </div>
        )}
```

And update the "Total" row label to show "Effective Total" when settlement discount > 0:
```tsx
        <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-slate-100">
          <span>{settlementDiscountAmount > 0 ? 'Effective Total' : 'Total'}</span>
          <span className="tabular-nums">{formatCurrency(effectiveTotal)}</span>
        </div>
```

- [ ] **Step 7: Update desktop Order Summary right panel — show settlement discount**

In the right panel order summary (~line 291 after the existing discount row), add:
```tsx
            {settlementDiscountAmount > 0 && (
              <div className="flex justify-between text-sm font-bold text-emerald-600 bg-emerald-50 p-2 -mx-2 rounded-lg">
                <span>Settlement Discount</span>
                <span className="tabular-nums">-{formatCurrency(settlementDiscountAmount)}</span>
              </div>
            )}
```

And update the "Final Amount" row (~line 303) to show `effectiveTotal` instead of `totals.total`:
```tsx
            <div className="pt-4 mt-4 border-t-2 border-dashed border-slate-200 flex justify-between items-center">
              <span className="font-black text-slate-800">Final Amount</span>
              <span className="text-2xl font-black text-slate-900 tabular-nums">{formatCurrency(effectiveTotal)}</span>
            </div>
```

- [ ] **Step 8: Update mobile total header to show effectiveTotal**

At ~line 187, replace `{formatCurrency(totals.total)}` with `{formatCurrency(effectiveTotal)}`.

At ~line 195 (desktop total header), same replacement.

- [ ] **Step 9: Verify in browser**

Start dev server, open New Bill, add items, go to Payment step.
- Enter ₹200 in Settlement Discount → Amount to Pay auto-updates to total−200
- Mobile accordion shows "Settlement Discount -₹200" and "Effective Total"
- Desktop right panel shows the same

- [ ] **Step 10: Commit**

```bash
git add src/features/billing/components/PaymentStep.tsx
git commit -m "feat: settlement discount field in PaymentStep (mobile + desktop)"
```

---

## Task 5: BillDetailsPage — Display + Apply Action

**Files:**
- Modify: `src/features/billing/pages/BillDetailsPage.tsx`

**Interfaces:**
- Consumes: `Bill.settlement_discount_amount`, `Bill.settlement_discount_reason`, `billingService.applySettlementDiscount()`
- Produces: Settlement discount row in free-plan totals; "Apply Settlement Discount" button in PageHeader; modal to apply/update it

- [ ] **Step 1: Add state for the settlement discount modal**

After the `isVerifyModalOpen` state (~line 57), add:
```typescript
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false);
  const [settlementAmount, setSettlementAmount] = useState('');
  const [settlementReason, setSettlementReason] = useState('');
  const [isApplyingSettlement, setIsApplyingSettlement] = useState(false);
```

- [ ] **Step 2: Add handleApplySettlement function**

After `handleVerifySubmit` (~line 140), add:
```typescript
  const handleApplySettlement = async () => {
    if (!bill || !dealer?.id) return;
    const amount = parseFloat(settlementAmount);
    if (isNaN(amount) || amount < 0) {
      toast.error('Please enter a valid discount amount');
      return;
    }
    if (amount > bill.total) {
      toast.error('Settlement discount cannot exceed bill total');
      return;
    }
    setIsApplyingSettlement(true);
    try {
      await billingService.applySettlementDiscount({
        dealer_id: dealer.id,
        bill_id: bill.id,
        amount,
        reason: settlementReason || null,
      });
      toast.success('Settlement discount applied');
      queryClient.invalidateQueries({ queryKey: billingKeys.detail(bill.id) });
      queryClient.invalidateQueries({ queryKey: billingKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ['farmers'] });
      queryClient.invalidateQueries({ queryKey: ['farmer'] });
      queryClient.invalidateQueries({ queryKey: ['financials'] });
      setIsSettlementModalOpen(false);
      setSettlementAmount('');
      setSettlementReason('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to apply settlement discount');
    } finally {
      setIsApplyingSettlement(false);
    }
  };
```

- [ ] **Step 3: Add "Settlement Discount" button to PageHeader actions**

In the `<div className="flex flex-wrap justify-start xl:justify-end gap-2.5">` block (~line 184), add after the "Edit Bill" button (the last button in the block):

First add the import at the top of the file (after existing imports):
```typescript
import { Tag } from 'lucide-react';
```

Then add the button (only show when bill is active and balance_due > 0 OR a settlement discount already exists — i.e., dealer may want to update it):
```tsx
            {bill.status !== 'cancelled' && bill.type !== 'adjustment' && (
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Tag className="w-4 h-4 text-white" />}
                onClick={() => {
                  setSettlementAmount(String(bill.settlement_discount_amount || ''));
                  setSettlementReason(bill.settlement_discount_reason || '');
                  setIsSettlementModalOpen(true);
                }}
                className="rounded-[24px] hover:bg-white/25 transition-all text-white border-solid font-semibold text-xs px-5 sm:px-6"
                style={{ background: 'rgba(255, 255, 255, 0.18)', border: '1px solid rgba(255, 255, 255, 0.22)' }}
              >
                Settlement Discount
              </Button>
            )}
```

- [ ] **Step 4: Add settlement discount rows to free-plan totals block**

In the free-plan totals section (~line 369), after the `discount_amount > 0` block (~line 394) and before the "Grand Total" row (~line 397), add:
```tsx
            {bill.settlement_discount_amount > 0 && (
              <div className="flex justify-between text-sm text-emerald-600">
                <span>Settlement Discount</span>
                <span>-{formatCurrency(bill.settlement_discount_amount)}</span>
              </div>
            )}
            {bill.settlement_discount_amount > 0 && (
              <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-200">
                <span className="text-gray-700">Effective Total</span>
                <span className="text-blue-700">{formatCurrency(bill.total - bill.settlement_discount_amount)}</span>
              </div>
            )}
```

And update the existing "total" row label to read "Bill Total" for clarity when a settlement discount exists:
```tsx
            <div className="flex justify-between text-lg font-bold pt-3 border-t border-gray-200">
              <span>{bill.settlement_discount_amount > 0 ? 'Bill Total (before discount)' : t('billing.total')}</span>
              <span className="text-blue-700">{formatCurrency(bill.total)}</span>
            </div>
```

- [ ] **Step 5: Add the Settlement Discount modal**

After the existing Verify Delivery PIN Modal (~line 500), add:
```tsx
      {/* Settlement Discount Modal */}
      <Modal
        isOpen={isSettlementModalOpen}
        onClose={() => {
          setIsSettlementModalOpen(false);
          setSettlementAmount('');
          setSettlementReason('');
        }}
        title="Apply Settlement Discount"
      >
        <div className="p-6 space-y-5">
          <p className="text-sm text-slate-600">
            Enter the discount amount the farmer is paying less than the bill total.
            The bill total stays unchanged — this discount reduces the effective amount owed.
          </p>
          <div className="rounded-xl bg-slate-50 p-3 text-sm space-y-1">
            <div className="flex justify-between font-bold text-slate-700">
              <span>Bill Total</span>
              <span>{formatCurrency(bill.total)}</span>
            </div>
            {parseFloat(settlementAmount) > 0 && (
              <div className="flex justify-between font-bold text-emerald-600">
                <span>Settlement Discount</span>
                <span>-{formatCurrency(parseFloat(settlementAmount) || 0)}</span>
              </div>
            )}
            <div className="flex justify-between font-black text-slate-900 pt-1 border-t border-slate-200">
              <span>Effective Total</span>
              <span>{formatCurrency(Math.max(0, bill.total - (parseFloat(settlementAmount) || 0)))}</span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-slate-700">Discount Amount</label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400">₹</div>
              <input
                type="number"
                min="0"
                max={bill.total}
                value={settlementAmount}
                onChange={(e) => setSettlementAmount(e.target.value)}
                placeholder="0.00"
                className="pl-9 w-full rounded-xl border-slate-300 py-3 text-lg font-black shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-slate-700">Reason <span className="font-normal text-slate-400">(optional)</span></label>
            <input
              type="text"
              value={settlementReason}
              onChange={(e) => setSettlementReason(e.target.value)}
              placeholder="e.g. Negotiated settlement, rounding"
              className="w-full rounded-xl border-slate-300 py-2.5 px-4 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setIsSettlementModalOpen(false);
                setSettlementAmount('');
                setSettlementReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={handleApplySettlement}
              loading={isApplyingSettlement}
              disabled={!settlementAmount || parseFloat(settlementAmount) < 0}
            >
              Apply Discount
            </Button>
          </div>
        </div>
      </Modal>
```

- [ ] **Step 6: Verify in browser**

Open an existing bill with a balance due → click "Settlement Discount" → enter ₹200 → Apply.
- Balance Due updates to 0
- Settlement Discount row appears in totals
- Audit history shows `settlement_discount_applied`

- [ ] **Step 7: Commit**

```bash
git add src/features/billing/pages/BillDetailsPage.tsx
git commit -m "feat: settlement discount display and apply action in BillDetailsPage"
```

---

## Task 6: Bill Templates — Add Settlement Discount Line

**Files:**
- Modify: `src/features/billing/components/templates/TemplateOne.tsx`
- Modify: `src/features/billing/components/templates/TemplateTwo.tsx`
- Modify: `src/features/billing/components/templates/TemplateThree.tsx`
- Modify: `src/features/billing/components/templates/TemplateFour.tsx`
- Modify: `src/features/billing/components/templates/TemplateFive.tsx`

**Interfaces:**
- Consumes: `bill.settlement_discount_amount` (now on the Bill type from Task 2)

The pattern is the same for all 5 templates. Each has a totals block — find the `discount_amount` row and add the settlement discount row right after it, and update the "Grand Total" label when a settlement is present.

- [ ] **Step 1: Update TemplateOne totals block**

In `TemplateOne.tsx`, in the totals section (~line 121), after the existing Discount row (~line 128), add:
```tsx
            {bill?.settlement_discount_amount > 0 && (
              <div className="flex justify-between mb-3 text-emerald-600">
                <p>Settlement Discount</p>
                <p className="font-medium">-{formatCurrency(bill.settlement_discount_amount)}</p>
              </div>
            )}
```

Update the Grand Total row (~line 135) to show effective total:
```tsx
            <div className="flex justify-between text-lg font-bold pt-3 border-t border-slate-200 mt-3">
              <p>Grand Total</p>
              <p className="text-slate-800">
                {formatCurrency((bill?.total || 0) - (bill?.settlement_discount_amount || 0))}
              </p>
            </div>
```

- [ ] **Step 2: Apply the same change to TemplateTwo**

Open `TemplateTwo.tsx`, find the totals block (look for `discount_amount` and `Grand Total` or equivalent labels), and apply the identical pattern: add settlement discount row after discount row, update total to subtract `settlement_discount_amount`.

- [ ] **Step 3: Apply the same change to TemplateThree**

Same as Step 2 for `TemplateThree.tsx`.

- [ ] **Step 4: Apply the same change to TemplateFour**

Same as Step 2 for `TemplateFour.tsx`.

- [ ] **Step 5: Apply the same change to TemplateFive**

Same as Step 2 for `TemplateFive.tsx`.

- [ ] **Step 6: Verify in browser**

Open a bill that has a settlement discount applied (from Task 5) and view the Pro Plus template — confirm "Settlement Discount -₹200" appears and "Grand Total" shows ₹20,000.

- [ ] **Step 7: Commit**

```bash
git add src/features/billing/components/templates/TemplateOne.tsx \
        src/features/billing/components/templates/TemplateTwo.tsx \
        src/features/billing/components/templates/TemplateThree.tsx \
        src/features/billing/components/templates/TemplateFour.tsx \
        src/features/billing/components/templates/TemplateFive.tsx
git commit -m "feat: settlement discount line in all 5 bill templates"
```

---

## Task 7: Farmer Ledger — Show Effective Bill Amount

**Files:**
- Modify: `src/features/farmers/services/farmerService.ts`

**Interfaces:**
- Consumes: `bill.settlement_discount_amount` in the legacy `getFarmerTransactions` function
- Produces: bill rows in the ledger use `total - settlement_discount_amount` as the debit amount (matching what `get_farmer_ledger_page` RPC now returns)

- [ ] **Step 1: Update the `getFarmerTransactions` query to fetch settlement_discount_amount**

In `farmerService.ts`, in the `getFarmerTransactions` function (~line 286), update the `.select(...)` call on `bills`:

Change:
```typescript
    .select('id, bill_number, bill_date, total, created_at, type, is_edited')
```
To:
```typescript
    .select('id, bill_number, bill_date, total, settlement_discount_amount, created_at, type, is_edited')
```

- [ ] **Step 2: Use effective amount in the combined transaction array**

In the same function (~line 308), change the bill mapping:

Change:
```typescript
      amount: Number(bill.total),
```
To:
```typescript
      amount: Number(bill.total) - Number(bill.settlement_discount_amount || 0),
```

- [ ] **Step 3: Verify with browser**

Open a farmer's ledger who has a bill with a settlement discount. Confirm:
- The bill row shows ₹20,000 (not ₹20,200)
- The running balance is correct

- [ ] **Step 4: Commit**

```bash
git add src/features/farmers/services/farmerService.ts
git commit -m "feat: farmer ledger shows effective bill amount after settlement discount"
```

---

## Self-Review Checklist

### Spec coverage
- [x] Schema: `settlement_discount_amount` + `settlement_discount_reason` columns — Task 1
- [x] `create_bill_v2` updated to accept at creation — Task 1 + Task 3
- [x] `apply_settlement_discount_v1` RPC — Task 1
- [x] `farmers.total_due` kept in sync — both RPCs handle this
- [x] Audit log entry — `apply_settlement_discount_v1` inserts into `bill_audit_logs`
- [x] TypeScript types updated — Task 2
- [x] Cart store + checkout payload — Task 3
- [x] PaymentStep mobile + desktop — Task 4
- [x] BillDetailsPage display + action — Task 5
- [x] All 5 templates — Task 6
- [x] Farmer ledger effective amount — Task 7

### Edge cases handled
- [x] Discount > total: rejected by RPC with EXCEPTION
- [x] Discount > (total − amount_paid): rejected by RPC
- [x] Cancelled bill: rejected by RPC
- [x] Walk-in (farmer_id IS NULL): `total_due` update is guarded by `IF v_bill.farmer_id IS NOT NULL`
- [x] Settlement = 0 (reset): allowed — delta = 0 − old, balance_due recalculated
- [x] `get_farmer_ledger_page` uses `COALESCE(settlement_discount_amount, 0)` to handle legacy NULL rows
