-- Backfill the 5 new inventory action permission keys (added in the frontend
-- in a prior deploy — see StaffFeatureKey in src/types/database.ts) onto every
-- existing staff_members row, with values chosen so no existing staff member's
-- effective access changes:
--
-- - inventoryAddStock copies each row's own current `suppliers` value, because
--   that's the key that has gated Add Stock until now (InventoryPage.tsx:90,
--   App.tsx's /purchases/new route).
-- - inventoryEditPrice, inventoryViewCostPrice, inventoryAdjustStock,
--   inventoryDeleteProduct all become 'visible', because none of the four had
--   ANY permission gate before this — any staff member who could see Inventory
--   at all could already do all four unconditionally.
--
-- Idempotent: only touches rows that don't already have inventoryAddStock, so
-- re-running this migration (or a dealer having already customized the new
-- keys through the UI before this ran) is safe.

UPDATE public.staff_members
SET permissions = permissions
  || jsonb_build_object('inventoryAddStock', COALESCE(permissions->>'suppliers', 'hidden'))
  || jsonb_build_object('inventoryEditPrice', 'visible')
  || jsonb_build_object('inventoryViewCostPrice', 'visible')
  || jsonb_build_object('inventoryAdjustStock', 'visible')
  || jsonb_build_object('inventoryDeleteProduct', 'visible')
WHERE NOT (permissions ? 'inventoryAddStock');
