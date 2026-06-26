-- Migration: Edit Bill Feature
-- Adds is_edited flag, bill_audit_logs table, and edit_bill_v1 RPC.

ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS public.bill_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
    dealer_id UUID NOT NULL REFERENCES public.dealers(id),
    user_id UUID,
    changes_jsonb JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.bill_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dealers can view their own bill audit logs"
    ON public.bill_audit_logs FOR SELECT
    USING (dealer_id = auth.uid());

CREATE POLICY "Dealers can insert their own bill audit logs"
    ON public.bill_audit_logs FOR INSERT
    WITH CHECK (dealer_id = auth.uid());

-- RPC for editing completed bills
CREATE OR REPLACE FUNCTION public.edit_bill_v1(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $edit_bill$
DECLARE
    v_bill_id UUID := (p_payload->>'bill_id')::UUID;
    v_dealer_id UUID := (p_payload->>'dealer_id')::UUID;
    v_user_id UUID := auth.uid();
    
    v_bill RECORD;
    v_farmer RECORD;
    
    v_edit JSONB;
    v_bitem RECORD;
    v_inv RECORD;
    
    v_old_qty NUMERIC;
    v_new_qty NUMERIC;
    v_qty_diff NUMERIC;
    v_qty_to_process NUMERIC;
    
    v_alloc RECORD;
    v_returned NUMERIC;
    v_lot RECORD;
    v_take NUMERIC;
    
    v_line_subtotal NUMERIC;
    v_line_gst NUMERIC;
    
    v_new_subtotal NUMERIC(12,2) := 0;
    v_new_gst_amount NUMERIC(12,2) := 0;
    v_new_total NUMERIC(12,2) := 0;
    v_new_balance_due NUMERIC(12,2) := 0;
    v_old_total NUMERIC(12,2) := 0;
    v_diff_total NUMERIC(12,2) := 0;
    
    v_audit_changes JSONB := '[]'::jsonb;
    v_item_change JSONB;
BEGIN
    PERFORM public.assert_dealer_access(v_dealer_id);

    -- 1. Lock the bill
    SELECT * INTO v_bill FROM bills WHERE id = v_bill_id AND dealer_id = v_dealer_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Bill % not found', v_bill_id;
    END IF;
    
    v_old_total := v_bill.total;

    -- 2. Process item edits
    FOR v_edit IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'edits', '[]'::jsonb))
    LOOP
        -- Lock bill item
        SELECT * INTO v_bitem FROM bill_items WHERE id = (v_edit->>'bill_item_id')::UUID AND bill_id = v_bill_id FOR UPDATE;
        IF NOT FOUND THEN
            CONTINUE;
        END IF;

        v_old_qty := v_bitem.quantity;
        v_new_qty := (v_edit->>'quantity')::NUMERIC;
        
        -- Build change object for audit
        v_item_change := jsonb_build_object(
            'bill_item_id', v_bitem.id,
            'product_name', v_bitem.product_name_snapshot,
            'old_quantity', v_old_qty,
            'new_quantity', v_new_qty,
            'old_unit_price', v_bitem.unit_price,
            'new_unit_price', (v_edit->>'unit_price')::NUMERIC
        );
        v_audit_changes := v_audit_changes || v_item_change;

        -- Handle Quantity Changes
        IF v_new_qty != v_old_qty AND v_bitem.inventory_id_snapshot IS NOT NULL THEN
            -- Lock inventory
            SELECT * INTO v_inv FROM inventory WHERE id = v_bitem.inventory_id_snapshot FOR UPDATE;
            
            IF v_new_qty < v_old_qty THEN
                -- Returning stock
                v_qty_to_process := v_old_qty - v_new_qty;
                
                FOR v_alloc IN 
                    SELECT * FROM bill_item_lot_allocations 
                    WHERE bill_item_id = v_bitem.id 
                    ORDER BY created_at DESC -- LIFO for returning
                    FOR UPDATE
                LOOP
                    EXIT WHEN v_qty_to_process <= 0;
                    
                    v_returned := LEAST(v_alloc.quantity, v_qty_to_process);
                    
                    -- Update lot
                    UPDATE inventory_lots SET remaining_quantity = remaining_quantity + v_returned WHERE id = v_alloc.lot_id;
                    
                    -- Insert movement
                    INSERT INTO inventory_movements (dealer_id, branch_id, inventory_id, product_id, lot_id, reference_type, reference_id, quantity_change, notes)
                    VALUES (v_dealer_id, v_bill.branch_id, v_inv.id, v_inv.product_id, v_alloc.lot_id, 'bill_edit', v_bill_id, v_returned, 'Stock returned via bill edit');
                    
                    -- Update allocation
                    IF v_alloc.quantity - v_returned <= 0 THEN
                        DELETE FROM bill_item_lot_allocations WHERE id = v_alloc.id;
                    ELSE
                        UPDATE bill_item_lot_allocations SET quantity = quantity - v_returned WHERE id = v_alloc.id;
                    END IF;
                    
                    v_qty_to_process := v_qty_to_process - v_returned;
                END LOOP;
                
                -- Update inventory master stock
                UPDATE inventory SET quantity_in_stock = quantity_in_stock + (v_old_qty - v_new_qty), updated_at = now() WHERE id = v_inv.id;
                
            ELSIF v_new_qty > v_old_qty THEN
                -- Consuming more stock
                v_qty_to_process := v_new_qty - v_old_qty;
                
                IF COALESCE(v_inv.quantity_in_stock, 0) < v_qty_to_process THEN
                    RAISE EXCEPTION 'Insufficient stock to increase quantity for %', v_bitem.product_name_snapshot;
                END IF;
                
                FOR v_lot IN
                    SELECT * FROM inventory_lots 
                    WHERE inventory_id = v_inv.id AND remaining_quantity > 0 
                    ORDER BY expiry_date NULLS LAST, received_at, created_at -- FIFO
                    FOR UPDATE
                LOOP
                    EXIT WHEN v_qty_to_process <= 0;
                    
                    v_take := LEAST(v_lot.remaining_quantity, v_qty_to_process);
                    
                    -- Update lot
                    UPDATE inventory_lots SET remaining_quantity = remaining_quantity - v_take WHERE id = v_lot.id;
                    
                    -- Insert movement
                    INSERT INTO inventory_movements (dealer_id, branch_id, inventory_id, product_id, lot_id, reference_type, reference_id, quantity_change, notes)
                    VALUES (v_dealer_id, v_bill.branch_id, v_inv.id, v_inv.product_id, v_lot.id, 'bill_edit', v_bill_id, -v_take, 'Additional stock consumed via bill edit');
                    
                    -- Insert or update allocation
                    -- Since we might just be pulling more from the same lot, let's try to update, otherwise insert
                    UPDATE bill_item_lot_allocations 
                    SET quantity = quantity + v_take 
                    WHERE bill_item_id = v_bitem.id AND lot_id = v_lot.id;
                    
                    IF NOT FOUND THEN
                        INSERT INTO bill_item_lot_allocations (dealer_id, bill_id, bill_item_id, inventory_id, lot_id, product_id, quantity, unit_price)
                        VALUES (v_dealer_id, v_bill_id, v_bitem.id, v_inv.id, v_lot.id, v_inv.product_id, v_take, (v_edit->>'unit_price')::NUMERIC);
                    END IF;
                    
                    v_qty_to_process := v_qty_to_process - v_take;
                END LOOP;
                
                -- Update inventory master stock
                UPDATE inventory SET quantity_in_stock = quantity_in_stock - (v_new_qty - v_old_qty), updated_at = now() WHERE id = v_inv.id;
            END IF;
        END IF;
        
        -- Calculate new prices
        v_line_subtotal := ROUND(v_new_qty * (v_edit->>'unit_price')::NUMERIC, 2);
        v_line_gst := ROUND(v_line_subtotal * v_bitem.gst_rate / 100, 2);
        
        -- Update bill_item
        UPDATE bill_items SET 
            quantity = v_new_qty,
            unit_price = (v_edit->>'unit_price')::NUMERIC,
            gst_amount = v_line_gst,
            cgst_amount = ROUND(v_line_gst / 2, 2),
            sgst_amount = ROUND(v_line_gst / 2, 2),
            total_price = v_line_subtotal + v_line_gst
        WHERE id = v_bitem.id;
        
    END LOOP;
    
    -- 3. Recalculate bill totals
    SELECT COALESCE(SUM(quantity * unit_price), 0), COALESCE(SUM(gst_amount), 0)
    INTO v_new_subtotal, v_new_gst_amount
    FROM bill_items
    WHERE bill_id = v_bill_id;
    
    v_new_total := GREATEST(ROUND(v_new_subtotal + v_new_gst_amount - v_bill.discount_amount, 2), 0);
    v_new_balance_due := GREATEST(v_new_total - v_bill.amount_paid, 0);
    
    v_diff_total := v_new_total - v_old_total;
    
    UPDATE bills SET
        subtotal = v_new_subtotal,
        gst_amount = v_new_gst_amount,
        cgst_amount = ROUND(v_new_gst_amount / 2, 2),
        sgst_amount = ROUND(v_new_gst_amount / 2, 2),
        total = v_new_total,
        balance_due = v_new_balance_due,
        is_edited = true
    WHERE id = v_bill_id;
    
    -- 4. Adjust Farmer total due
    IF v_bill.farmer_id IS NOT NULL AND v_diff_total != 0 THEN
        -- Lock farmer
        SELECT * INTO v_farmer FROM farmers WHERE id = v_bill.farmer_id FOR UPDATE;
        UPDATE farmers SET total_due = COALESCE(total_due, 0) + v_diff_total WHERE id = v_bill.farmer_id;
    END IF;
    
    -- 5. Audit Log
    INSERT INTO bill_audit_logs (bill_id, dealer_id, user_id, changes_jsonb)
    VALUES (v_bill_id, v_dealer_id, v_user_id, jsonb_build_object('items', v_audit_changes, 'old_total', v_old_total, 'new_total', v_new_total));
    
    RETURN jsonb_build_object(
        'bill_id', v_bill_id,
        'new_total', v_new_total,
        'diff_total', v_diff_total,
        'new_balance_due', v_new_balance_due
    );
END;
$edit_bill$;

GRANT EXECUTE ON FUNCTION public.edit_bill_v1(JSONB) TO authenticated;
