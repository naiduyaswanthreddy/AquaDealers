-- =============================================================================
-- Security fixes batch 1 (2026-07-28)
--
-- 1. get_public_bill_items: drop the `id = p_token` fallback — a farmer's
--    internal UUID is not a secret and must not double as the public share
--    token (the sibling get_farmer_public_statement was already fixed for
--    this in 20260716000000_share_link_hardening.sql; this regressed back
--    in 20260717000000_fix_public_bill_items_token.sql and was never
--    re-hardened).
-- 2. create_bill_v2 / preview_fifo_bill_lines: reject non-positive quantity
--    and negative unit_price instead of silently trusting them. A negative
--    quantity previously bypassed the FIFO loop entirely (no bill_items, no
--    lot allocation, no inventory_movements row) while still incrementing
--    inventory.quantity_in_stock — free, unaudited stock.
-- 3. product-images storage bucket: writes/deletes were gated on
--    auth.role() = 'authenticated' only, with no per-dealer ownership
--    check, unlike the farmer-profiles bucket. Any authenticated dealer
--    could overwrite/delete another dealer's product or supplier photo.
-- 4. Dealer PIN lock: pin_hash was an unsalted client-side SHA-256 hash,
--    compared in the browser and persisted in plaintext in localStorage.
--    Move to a bcrypt hash (mirroring staff_members) verified server-side
--    via a new RPC, with a short lockout after repeated failures.
-- =============================================================================

-- ──────────────────────────────────────────────────────────────
-- 1. get_public_bill_items — share_token only, no id fallback
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_public_bill_items(p_token UUID, p_bill_number TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_farmer_id UUID;
  v_bill_id UUID;
  v_items JSONB;
BEGIN
  SELECT id INTO v_farmer_id
    FROM farmers
   WHERE share_token = p_token
     AND is_active = true;

  IF NOT FOUND THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT id INTO v_bill_id
    FROM bills
   WHERE farmer_id = v_farmer_id
     AND bill_number = p_bill_number;

  IF NOT FOUND THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(
           jsonb_build_object(
             'id', id,
             'product_name_snapshot', product_name_snapshot,
             'quantity', quantity,
             'unit_price', unit_price,
             'mrp', mrp,
             'medicine_discount_percentage',
               CASE WHEN COALESCE(mrp, 0) > 0 AND unit_price < mrp
                    THEN round((1 - unit_price / mrp) * 100, 2)
                    ELSE 0 END,
             'gst_rate', gst_rate,
             'gst_amount', gst_amount,
             'total_price', total_price
           )
         ), '[]'::jsonb)
    INTO v_items
    FROM bill_items
   WHERE bill_id = v_bill_id;

  RETURN v_items;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_bill_items(UUID, TEXT) TO anon, authenticated;

-- ──────────────────────────────────────────────────────────────
-- 2a. create_bill_v2 — reject quantity <= 0 and unit_price < 0
-- ──────────────────────────────────────────────────────────────
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
  v_remaining NUMERIC;
  v_take NUMERIC;
  v_unit_price NUMERIC;
  v_line_subtotal NUMERIC;
  v_line_gst NUMERIC;
  v_payload_discount NUMERIC;
  v_settlement_discount NUMERIC(12,2);
BEGIN
  v_dealer_id := (p_payload->>'dealer_id')::UUID;
  v_branch_id := NULLIF(p_payload->>'branch_id', '')::UUID;
  v_is_historical := COALESCE((p_payload->>'is_historical')::BOOLEAN, false);
  v_reduce_stock := COALESCE((p_payload->>'reduce_stock')::BOOLEAN, true);
  v_payload_discount := COALESCE((p_payload->>'discount_amount')::NUMERIC, 0);
  v_settlement_discount := COALESCE((p_payload->>'settlement_discount_amount')::NUMERIC, 0);
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
  v_balance_due := GREATEST(v_total - v_settlement_discount - v_amount_paid, 0);
  v_farmer_due_add := v_balance_due;

  INSERT INTO bills (
    bill_number, dealer_id, branch_id, farmer_id, farmer_name_snapshot, farmer_gstin, bill_date,
    subtotal, gst_amount, cgst_amount, sgst_amount, igst_amount, discount_amount, total,
    settlement_discount_amount, settlement_discount_reason,
    amount_paid, balance_due, payment_type, upi_ref, cheque_number, notes, status,
    credit_override_used, credit_override_reason, is_historical, type, is_verified, verification_method, delivery_pin
  ) VALUES (
    v_bill_number, v_dealer_id, v_branch_id, NULLIF(p_payload->>'farmer_id', '')::UUID,
    NULLIF(p_payload->>'farmer_name_snapshot', ''), NULLIF(p_payload->>'farmer_gstin', ''),
    COALESCE(NULLIF(p_payload->>'bill_date', '')::DATE, CURRENT_DATE),
    v_subtotal, v_gst_amount, ROUND(v_gst_amount / 2, 2), ROUND(v_gst_amount / 2, 2),
    COALESCE((p_payload->>'igst_amount')::NUMERIC, 0), v_payload_discount, v_total,
    v_settlement_discount, NULLIF(p_payload->>'settlement_discount_reason', ''),
    v_amount_paid, v_balance_due, NULLIF(p_payload->>'payment_type', ''), NULLIF(p_payload->>'upi_ref', ''),
    NULLIF(p_payload->>'cheque_number', ''), NULLIF(p_payload->>'notes', ''), 'active',
    COALESCE((p_payload->>'credit_override_used')::BOOLEAN, false), NULLIF(p_payload->>'credit_override_reason', ''),
    v_is_historical, 'sale', COALESCE((p_payload->>'is_verified')::BOOLEAN, true), NULLIF(p_payload->>'verification_method', ''), NULLIF(p_payload->>'delivery_pin', '')
  )
  RETURNING id INTO v_bill_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'items', '[]'::jsonb))
  LOOP
    SELECT *
    INTO v_inventory
    FROM inventory
    WHERE id = (v_item->>'inventory_id')::UUID
      AND dealer_id = v_dealer_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Inventory item % not found', v_item->>'inventory_id';
    END IF;

    IF COALESCE((v_item->>'quantity')::NUMERIC, 0) <= 0 THEN
      RAISE EXCEPTION 'Quantity must be greater than zero for %', v_item->>'product_name';
    END IF;

    IF NULLIF(v_item->>'unit_price', '') IS NOT NULL AND (v_item->>'unit_price')::NUMERIC < 0 THEN
      RAISE EXCEPTION 'Unit price cannot be negative for %', v_item->>'product_name';
    END IF;

    IF v_reduce_stock AND COALESCE(v_inventory.quantity_in_stock, 0) < COALESCE((v_item->>'quantity')::NUMERIC, 0) THEN
      RAISE EXCEPTION 'Insufficient stock for product %', v_item->>'product_name';
    END IF;

    IF NOT v_reduce_stock THEN
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
      CONTINUE;
    END IF;

    v_remaining := COALESCE((v_item->>'quantity')::NUMERIC, 0);
    FOR v_lot IN
      SELECT *
      FROM inventory_lots
      WHERE dealer_id = v_dealer_id
        AND inventory_id = v_inventory.id
        AND remaining_quantity > 0
      ORDER BY expiry_date NULLS LAST, received_at, created_at
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_take := LEAST(v_lot.remaining_quantity, v_remaining);

      -- Always trust the client's unit_price (see 20260717000016 for rationale)
      -- but it's now guaranteed non-negative by the check above.
      v_unit_price := COALESCE(
        NULLIF(v_item->>'unit_price', '')::NUMERIC,
        v_lot.final_unit_price,
        v_lot.selling_price,
        v_inventory.selling_price,
        0
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
      )
      RETURNING id INTO v_bill_item_id;

      UPDATE inventory_lots
      SET remaining_quantity = remaining_quantity - v_take
      WHERE id = v_lot.id;

      INSERT INTO bill_item_lot_allocations (
        dealer_id, bill_id, bill_item_id, inventory_id, lot_id, product_id, quantity, unit_price
      ) VALUES (
        v_dealer_id, v_bill_id, v_bill_item_id, v_inventory.id, v_lot.id, v_inventory.product_id, v_take, v_unit_price
      );

      INSERT INTO inventory_movements (
        dealer_id, branch_id, inventory_id, product_id, lot_id, reference_type, reference_id, quantity_change, notes, created_at
      ) VALUES (
        v_dealer_id, v_branch_id, v_inventory.id, v_inventory.product_id, v_lot.id, 'bill', v_bill_id, -v_take,
        'Consumed through FIFO-priced bill', COALESCE(NULLIF(p_payload->>'bill_date', '')::TIMESTAMPTZ, now())
      );

      v_remaining := v_remaining - v_take;
    END LOOP;

    UPDATE inventory
    SET quantity_in_stock = quantity_in_stock - COALESCE((v_item->>'quantity')::NUMERIC, 0),
        updated_at = now()
    WHERE id = v_inventory.id;
  END LOOP;

  IF NULLIF(p_payload->>'farmer_id', '') IS NOT NULL AND v_farmer_due_add > 0 THEN
    UPDATE farmers
    SET total_due = COALESCE(total_due, 0) + v_farmer_due_add
    WHERE id = (p_payload->>'farmer_id')::UUID
      AND dealer_id = v_dealer_id;
  END IF;

  IF v_amount_paid > 0 THEN
    INSERT INTO payments (
      dealer_id, branch_id, farmer_id, bill_id, amount, payment_date, method, upi_ref, cheque_no,
      notes, allocation_mode, receipt_number
    ) VALUES (
      v_dealer_id, v_branch_id, NULLIF(p_payload->>'farmer_id', '')::UUID, v_bill_id, v_amount_paid,
      COALESCE(NULLIF(p_payload->>'bill_date', '')::DATE, CURRENT_DATE), NULLIF(p_payload->>'payment_type', ''),
      NULLIF(p_payload->>'upi_ref', ''), NULLIF(p_payload->>'cheque_number', ''), NULLIF(p_payload->>'notes', ''),
      'specific_bill', public.generate_receipt_number('RCPT')
    )
    RETURNING id INTO v_payment_id;

    INSERT INTO payment_allocations (dealer_id, payment_id, bill_id, farmer_id, allocated_amount, allocation_order)
    VALUES (v_dealer_id, v_payment_id, v_bill_id, NULLIF(p_payload->>'farmer_id', '')::UUID, v_amount_paid, 1);

    INSERT INTO cash_book (dealer_id, branch_id, entry_type, source, reference_id, amount, notes, entry_date)
    VALUES (
      v_dealer_id, v_branch_id, 'income',
      CASE WHEN NULLIF(p_payload->>'farmer_id', '') IS NULL THEN 'cash_sale' ELSE 'farmer_payment' END,
      v_payment_id, v_amount_paid, 'Payment received for bill ' || v_bill_number,
      COALESCE(NULLIF(p_payload->>'bill_date', '')::DATE, CURRENT_DATE)
    );
  END IF;

  RETURN jsonb_build_object(
    'bill_id', v_bill_id,
    'bill_number', v_bill_number,
    'payment_id', v_payment_id,
    'balance_due', v_balance_due,
    'subtotal', v_subtotal,
    'gst_amount', v_gst_amount,
    'total', v_total
  );
END;
$create_bill_fifo$;

GRANT EXECUTE ON FUNCTION public.create_bill_v2(JSONB) TO authenticated;

-- ──────────────────────────────────────────────────────────────
-- 2b. preview_fifo_bill_lines — same guard, so the review screen
--     rejects bad input before create_bill_v2 ever runs.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.preview_fifo_bill_lines(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $preview_fifo$
DECLARE
  v_item JSONB;
  v_lot RECORD;
  v_inventory RECORD;
  v_remaining NUMERIC;
  v_take NUMERIC;
  v_unit_price NUMERIC;
  v_base_unit_price NUMERIC;
  v_discount NUMERIC;
  v_line_subtotal NUMERIC;
  v_line_gst NUMERIC;
  v_subtotal NUMERIC := 0;
  v_gst_amount NUMERIC := 0;
  v_lines JSONB := '[]'::JSONB;
  v_dealer_id UUID;
BEGIN
  v_dealer_id := (p_payload->>'dealer_id')::UUID;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'items', '[]'::JSONB))
  LOOP
    SELECT * INTO v_inventory FROM inventory
     WHERE id = (v_item->>'inventory_id')::UUID
       AND dealer_id = v_dealer_id;
    IF NOT FOUND THEN CONTINUE; END IF;

    IF COALESCE((v_item->>'quantity')::NUMERIC, 0) <= 0 THEN
      RAISE EXCEPTION 'Quantity must be greater than zero for %', v_item->>'product_name';
    END IF;

    IF NULLIF(v_item->>'unit_price', '') IS NOT NULL AND (v_item->>'unit_price')::NUMERIC < 0 THEN
      RAISE EXCEPTION 'Unit price cannot be negative for %', v_item->>'product_name';
    END IF;

    v_remaining := COALESCE((v_item->>'quantity')::NUMERIC, 0);
    FOR v_lot IN
      SELECT * FROM inventory_lots
       WHERE dealer_id = v_dealer_id
         AND inventory_id = v_inventory.id
         AND remaining_quantity > 0
       ORDER BY expiry_date NULLS LAST, received_at, created_at
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_take := LEAST(v_lot.remaining_quantity, v_remaining);

      -- Same rule as create_bill_v2: client's unit_price wins.
      v_unit_price := COALESCE(
        NULLIF(v_item->>'unit_price', '')::NUMERIC,
        v_lot.final_unit_price, v_lot.selling_price, v_inventory.selling_price, 0
      );
      v_base_unit_price := COALESCE(
        NULLIF(v_item->>'base_unit_price', '')::NUMERIC,
        v_unit_price
      );
      v_discount := GREATEST(0, LEAST(COALESCE((v_item->>'discount_percentage')::NUMERIC, 0), 100));
      v_line_subtotal := ROUND(v_take * v_unit_price, 2);
      v_line_gst := ROUND(v_line_subtotal * COALESCE((v_item->>'gst_rate')::NUMERIC, 0) / 100, 2);
      v_subtotal := v_subtotal + v_line_subtotal;
      v_gst_amount := v_gst_amount + v_line_gst;

      v_lines := v_lines || jsonb_build_object(
        'inventory_id', v_inventory.id,
        'product_id', v_inventory.product_id,
        'product_name', v_item->>'product_name',
        'hsn_code', NULLIF(v_item->>'hsn_code', ''),
        'quantity', v_take,
        'unit_price', v_unit_price,
        'base_unit_price', v_base_unit_price,
        'discount_percentage', v_discount,
        'discount_source', NULLIF(v_item->>'discount_source', ''),
        'discount_label', NULLIF(v_item->>'discount_label', ''),
        'gst_rate', COALESCE((v_item->>'gst_rate')::NUMERIC, 0),
        'gst_amount', v_line_gst,
        'total_price', v_line_subtotal + v_line_gst,
        'mrp', COALESCE(v_lot.mrp, v_inventory.mrp),
        'lot_id', v_lot.id,
        'batch_number', v_lot.batch_number,
        'expiry_date', v_lot.expiry_date
      );
      v_remaining := v_remaining - v_take;
    END LOOP;

    -- Fallback for the leftover units when no more lots have stock.
    IF v_remaining > 0 THEN
      v_unit_price := COALESCE(NULLIF(v_item->>'unit_price', '')::NUMERIC, v_inventory.selling_price, 0);
      v_line_subtotal := ROUND(v_remaining * v_unit_price, 2);
      v_line_gst := ROUND(v_line_subtotal * COALESCE((v_item->>'gst_rate')::NUMERIC, 0) / 100, 2);
      v_subtotal := v_subtotal + v_line_subtotal;
      v_gst_amount := v_gst_amount + v_line_gst;

      v_lines := v_lines || jsonb_build_object(
        'inventory_id', v_inventory.id,
        'product_id', v_inventory.product_id,
        'product_name', v_item->>'product_name',
        'hsn_code', NULLIF(v_item->>'hsn_code', ''),
        'quantity', v_remaining,
        'unit_price', v_unit_price,
        'base_unit_price', v_unit_price,
        'discount_percentage', 0,
        'discount_source', NULLIF(v_item->>'discount_source', ''),
        'discount_label', NULLIF(v_item->>'discount_label', ''),
        'gst_rate', COALESCE((v_item->>'gst_rate')::NUMERIC, 0),
        'gst_amount', v_line_gst,
        'total_price', v_line_subtotal + v_line_gst,
        'mrp', v_inventory.mrp,
        'lot_id', NULL, 'batch_number', NULL, 'expiry_date', NULL
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object('lines', v_lines, 'subtotal', v_subtotal, 'gst_amount', v_gst_amount);
END;
$preview_fifo$;

GRANT EXECUTE ON FUNCTION public.preview_fifo_bill_lines(JSONB) TO authenticated;

-- ──────────────────────────────────────────────────────────────
-- 3. product-images bucket — scope writes/deletes to the dealer
--    that owns the inventory/supplier row the path points at.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.owns_product_image_path(p_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_folder TEXT := split_part(p_name, '/', 1);
  v_id UUID;
BEGIN
  BEGIN
    v_id := regexp_replace(split_part(p_name, '/', 2), '\.[^.]+$', '')::UUID;
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;

  IF v_folder = 'products' THEN
    RETURN EXISTS (SELECT 1 FROM public.inventory WHERE id = v_id AND dealer_id = auth.uid());
  ELSIF v_folder = 'suppliers' THEN
    RETURN EXISTS (SELECT 1 FROM public.suppliers WHERE id = v_id AND dealer_id = auth.uid());
  END IF;

  RETURN false;
END;
$$;

DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete images" ON storage.objects;

CREATE POLICY "Dealer-owned product image upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'product-images'
  AND auth.role() = 'authenticated'
  AND public.owns_product_image_path(name)
);

CREATE POLICY "Dealer-owned product image update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'product-images'
  AND auth.role() = 'authenticated'
  AND public.owns_product_image_path(name)
);

CREATE POLICY "Dealer-owned product image delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'product-images'
  AND auth.role() = 'authenticated'
  AND public.owns_product_image_path(name)
);

-- ──────────────────────────────────────────────────────────────
-- 4. Dealer PIN — bcrypt hash + server-side verification RPC,
--    same pattern as staff_members (20260710000011_staff_pin_bcrypt.sql).
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.dealers
  ADD COLUMN IF NOT EXISTS pin_fail_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pin_locked_until TIMESTAMPTZ;

-- Existing pin_hash values are unsalted client-side SHA-256, not bcrypt
-- comparable. Clear them so affected dealers re-set their PIN (it will be
-- bcrypted by the trigger below on the next write).
UPDATE public.dealers SET pin_hash = NULL WHERE pin_hash IS NOT NULL;

CREATE OR REPLACE FUNCTION public.bcrypt_dealer_pin()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.pin_hash IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.pin_hash ~ '^\$2[aby]\$' THEN
    RETURN NEW; -- already bcrypt (idempotent re-save)
  END IF;

  NEW.pin_hash := extensions.crypt(NEW.pin_hash, extensions.gen_salt('bf'));
  NEW.pin_fail_count := 0;
  NEW.pin_locked_until := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bcrypt_dealer_pin ON public.dealers;
CREATE TRIGGER trg_bcrypt_dealer_pin
BEFORE INSERT OR UPDATE OF pin_hash ON public.dealers
FOR EACH ROW EXECUTE FUNCTION public.bcrypt_dealer_pin();

CREATE OR REPLACE FUNCTION public.verify_dealer_pin(p_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dealer RECORD;
  v_ok BOOLEAN;
BEGIN
  SELECT id, pin_hash, pin_fail_count, pin_locked_until
    INTO v_dealer
    FROM public.dealers
   WHERE id = auth.uid()
   FOR UPDATE;

  IF NOT FOUND OR v_dealer.pin_hash IS NULL THEN
    RETURN false;
  END IF;

  IF v_dealer.pin_locked_until IS NOT NULL AND v_dealer.pin_locked_until > now() THEN
    RAISE EXCEPTION 'Too many incorrect attempts. Try again in a few minutes.';
  END IF;

  v_ok := v_dealer.pin_hash = extensions.crypt(p_pin, v_dealer.pin_hash);

  IF v_ok THEN
    UPDATE public.dealers SET pin_fail_count = 0, pin_locked_until = NULL WHERE id = v_dealer.id;
  ELSE
    UPDATE public.dealers
       SET pin_fail_count = pin_fail_count + 1,
           pin_locked_until = CASE WHEN pin_fail_count + 1 >= 5 THEN now() + interval '5 minutes' ELSE pin_locked_until END
     WHERE id = v_dealer.id;
  END IF;

  RETURN v_ok;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_dealer_pin(TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
