-- =============================================================================
-- Products visible in every branch (2026-07-17)
--
-- Products and suppliers are already dealer-scoped globally. The gap is that
-- `inventory` rows are per-branch and only created when a branch receives its
-- first stock of a product. So Branch A adds product X → Branch B doesn't see
-- X in its inventory list until B does its own stock purchase.
--
-- Fix: auto-create empty inventory rows for every (product × branch) pair.
--   1. Backfill missing combinations for existing dealers.
--   2. Trigger on products INSERT → fan out empty rows to every active branch.
--   3. Trigger on branches INSERT → fan out empty rows for every existing
--      product owned by that dealer.
--
-- Empty rows carry quantity_in_stock = 0 and min_stock_alert = 0 so they do
-- NOT fire false low-stock alerts. Price fields stay NULL; whichever branch
-- first receives stock sets its own selling/cost price via the normal
-- stock_purchase flow. Uses ON CONFLICT DO NOTHING so re-runs are safe.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Backfill
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.inventory (dealer_id, branch_id, product_id, quantity_in_stock, min_stock_alert)
SELECT p.dealer_id, b.id, p.id, 0, 0
  FROM public.products p
  JOIN public.branches b ON b.dealer_id = p.dealer_id AND b.is_active = true
 WHERE NOT EXISTS (
   SELECT 1 FROM public.inventory i
    WHERE i.dealer_id = p.dealer_id
      AND i.product_id = p.id
      AND i.branch_id = b.id
 );

-- Guard the "no duplicate (dealer,branch,product)" invariant so triggers
-- can safely ON CONFLICT DO NOTHING. Existing schema didn't enforce this.
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_dealer_branch_product
  ON public.inventory (dealer_id, branch_id, product_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. New product → row in every active branch of that dealer
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fanout_product_to_branches()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.inventory (dealer_id, branch_id, product_id, quantity_in_stock, min_stock_alert)
  SELECT NEW.dealer_id, b.id, NEW.id, 0, 0
    FROM public.branches b
   WHERE b.dealer_id = NEW.dealer_id
     AND b.is_active = true
  ON CONFLICT (dealer_id, branch_id, product_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fanout_product_to_branches ON public.products;
CREATE TRIGGER trg_fanout_product_to_branches
AFTER INSERT ON public.products
FOR EACH ROW EXECUTE FUNCTION public.fanout_product_to_branches();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. New branch → row for every product of that dealer
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fanout_branch_to_products()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.inventory (dealer_id, branch_id, product_id, quantity_in_stock, min_stock_alert)
  SELECT NEW.dealer_id, NEW.id, p.id, 0, 0
    FROM public.products p
   WHERE p.dealer_id = NEW.dealer_id
  ON CONFLICT (dealer_id, branch_id, product_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fanout_branch_to_products ON public.branches;
CREATE TRIGGER trg_fanout_branch_to_products
AFTER INSERT ON public.branches
FOR EACH ROW EXECUTE FUNCTION public.fanout_branch_to_products();

NOTIFY pgrst, 'reload schema';
