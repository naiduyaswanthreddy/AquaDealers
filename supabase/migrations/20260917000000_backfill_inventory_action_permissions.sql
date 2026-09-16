-- Backfill the 5 new inventory action permission keys (see StaffFeatureKey in
-- src/types/database.ts) onto every existing staff_members row, with values
-- chosen so no existing staff member's effective access changes.
--
-- Deploy order: this migration MUST be applied BEFORE the frontend that reads
-- these keys is deployed. If the frontend ships first, any dealer who saves a
-- staff member via the staff editor in the gap will have normalizePermissions()
-- stamp STAFF_DEFAULT_PERMISSIONS (hidden for 3 of these 5 keys) onto that row
-- ahead of this migration, defeating the intended backfill values below.
--
-- - inventoryAddStock copies each row's own current `suppliers` value, because
--   that's the key that has gated Add Stock until now (InventoryPage.tsx:90,
--   App.tsx's /purchases/new route).
-- - inventoryEditPrice, inventoryViewCostPrice, inventoryAdjustStock,
--   inventoryDeleteProduct all become 'visible', because none of the four had
--   ANY permission gate before this — any staff member who could see Inventory
--   at all could already do all four unconditionally.
--
-- Idempotent: only touches rows missing one or more of the 5 new keys, so
-- re-running this migration (or a dealer having already customized some of the
-- new keys through the UI before this ran) is safe — a row with a partial set
-- of the new keys still gets the missing ones filled in. This does NOT fix a
-- row that already has a WRONG value for one of these keys (e.g. from the
-- unsafe deploy order above) — the migration can't distinguish a prematurely
-- stamped default from a dealer's intentional choice, so that still requires
-- the deploy-runbook step of revoking/expiring staff sessions during rollout.

UPDATE public.staff_members
SET permissions = permissions
  || jsonb_build_object('inventoryAddStock', COALESCE(permissions->>'suppliers', 'hidden'))
  || jsonb_build_object('inventoryEditPrice', 'visible')
  || jsonb_build_object('inventoryViewCostPrice', 'visible')
  || jsonb_build_object('inventoryAdjustStock', 'visible')
  || jsonb_build_object('inventoryDeleteProduct', 'visible')
WHERE NOT (permissions ?& array['inventoryAddStock','inventoryEditPrice','inventoryViewCostPrice','inventoryAdjustStock','inventoryDeleteProduct']);
