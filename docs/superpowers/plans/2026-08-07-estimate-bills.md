# Estimate Bills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Estimate" toggle to bill creation so dealers can issue price-quotes to farmers that save as bills but don't reduce stock, add dues, or create payments.

**Architecture:** `is_estimate` boolean propagates from a cart store flag → payload → Supabase RPC → `bills.is_estimate` column. The RPC skips the three side-effects (stock deduction, farmer dues increment, payment record) when the flag is set. All downstream views (ledger, templates, bill details) read the column and render an "ESTIMATE" label/badge instead of treating it as a real sale.

**Tech Stack:** React + Zustand (cart store), Supabase (RPC + migration), Tailwind CSS (toggle UI), existing invoice templates (5 files).

## Global Constraints

- All SQL migrations go in `supabase/migrations/` with timestamp prefix `20260807100000_*`
- TypeScript: no `any` for new fields — use proper types
- Toggle is a plain CSS/Tailwind pill — no new libraries
- All 5 templates must show the ESTIMATE label identically
- No test framework changes — tests are inline `describe`/`it` via vitest (existing setup)
- Offline bills (`offlineBillStore`) must also carry `is_estimate` through

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/20260807100000_estimate_bills.sql` | **Create** | Add column, update 2 RPCs |
| `src/types/database.ts` | **Modify** `:300` | Add `is_estimate?` to `Bill` interface |
| `src/features/billing/types.ts` | **Modify** `:26` | Add `is_estimate?` to `BillingPayload` |
| `src/features/billing/stores/cartStore.ts` | **Modify** `:8` | Add `isEstimate` field + `setIsEstimate` action |
| `src/features/billing/hooks/useCheckout.ts` | **Modify** `:82` | Include `is_estimate` in `buildPayload` |
| `src/features/billing/components/ReviewStep.tsx` | **Modify** `:80` | Estimate toggle card + button label |
| `src/features/billing/components/templates/TemplateOne.tsx` | **Modify** `:24` | Show ESTIMATE header badge |
| `src/features/billing/components/templates/TemplateTwo.tsx` | **Modify** | Same |
| `src/features/billing/components/templates/TemplateThree.tsx` | **Modify** | Same |
| `src/features/billing/components/templates/TemplateFour.tsx` | **Modify** | Same |
| `src/features/billing/components/templates/TemplateFive.tsx` | **Modify** | Same |
| `src/features/billing/pages/BillDetailsPage.tsx` | **Modify** | ESTIMATE amber banner at top |
| `src/features/farmers/services/farmerService.ts` | **Modify** `:223` | Add `is_estimate` to ledger return types + selects |
| `src/features/farmers/components/FarmerLedgerList.tsx` | **Modify** `:8` | Handle estimate type (indigo color, "Estimate" label) |
| `src/features/farmers/pages/FarmerLedgerPage.tsx` | **Modify** `:134` | Pass `isEstimate` when mapping ledger rows |

---

## Task 1: Database migration

**Files:**
- Create: `supabase/migrations/20260807100000_estimate_bills.sql`

**What this does:**
1. Adds `is_estimate BOOLEAN NOT NULL DEFAULT false` to `bills`
2. Replaces `create_bill_v2`: when `is_estimate=true`, skips stock deduction + farmer dues + payment record, sets `balance_due = 0`
3. Replaces `get_farmer_ledger_page`: adds `b.is_estimate` to the bills SELECT so the client can show "Estimate" in the ledger

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260807100000_estimate_bills.sql

-- 1. Schema
ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS is_estimate BOOLEAN NOT NULL DEFAULT false;

-- 2. Updated create_bill_v2 — skips stock/dues/payment when is_estimate=true
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
  v_is_estimate BOOLEAN;
  v_remaining NUMERIC;
  v_take NUMERIC;
  v_unit_price NUMERIC;
  v_line_subtotal NUMERIC;
  v_line_gst NUMERIC;
  v_payload_discount NUMERIC;
BEGIN
  v_dealer_id := (p_payload->>'dealer_id')::UUID;
  v_branch_id := NULLIF(p_payload->>'branch_id', '')::UUID;
  v_is_historical := COALESCE((p_payload->>'is_historical')::BOOLEAN, false);
  v_is_estimate := COALESCE((p_payload->>'is_estimate')::BOOLEAN, false);
  -- Estimates never touch stock regardless of reduce_stock flag
  v_reduce_stock := CASE WHEN v_is_estimate THEN false ELSE COALESCE((p_payload->>'reduce_stock')::BOOLEAN, true) END;
  v_payload_discount := COALESCE((p_payload->>'discount_amount')::NUMERIC, 0);
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
  -- Estimates have no real balance_due — they're price quotes, not debts
  v_balance_due := CASE WHEN v_is_estimate THEN 0 ELSE GREATEST(v_total - v_amount_paid, 0) END;
  v_farmer_due_add := v_balance_due;

  INSERT INTO bills (
    bill_number, dealer_id, branch_id, farmer_id, farmer_name_snapshot, farmer_gstin, bill_date,
    subtotal, gst_amount, cgst_amount, sgst_amount, igst_amount, discount_amount, total,
    amount_paid, balance_due, payment_type, upi_ref, cheque_number, notes, status,
    credit_override_used, credit_override_reason, is_historical, type, is_verified,
    verification_method, delivery_pin, is_estimate
  ) VALUES (
    v_bill_number, v_dealer_id, v_branch_id, NULLIF(p_payload->>'farmer_id', '')::UUID,
    NULLIF(p_payload->>'farmer_name_snapshot', ''), NULLIF(p_payload->>'farmer_gstin', ''),
    COALESCE(NULLIF(p_payload->>'bill_date', '')::DATE, CURRENT_DATE),
    v_subtotal, v_gst_amount, ROUND(v_gst_amount / 2, 2), ROUND(v_gst_amount / 2, 2),
    COALESCE((p_payload->>'igst_amount')::NUMERIC, 0), v_payload_discount, v_total,
    CASE WHEN v_is_estimate THEN 0 ELSE v_amount_paid END,
    v_balance_due,
    NULLIF(p_payload->>'payment_type', ''), NULLIF(p_payload->>'upi_ref', ''),
    NULLIF(p_payload->>'cheque_number', ''), NULLIF(p_payload->>'notes', ''), 'active',
    COALESCE((p_payload->>'credit_override_used')::BOOLEAN, false), NULLIF(p_payload->>'credit_override_reason', ''),
    v_is_historical, 'sale', COALESCE((p_payload->>'is_verified')::BOOLEAN, true),
    NULLIF(p_payload->>'verification_method', ''), NULLIF(p_payload->>'delivery_pin', ''),
    v_is_estimate
  )
  RETURNING id INTO v_bill_id;

  -- Stock deduction: skipped for estimates (v_reduce_stock is false when is_estimate)
  IF v_reduce_stock THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'items', '[]'::jsonb))
    LOOP
      SELECT * INTO v_inventory FROM inventory
        WHERE id = (v_item->>'inventory_id')::UUID AND dealer_id = v_dealer_id FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Inventory item % not found', v_item->>'inventory_id';
      END IF;
      IF COALESCE(v_inventory.quantity_in_stock, 0) < COALESCE((v_item->>'quantity')::NUMERIC, 0) THEN
        RAISE EXCEPTION 'Insufficient stock for product %', v_item->>'product_name';
      END IF;
      v_remaining := COALESCE((v_item->>'quantity')::NUMERIC, 0);
      FOR v_lot IN
        SELECT * FROM inventory_lots
          WHERE dealer_id = v_dealer_id AND inventory_id = v_inventory.id AND remaining_quantity > 0
          ORDER BY expiry_date NULLS LAST, received_at, created_at FOR UPDATE
      LOOP
        EXIT WHEN v_remaining <= 0;
        v_take := LEAST(v_lot.remaining_quantity, v_remaining);
        v_unit_price := COALESCE(
          NULLIF(v_item->>'unit_price', '')::NUMERIC,
          v_lot.final_unit_price, v_lot.selling_price, v_inventory.selling_price, 0
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
        ) RETURNING id INTO v_bill_item_id;
        UPDATE inventory_lots SET remaining_quantity = remaining_quantity - v_take WHERE id = v_lot.id;
        INSERT INTO bill_item_lot_allocations (dealer_id, bill_id, bill_item_id, inventory_id, lot_id, product_id, quantity, unit_price)
          VALUES (v_dealer_id, v_bill_id, v_bill_item_id, v_inventory.id, v_lot.id, v_inventory.product_id, v_take, v_unit_price);
        INSERT INTO inventory_movements (dealer_id, branch_id, inventory_id, product_id, lot_id, reference_type, reference_id, quantity_change, notes, created_at)
          VALUES (v_dealer_id, v_branch_id, v_inventory.id, v_inventory.product_id, v_lot.id, 'bill', v_bill_id, -v_take,
            'Consumed through FIFO-priced bill', COALESCE(NULLIF(p_payload->>'bill_date', '')::TIMESTAMPTZ, now()));
        v_remaining := v_remaining - v_take;
      END LOOP;
      UPDATE inventory SET quantity_in_stock = quantity_in_stock - COALESCE((v_item->>'quantity')::NUMERIC, 0), updated_at = now()
        WHERE id = v_inventory.id;
    END LOOP;
  ELSE
    -- Non-stock-reducing path: still write bill_items for the estimate's line-item record
    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'items', '[]'::jsonb))
    LOOP
      SELECT * INTO v_inventory FROM inventory
        WHERE id = (v_item->>'inventory_id')::UUID AND dealer_id = v_dealer_id FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Inventory item % not found', v_item->>'inventory_id'; END IF;
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
    END LOOP;
  END IF;

  -- Farmer dues: skipped for estimates
  IF NOT v_is_estimate AND NULLIF(p_payload->>'farmer_id', '') IS NOT NULL AND v_farmer_due_add > 0 THEN
    UPDATE farmers
      SET total_due = COALESCE(total_due, 0) + v_farmer_due_add
      WHERE id = (p_payload->>'farmer_id')::UUID AND dealer_id = v_dealer_id;
  END IF;

  -- Payment record: skipped for estimates
  IF NOT v_is_estimate AND v_amount_paid > 0 THEN
    INSERT INTO payments (
      dealer_id, branch_id, farmer_id, bill_id, amount, payment_date, method, upi_ref, cheque_no,
      notes, allocation_mode, receipt_number
    ) VALUES (
      v_dealer_id, v_branch_id, NULLIF(p_payload->>'farmer_id', '')::UUID, v_bill_id, v_amount_paid,
      COALESCE(NULLIF(p_payload->>'bill_date', '')::DATE, CURRENT_DATE), NULLIF(p_payload->>'payment_type', ''),
      NULLIF(p_payload->>'upi_ref', ''), NULLIF(p_payload->>'cheque_number', ''), NULLIF(p_payload->>'notes', ''),
      'specific_bill', public.generate_receipt_number('RCPT')
    ) RETURNING id INTO v_payment_id;
    INSERT INTO payment_allocations (dealer_id, payment_id, bill_id, farmer_id, allocated_amount, allocation_order)
      VALUES (v_dealer_id, v_payment_id, v_bill_id, NULLIF(p_payload->>'farmer_id', '')::UUID, v_amount_paid, 1);
    INSERT INTO cash_book (dealer_id, branch_id, entry_type, source, reference_id, amount, notes, entry_date)
      VALUES (v_dealer_id, v_branch_id, 'income',
        CASE WHEN NULLIF(p_payload->>'farmer_id', '') IS NULL THEN 'cash_sale' ELSE 'farmer_payment' END,
        v_payment_id, v_amount_paid, 'Payment received for bill ' || v_bill_number,
        COALESCE(NULLIF(p_payload->>'bill_date', '')::DATE, CURRENT_DATE));
  END IF;

  RETURN jsonb_build_object(
    'bill_id', v_bill_id, 'bill_number', v_bill_number, 'payment_id', v_payment_id,
    'balance_due', v_balance_due, 'subtotal', v_subtotal, 'gst_amount', v_gst_amount, 'total', v_total
  );
END;
$create_bill_fifo$;

GRANT EXECUTE ON FUNCTION public.create_bill_v2(JSONB) TO authenticated;

-- 3. Update get_farmer_ledger_page to return is_estimate for ledger display
CREATE OR REPLACE FUNCTION public.get_farmer_ledger_page(
  p_farmer_id UUID, p_dealer_id UUID, p_page INT DEFAULT 1, p_limit INT DEFAULT 20,
  p_start_date DATE DEFAULT NULL, p_end_date DATE DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_offset INT := (p_page - 1) * p_limit; v_total BIGINT; v_rows JSONB;
BEGIN
  PERFORM public.assert_dealer_access(p_dealer_id);
  SELECT COUNT(*) INTO v_total FROM (
    SELECT id FROM public.bills WHERE farmer_id = p_farmer_id AND dealer_id = p_dealer_id AND status <> 'cancelled' AND (p_start_date IS NULL OR bill_date >= p_start_date) AND (p_end_date IS NULL OR bill_date <= p_end_date)
    UNION ALL SELECT id FROM public.payments WHERE farmer_id = p_farmer_id AND dealer_id = p_dealer_id AND (p_start_date IS NULL OR payment_date >= p_start_date) AND (p_end_date IS NULL OR payment_date <= p_end_date)
    UNION ALL SELECT id FROM public.bill_returns WHERE farmer_id = p_farmer_id AND dealer_id = p_dealer_id AND (p_start_date IS NULL OR return_date >= p_start_date) AND (p_end_date IS NULL OR return_date <= p_end_date)
  ) records;
  SELECT COALESCE(jsonb_agg(row_to_json(record)), '[]'::JSONB) INTO v_rows FROM (
    SELECT b.id, 'bill'::TEXT AS type, b.bill_number AS ref_number, b.bill_date AS date,
           b.total AS amount, b.balance_due, b.created_at,
           COALESCE(b.branch_name_snapshot, br.name) AS branch_name,
           COALESCE(b.is_estimate, false) AS is_estimate
      FROM public.bills b LEFT JOIN public.branches br ON br.id = b.branch_id
     WHERE b.farmer_id = p_farmer_id AND b.dealer_id = p_dealer_id AND b.status <> 'cancelled'
       AND (p_start_date IS NULL OR b.bill_date >= p_start_date) AND (p_end_date IS NULL OR b.bill_date <= p_end_date)
    UNION ALL
    SELECT p.id, 'payment'::TEXT, COALESCE(p.receipt_number, UPPER(p.method), 'PAYMENT'),
           p.payment_date, p.amount, NULL, p.created_at,
           COALESCE(p.branch_name_snapshot, br.name), false AS is_estimate
      FROM public.payments p LEFT JOIN public.branches br ON br.id = p.branch_id
     WHERE p.farmer_id = p_farmer_id AND p.dealer_id = p_dealer_id
       AND (p_start_date IS NULL OR p.payment_date >= p_start_date) AND (p_end_date IS NULL OR p.payment_date <= p_end_date)
    UNION ALL
    SELECT r.id, 'return'::TEXT, COALESCE(r.return_number, 'RETURN'),
           r.return_date, r.total_amount, NULL, r.created_at,
           COALESCE(r.branch_name_snapshot, br.name), false AS is_estimate
      FROM public.bill_returns r LEFT JOIN public.branches br ON br.id = r.branch_id
     WHERE r.farmer_id = p_farmer_id AND r.dealer_id = p_dealer_id
       AND (p_start_date IS NULL OR r.return_date >= p_start_date) AND (p_end_date IS NULL OR r.return_date <= p_end_date)
    ORDER BY created_at DESC LIMIT p_limit OFFSET v_offset
  ) record;
  RETURN jsonb_build_object('total', v_total, 'page', p_page, 'limit', p_limit, 'data', v_rows);
END; $$;

GRANT EXECUTE ON FUNCTION public.get_farmer_ledger_page(UUID, UUID, INT, INT, DATE, DATE) TO authenticated;
NOTIFY pgrst, 'reload schema';
```

- [ ] **Step 2: Apply migration**

```bash
npx supabase db push
```

Expected: migration applies cleanly, `bills` table gains `is_estimate` column.

- [ ] **Step 3: Verify column exists**

```bash
npx supabase db diff
```

Expected: no pending changes (migration applied).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260807100000_estimate_bills.sql
git commit -m "feat(db): add is_estimate column + update create_bill_v2 and ledger RPC"
```

---

## Task 2: Types + CartStore + Checkout payload

**Files:**
- Modify: `src/types/database.ts:300`
- Modify: `src/features/billing/types.ts:26`
- Modify: `src/features/billing/stores/cartStore.ts:8`
- Modify: `src/features/billing/hooks/useCheckout.ts:82`

**Interfaces:**
- Produces: `isEstimate: boolean` in `DraftFields`; `is_estimate?: boolean` in `BillingPayload`; `buildPayload` includes `is_estimate` and `reduce_stock: false` when estimate is on

- [ ] **Step 1: Add `is_estimate` to `Bill` interface**

In `src/types/database.ts`, after line 302 (`delivery_pin?: string | null;`), add:

```typescript
  is_estimate?: boolean;
```

- [ ] **Step 2: Add `is_estimate` to `BillingPayload`**

In `src/features/billing/types.ts`, after the `delivery_pin` field (line ~57):

```typescript
  /** When true: no stock deducted, no dues added, no payment recorded — price quote only. */
  is_estimate?: boolean;
```

- [ ] **Step 3: Add `isEstimate` to cartStore**

In `src/features/billing/stores/cartStore.ts`:

**In `DraftFields` type** (after `billDate: string;`):
```typescript
  isEstimate: boolean;
```

**In `CartState` interface** (after `setBillDate:`):
```typescript
  setIsEstimate: (v: boolean) => void;
```

**In `emptyDraftFields()`** (after `billDate: getLocalDateString(),`):
```typescript
  isEstimate: false,
```

**In the store's `create()` body**, add the action alongside the other setters:
```typescript
setIsEstimate: (v) => set((s) => ({
  ...s,
  drafts: s.drafts.map((d) =>
    d.id === s.activeDraftId ? { ...d, isEstimate: v, isDirty: true } : d
  ),
  isEstimate: v,
})),
```

- [ ] **Step 4: Include `is_estimate` in `buildPayload`**

In `src/features/billing/hooks/useCheckout.ts`:

**In the destructure of `useCartStore()`** (line ~51), add:
```typescript
    isEstimate,
```

**In `buildPayload`** (after `notes: notes || null,`), add:
```typescript
      is_estimate: isEstimate || undefined,
      reduce_stock: isEstimate ? false : undefined,
```

Also add `isEstimate` to `buildPayload`'s `useCallback` dep array.

- [ ] **Step 5: Run type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/types/database.ts src/features/billing/types.ts src/features/billing/stores/cartStore.ts src/features/billing/hooks/useCheckout.ts
git commit -m "feat(billing): thread is_estimate through types, cartStore, and checkout payload"
```

---

## Task 3: ReviewStep — Estimate toggle UI

**Files:**
- Modify: `src/features/billing/components/ReviewStep.tsx`

**Interfaces:**
- Consumes: `isEstimate: boolean`, `setIsEstimate: (v: boolean) => void` from `useCartStore()`

The toggle card goes between the column-settings section and the invoice card. When estimate mode is on, the invoice section gets an amber top-border and the submit button label changes.

- [ ] **Step 1: Read `isEstimate` and `setIsEstimate` from cart store**

In `ReviewStep.tsx`, in the `useCartStore()` destructure (around line 97), add:
```typescript
    isEstimate,
    setIsEstimate,
```

- [ ] **Step 2: Add the Estimate toggle card**

Find the line `<section className="billing-invoice-card">` and insert the following block **before** it (i.e., after the column-settings `</section>`):

```tsx
{/* Estimate toggle */}
<div
  className={`mx-0 rounded-2xl border p-4 transition-colors ${
    isEstimate
      ? 'border-amber-300 bg-amber-50'
      : 'border-slate-200 bg-white'
  }`}
>
  <div className="flex items-center justify-between gap-3">
    <div className="min-w-0">
      <div className={`text-sm font-black ${isEstimate ? 'text-amber-800' : 'text-slate-900'}`}>
        Save as Estimate
      </div>
      <div className={`mt-0.5 text-xs font-medium ${isEstimate ? 'text-amber-700' : 'text-slate-500'}`}>
        {isEstimate
          ? 'Price quote only — no stock deducted, no dues added'
          : 'Toggle on to send a price quote instead of a real bill'}
      </div>
    </div>
    {/* Pill toggle */}
    <button
      type="button"
      role="switch"
      aria-checked={isEstimate}
      onClick={() => setIsEstimate(!isEstimate)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 ${
        isEstimate ? 'bg-amber-500' : 'bg-slate-200'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          isEstimate ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  </div>
</div>
```

- [ ] **Step 3: Change invoice header when estimate is on**

In ReviewStep, find:
```tsx
<h2 className="text-xl font-black text-slate-950">{gstEnabled ? 'Tax Invoice' : 'Bill of Supply'}</h2>
```
Replace with:
```tsx
<h2 className="text-xl font-black text-slate-950">
  {isEstimate ? 'Estimate' : gstEnabled ? 'Tax Invoice' : 'Bill of Supply'}
</h2>
{isEstimate && (
  <div className="mt-1 inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
    Price Quote · Not a Bill
  </div>
)}
```

- [ ] **Step 4: Change the submit button label when estimate is on**

Find the submit button text logic (around line 542):
```tsx
: 'Sign & Save'
```
Change to:
```tsx
: isEstimate ? 'Save Estimate' : 'Sign & Save'
```

- [ ] **Step 5: Start dev server and verify toggle visually**

```bash
npm run dev
```

Navigate to billing → add items → review step. Confirm:
- Toggle appears between column settings and invoice card
- Toggling on turns card amber, changes header to "Estimate", changes button to "Save Estimate"
- Toggling off restores normal state

- [ ] **Step 6: Commit**

```bash
git add src/features/billing/components/ReviewStep.tsx
git commit -m "feat(billing): add estimate toggle to review step"
```

---

## Task 4: Invoice templates — ESTIMATE badge

**Files:**
- Modify: `src/features/billing/components/templates/TemplateOne.tsx`
- Modify: `src/features/billing/components/templates/TemplateTwo.tsx`
- Modify: `src/features/billing/components/templates/TemplateThree.tsx`
- Modify: `src/features/billing/components/templates/TemplateFour.tsx`
- Modify: `src/features/billing/components/templates/TemplateFive.tsx`

Each template has an invoice/statement header — we replace "Invoice" with "Estimate" and add an amber badge.

- [ ] **Step 1: Update TemplateOne**

In `TemplateOne.tsx`, find the header `<h1>` that says `'Invoice'` (line ~24):

```tsx
<h1 className="text-4xl font-bold text-slate-900 mb-2 uppercase tracking-tight">
  {isStatement ? 'Statement' : 'Invoice'}
</h1>
```

Replace with:
```tsx
<div className="flex items-center gap-3 mb-2">
  <h1 className="text-4xl font-bold text-slate-900 uppercase tracking-tight">
    {isStatement ? 'Statement' : bill?.is_estimate ? 'Estimate' : 'Invoice'}
  </h1>
  {bill?.is_estimate && (
    <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-800 ring-1 ring-amber-200">
      Price Quote
    </span>
  )}
</div>
```

- [ ] **Step 2: Update TemplateTwo through TemplateFive**

Each template has a similar header. Apply the same pattern: find where "Invoice" or the bill type label is rendered, and add the `bill?.is_estimate` check.

For each template, locate the title `<h1>` or equivalent heading (search for the string `'Invoice'` or `Tax Invoice`) and apply:
```tsx
{bill?.is_estimate ? 'Estimate' : <original expression>}
```

Also add the amber "Price Quote" badge directly after the heading element when `bill?.is_estimate` is true.

- [ ] **Step 3: Verify templates in ReviewStep preview**

With dev server running:
- Toggle "Save as Estimate" on in the review step
- Confirm the invoice preview shows "Estimate" heading with amber "Price Quote" badge

- [ ] **Step 4: Commit**

```bash
git add src/features/billing/components/templates/
git commit -m "feat(billing): show ESTIMATE label in all invoice templates when is_estimate"
```

---

## Task 5: BillDetailsPage + Farmer Ledger display

**Files:**
- Modify: `src/features/billing/pages/BillDetailsPage.tsx`
- Modify: `src/features/farmers/services/farmerService.ts:223`
- Modify: `src/features/farmers/components/FarmerLedgerList.tsx:8`
- Modify: `src/features/farmers/pages/FarmerLedgerPage.tsx:134`

**Interfaces:**
- Consumes: `bill.is_estimate` (from `getBillDetails` which selects `bills.*`)
- Produces: `isEstimate?: boolean` in `Transaction` and `FarmerTransactionItem`

- [ ] **Step 1: Add ESTIMATE banner to BillDetailsPage**

In `src/features/billing/pages/BillDetailsPage.tsx`, find where the bill content is first rendered (look for where `bill` is used after loading). Add the banner just before or inside the main content wrapper:

```tsx
{bill?.is_estimate && (
  <div className="mx-4 mt-4 flex items-center gap-3 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3">
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100">
      <span className="text-lg">📋</span>
    </div>
    <div>
      <div className="text-sm font-black text-amber-800">This is an Estimate</div>
      <div className="text-xs font-medium text-amber-700">
        No stock was deducted · No dues were added to this farmer
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 2: Add `is_estimate` to `getFarmerLedgerPage` return type**

In `src/features/farmers/services/farmerService.ts`, update the return type at line ~232:

```typescript
  data: Array<{
    id: string;
    type: 'bill' | 'payment' | 'return';
    ref_number: string;
    date: string;
    amount: number;
    balance_due: number | null;
    created_at: string;
    is_estimate?: boolean;  // add this
  }>;
```

- [ ] **Step 3: Add `is_estimate` to `getFarmerTransactions` bills query**

In `src/features/farmers/services/farmerService.ts`, find the bills query (line ~287):

```typescript
  .select('id, bill_number, bill_date, total, settlement_discount_amount, created_at, type, is_edited')
```

Change to:
```typescript
  .select('id, bill_number, bill_date, total, settlement_discount_amount, created_at, type, is_edited, is_estimate')
```

Then in the returned transaction shape mapping (where bill objects are transformed), pass through `isEstimate: bill.is_estimate ?? false`.

- [ ] **Step 4: Add `isEstimate` to `FarmerTransactionItem` in FarmerLedgerPage**

In `src/features/farmers/pages/FarmerLedgerPage.tsx`, update the interface (line ~28):

```typescript
interface FarmerTransactionItem {
  id: string;
  type: 'bill' | 'payment' | 'return';
  refNumber: string;
  date: string;
  amount: number;
  runningBalance: number;
  branchName?: string | null;
  isEstimate?: boolean;  // add this
}
```

In the `pagedLedger` memo (line ~138), add `isEstimate` to the mapped object:

```typescript
      return {
        id: tx.id,
        type: tx.type,
        refNumber: tx.ref_number,
        date: tx.date,
        amount: Number(tx.amount),
        runningBalance: running,
        branchName: (tx as any).branch_name || null,
        isEstimate: (tx as any).is_estimate ?? false,  // add this
      };
```

- [ ] **Step 5: Handle `isEstimate` in `FarmerLedgerList`**

In `src/features/farmers/components/FarmerLedgerList.tsx`:

**Update `Transaction` interface** to add:
```typescript
  isEstimate?: boolean;
```

**In the row render** (around line 93), add:
```typescript
const isEstimate = tx.isEstimate ?? false;
```

**Update the label** (line ~116):
```tsx
{isPayment ? 'Payment Received' : isReturn ? 'Farmer Return' : isAdjustment ? 'Rate Adjustment' : isEstimate ? 'Estimate' : 'Bill'}
```

**Update the amount color** (line ~131) — estimates get indigo instead of orange:
```tsx
className={`text-[1rem] font-bold tabular-nums ${
  isPayment || isReturn ? 'text-emerald-600'
  : isAdjustment ? 'text-amber-600'
  : isEstimate ? 'text-indigo-500'
  : 'text-orange-500'
}`}
```

**Update the debit/credit label** when balance is missing:
```tsx
{isPayment || isReturn ? 'Credit' : isEstimate ? 'Quote' : 'Debit'}
```

- [ ] **Step 6: Verify end-to-end**

With dev server running:
1. Create a bill with "Save as Estimate" toggled on
2. Confirm it saves successfully
3. Go to farmer ledger — confirm the estimate shows as "Estimate" in indigo
4. Click into the estimate — confirm the amber "This is an Estimate" banner appears
5. Confirm the invoice template shows "Estimate" heading
6. Click WhatsApp share — confirm it shares the estimate invoice image normally

- [ ] **Step 7: Commit**

```bash
git add src/features/billing/pages/BillDetailsPage.tsx src/features/farmers/services/farmerService.ts src/features/farmers/components/FarmerLedgerList.tsx src/features/farmers/pages/FarmerLedgerPage.tsx
git commit -m "feat(billing): show estimate badge in bill details and ledger list"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Toggle in bill creation UI → Task 3
- [x] No dues added → Task 1 (RPC skips `UPDATE farmers`)
- [x] No stock reduced → Task 1 (RPC skips inventory block)
- [x] Estimate shown in farmer ledger differently → Task 5
- [x] Estimate shareable (WhatsApp/PDF) → Task 4 + Task 5 (templates show ESTIMATE, share works same way)
- [x] Estimate shows in farmer details page → Task 5

**Notes / known ceiling:**
- Offline bills (`offlineBillStore`) queue the payload as-is — `is_estimate` will be included in the queued JSONB and replayed when online, so offline estimates work without additional changes.
- The running balance in `pagedLedger` skips adding estimate amounts (balance_due = 0) automatically since estimates have `balance_due = 0` — no special handling needed.
- Estimates are not excluded from the `bills` count queries or dues ageing — they appear as ₹0 balance_due bills, which is correct (not overdue).
