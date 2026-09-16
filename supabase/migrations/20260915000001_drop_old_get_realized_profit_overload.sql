-- 20260808000003 reordered get_realized_profit's params (p_branch_id moved
-- before p_start/p_end, default dropped). CREATE OR REPLACE only replaces a
-- function with the exact same parameter list, so that migration created a
-- second overload instead of replacing the original from
-- 20260730000002_realized_profit_branch_scope.sql. Both overloads have the
-- same param NAMES (just reordered), so PostgREST can't disambiguate a
-- named-argument call (see useBusinessSnapshot.ts) and errors with
-- "Could not choose the best candidate function" — breaking the Business
-- Snapshot on the Reports page. Same class of bug as
-- 20260830000009_drop_old_set_whatsapp_status_overload.sql.
DROP FUNCTION IF EXISTS public.get_realized_profit(UUID, DATE, DATE, UUID);

NOTIFY pgrst, 'reload schema';
