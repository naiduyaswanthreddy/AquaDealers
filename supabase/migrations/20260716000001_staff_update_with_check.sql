-- =============================================================================
-- Staff UPDATE policies: add WITH CHECK to prevent cross-tenant writes
--
-- The original farmers_staff_update policy (20260710000004:397-399) only had a
-- USING clause. Without WITH CHECK, a logged-in staff member could UPDATE a
-- farmer row they can see (their own dealer's) and SET dealer_id = <other
-- dealer's uuid> — donating the row into another tenant.
--
-- Fix: WITH CHECK re-asserts the same dealer scope on the post-update row, so
-- staff can only mutate rows that stay inside their dealer.
-- =============================================================================

DROP POLICY IF EXISTS farmers_staff_update ON farmers;
CREATE POLICY farmers_staff_update ON farmers
  FOR UPDATE
  USING (dealer_id = public.staff_dealer_id())
  WITH CHECK (dealer_id = public.staff_dealer_id());
