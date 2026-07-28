-- The inventory table never had a `created_at` column, but several RPCs
-- (record_stock_purchase_v2 among them) ORDER BY it. Adding it here backfills
-- existing rows from `updated_at` and keeps the default `now()` for new rows —
-- so the RPC starts working and any other code that expects the column also
-- just works.

ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
UPDATE public.inventory
   SET created_at = COALESCE(updated_at, now())
 WHERE created_at IS NULL;

NOTIFY pgrst, 'reload schema';
