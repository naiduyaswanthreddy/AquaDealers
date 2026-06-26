# Edit Completed Bills (Pro Plus Feature)

## Overview
Farmers often negotiate discounts or price adjustments long after a bill is created, when they finally come to settle their credit accounts. This feature allows Pro Plus dealers to edit the Unit Price, Discount %, and Quantity of items on completed bills indefinitely. All changes will be securely audited, update inventory dynamically, recalculate farmer dues, and clearly reflect on farmer statements.

## Project Type
**WEB / BACKEND**

## Success Criteria
- [ ] Dealer can edit Unit Price, Discount, and Quantity on completed bills.
- [ ] Stock is dynamically restored or consumed if the quantity changes.
- [ ] Financial totals (bill total, farmer due) automatically recalculate.
- [ ] A strict confirmation modal displays the net impact of the changes before saving.
- [ ] Full audit trail is captured (Old vs New values, User, Timestamp).
- [ ] Bills and Statements visually indicate if a bill has been edited.
- [ ] Feature is strictly gated to `pro_plus` plan.

## Tech Stack
- **Database/Backend**: Supabase RPC (PL/pgSQL) for transactional safety, preventing race conditions during inventory restoration/consumption.
- **Frontend**: React, Zustand, Tailwind CSS.

## File Structure Additions
- `supabase/migrations/XXX_edit_bill_support.sql` (New tables and RPCs)
- `src/features/billing/components/EditBillModal.tsx`
- `src/features/billing/components/EditBillConfirmationModal.tsx`
- `src/features/billing/components/BillAuditHistory.tsx`

---

## Task Breakdown

### Phase 1: Database & Backend Logic (Agent: `backend-specialist`, Skill: `database-design`)
**Task 1.1: Schema Updates & Audit Table**
- **INPUT**: Current `bills` and `bill_items` tables.
- **OUTPUT**: Add `is_edited BOOLEAN DEFAULT false` to `bills`. Create `bill_audit_logs` table (`id`, `bill_id`, `dealer_id`, `user_id`, `changes_jsonb`, `created_at`).
- **VERIFY**: Tables exist and accept inserts.

**Task 1.2: Create `edit_bill_v1` RPC**
- **INPUT**: `p_bill_id`, `p_edits JSONB` (array of item changes), `p_user_id`.
- **OUTPUT**: PL/pgSQL function that:
  1. Loops through edits.
  2. **If QTY decreases**: Restores stock to `inventory_lots` (LIFO based on `bill_item_lot_allocations`), inserts `inventory_movements` (return), updates `inventory`.
  3. **If QTY increases**: Consumes stock from `inventory_lots` (FIFO), creates new allocations, inserts `inventory_movements`, updates `inventory`.
  4. Updates `bill_items` (qty, price, discount, tax, total).
  5. Recalculates `bills` subtotal, gst, total, balance_due.
  6. Updates `farmers.total_due` by the net difference.
  7. Inserts the before/after state into `bill_audit_logs`.
  8. Sets `bills.is_edited = true`.
- **VERIFY**: RPC successfully handles financial-only edits AND quantity-change edits safely.

### Phase 2: Frontend Services (Agent: `frontend-specialist`, Skill: `api-patterns`)
**Task 2.1: Update Billing Service & Store**
- **INPUT**: `billingService.ts`
- **OUTPUT**: Add `editBill(payload)` and `getBillAuditLogs(billId)` methods.
- **VERIFY**: API calls succeed and return expected typed data.

### Phase 3: UI Implementation (Agent: `frontend-specialist`, Skill: `frontend-design`)
**Task 3.1: Edit Bill Modal**
- **INPUT**: Bill ID and current items.
- **OUTPUT**: A modal fetching bill details, rendering a form where QTY, Price, and Discount can be modified for each item. Includes validation (can't increase qty beyond current `inventory.quantity_in_stock`).
- **VERIFY**: Modal correctly calculates local differences before submitting.

**Task 3.2: Confirmation Modal**
- **INPUT**: Pending changes from Task 3.1.
- **OUTPUT**: A strict modal showing exact impacts (e.g., "Farmer due will decrease by ₹500", "Stock for Medicine X will increase by 2 bags"). Requires user to click "Confirm Edit".
- **VERIFY**: Summaries match expected math.

**Task 3.3: Integration & Pro Plus Gating**
- **INPUT**: `FarmerLedgerPage.tsx` (Items Tab) and `BillDetailsPage.tsx`.
- **OUTPUT**: Add "Edit Bill" buttons. Wrap them in `PlanGate` checking for `pro_plus` or `hasFeature('edit_completed_bills')`.
- **VERIFY**: Button is hidden/locked for basic users, visible for Pro Plus.

### Phase 4: Audit Visibility & Statements (Agent: `frontend-specialist`, Skill: `frontend-design`)
**Task 4.1: Bill Edit History UI**
- **INPUT**: `BillDetailsPage.tsx`
- **OUTPUT**: If `bill.is_edited` is true, show an "Edited" badge. Add a "View History" button that opens `BillAuditHistory` component showing a timeline of who changed what and when.
- **VERIFY**: History renders chronologically and displays the JSON diffs readably.

**Task 4.2: Farmer Statement PDF Updates**
- **INPUT**: `farmerStatementPdf.ts`
- **OUTPUT**: If a bill transaction has `is_edited: true`, append an `*(Edited)` tag to the bill reference in the statement table so farmers are aware it was adjusted.
- **VERIFY**: Generated PDF displays the tag correctly.

---

## ✅ PHASE X: VERIFICATION CHECKLIST
- [ ] Backend RPC tests pass (Qty increase, Qty decrease, Price only).
- [ ] No purple/violet hex codes used in new UI components.
- [ ] Pro Plus gate correctly blocks unauthorized access.
- [ ] UX Audit script passes.
- [ ] Security check passes (Dealer ID validation inside RPC).
