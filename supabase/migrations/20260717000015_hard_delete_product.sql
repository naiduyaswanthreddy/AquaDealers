-- =============================================================================
-- Hard-delete product RPC (2026-07-17)
--
-- Symptom: clicking Delete on a product from the inventory detail page always
-- soft-deleted (product returned with is_active=false). Root cause: the
-- product-fanout trigger auto-creates an inventory row in every branch, so
-- every product has FK dependents even before it's ever sold. The client
-- fallback to soft delete then fired unconditionally.
--
-- Fix: server-side RPC that decides:
--   * Any bill_items / stock_purchases / bill_item_lot_allocations reference
--     the product?  → soft delete (protect audit trail).
--   * Any inventory row still has quantity_in_stock > 0?  → refuse; user
--     should adjust stock to zero first.
--   * Else → cascade-delete inventory_movements / inventory_lots / inventory
--     rows for this product, then hard-delete the product row itself.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.delete_product(p_product_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dealer_id UUID := COALESCE(auth.uid(), public.staff_dealer_id());
  v_owns BOOLEAN;
  v_has_bill_items BOOLEAN;
  v_has_purchases BOOLEAN;
  v_has_lots_with_qty BOOLEAN;
  v_has_stock BOOLEAN;
  v_deleted_count INT := 0;
BEGIN
  IF v_dealer_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT TRUE INTO v_owns FROM products WHERE id = p_product_id AND dealer_id = v_dealer_id LIMIT 1;
  IF NOT v_owns THEN RAISE EXCEPTION 'Product not found'; END IF;

  SELECT EXISTS(SELECT 1 FROM bill_items WHERE product_id = p_product_id) INTO v_has_bill_items;
  SELECT EXISTS(SELECT 1 FROM stock_purchases WHERE product_id = p_product_id) INTO v_has_purchases;
  SELECT EXISTS(SELECT 1 FROM inventory_lots WHERE product_id = p_product_id AND remaining_quantity > 0) INTO v_has_lots_with_qty;
  SELECT EXISTS(SELECT 1 FROM inventory WHERE product_id = p_product_id AND dealer_id = v_dealer_id AND COALESCE(quantity_in_stock,0) > 0) INTO v_has_stock;

  -- History exists — refuse hard delete, fall back to soft delete.
  IF v_has_bill_items OR v_has_purchases THEN
    UPDATE products SET is_active = false WHERE id = p_product_id AND dealer_id = v_dealer_id;
    RETURN jsonb_build_object('softDeleted', true, 'reason', 'has_history');
  END IF;

  -- Stock remaining — user must clear it first.
  IF v_has_stock OR v_has_lots_with_qty THEN
    RAISE EXCEPTION 'Cannot delete product: current stock is not zero. Adjust stock to 0 in every branch first.';
  END IF;

  -- Clean hard-delete path. Order matters (FK dependencies).
  DELETE FROM inventory_movements WHERE product_id = p_product_id AND dealer_id = v_dealer_id;
  DELETE FROM inventory_lots      WHERE product_id = p_product_id AND dealer_id = v_dealer_id;
  DELETE FROM inventory           WHERE product_id = p_product_id AND dealer_id = v_dealer_id;
  DELETE FROM farmer_product_discounts WHERE product_id = p_product_id AND dealer_id = v_dealer_id;

  DELETE FROM products WHERE id = p_product_id AND dealer_id = v_dealer_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  IF v_deleted_count = 0 THEN
    RAISE EXCEPTION 'Delete failed';
  END IF;

  RETURN jsonb_build_object('softDeleted', false);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_product(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_product(UUID) TO authenticated;
NOTIFY pgrst, 'reload schema';
