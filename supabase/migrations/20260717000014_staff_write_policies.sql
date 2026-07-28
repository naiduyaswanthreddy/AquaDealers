-- =============================================================================
-- Fill missing staff RLS write policies (2026-07-17)
--
-- The initial staff RLS pass (migration 20260710000004) only added SELECT for
-- suppliers, products, and inventory. Any staff attempt to add a supplier,
-- add/edit a product, or adjust stock hit "row-level security policy" errors.
-- Bills / payments / stock purchases have SECURITY DEFINER RPCs
-- (create_bill_v2, record_stock_purchase_v2, etc.) so they weren't affected —
-- these three tables are the ones the client writes to directly.
--
-- All policies are dealer-scoped via staff_dealer_id(). The route-level
-- FeatureGate in the app still controls WHICH staff members can even see the
-- create/edit UI; RLS here only enforces tenant isolation.
-- =============================================================================

-- ─── suppliers ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS suppliers_staff_insert ON suppliers;
CREATE POLICY suppliers_staff_insert ON suppliers
  FOR INSERT WITH CHECK (dealer_id = public.staff_dealer_id());

DROP POLICY IF EXISTS suppliers_staff_update ON suppliers;
CREATE POLICY suppliers_staff_update ON suppliers
  FOR UPDATE
  USING (dealer_id = public.staff_dealer_id())
  WITH CHECK (dealer_id = public.staff_dealer_id());

-- ─── products ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS products_staff_insert ON products;
CREATE POLICY products_staff_insert ON products
  FOR INSERT WITH CHECK (dealer_id = public.staff_dealer_id());

DROP POLICY IF EXISTS products_staff_update ON products;
CREATE POLICY products_staff_update ON products
  FOR UPDATE
  USING (dealer_id = public.staff_dealer_id())
  WITH CHECK (dealer_id = public.staff_dealer_id());

-- ─── inventory (direct rate / stock edits from the inventory detail page) ──
DROP POLICY IF EXISTS inventory_staff_insert ON inventory;
CREATE POLICY inventory_staff_insert ON inventory
  FOR INSERT WITH CHECK (
    dealer_id = public.staff_dealer_id()
    AND public.staff_can_access_branch(branch_id)
  );

DROP POLICY IF EXISTS inventory_staff_update ON inventory;
CREATE POLICY inventory_staff_update ON inventory
  FOR UPDATE
  USING (
    dealer_id = public.staff_dealer_id()
    AND public.staff_can_access_branch(branch_id)
  )
  WITH CHECK (
    dealer_id = public.staff_dealer_id()
    AND public.staff_can_access_branch(branch_id)
  );

NOTIFY pgrst, 'reload schema';
