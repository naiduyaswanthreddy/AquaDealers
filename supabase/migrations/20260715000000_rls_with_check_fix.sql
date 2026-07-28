-- =============================================================================
-- Migration: Fix RLS UPDATE policies to include WITH CHECK clause
-- 
-- Without WITH CHECK on UPDATE policies, a malicious actor could potentially
-- update a row to set dealer_id to a different value, bypassing tenant isolation.
-- WITH CHECK ensures the row still satisfies the policy AFTER the update.
--
-- Run this in your Supabase SQL Editor.
-- =============================================================================

-- FARMERS
DROP POLICY IF EXISTS "farmers_update" ON farmers;
CREATE POLICY "farmers_update" ON farmers
  FOR UPDATE
  USING    (dealer_id = auth.uid())
  WITH CHECK (dealer_id = auth.uid());

-- INVENTORY
DROP POLICY IF EXISTS "inventory_update" ON inventory;
CREATE POLICY "inventory_update" ON inventory
  FOR UPDATE
  USING    (dealer_id = auth.uid())
  WITH CHECK (dealer_id = auth.uid());

-- STOCK PURCHASES
DROP POLICY IF EXISTS "stock_purchases_update" ON stock_purchases;
CREATE POLICY "stock_purchases_update" ON stock_purchases
  FOR UPDATE
  USING    (dealer_id = auth.uid())
  WITH CHECK (dealer_id = auth.uid());

-- BILLS
DROP POLICY IF EXISTS "bills_update" ON bills;
CREATE POLICY "bills_update" ON bills
  FOR UPDATE
  USING    (dealer_id = auth.uid())
  WITH CHECK (dealer_id = auth.uid());

-- BILL ITEMS (joins through bills)
DROP POLICY IF EXISTS "bill_items_update" ON bill_items;
CREATE POLICY "bill_items_update" ON bill_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM bills
      WHERE bills.id = bill_items.bill_id
        AND bills.dealer_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bills
      WHERE bills.id = bill_items.bill_id
        AND bills.dealer_id = auth.uid()
    )
  );

-- PAYMENTS
DROP POLICY IF EXISTS "payments_update" ON payments;
CREATE POLICY "payments_update" ON payments
  FOR UPDATE
  USING    (dealer_id = auth.uid())
  WITH CHECK (dealer_id = auth.uid());

-- EXPENSES
DROP POLICY IF EXISTS "expenses_update" ON expenses;
CREATE POLICY "expenses_update" ON expenses
  FOR UPDATE
  USING    (dealer_id = auth.uid())
  WITH CHECK (dealer_id = auth.uid());

-- CASH BOOK
DROP POLICY IF EXISTS "cash_book_update" ON cash_book;
CREATE POLICY "cash_book_update" ON cash_book
  FOR UPDATE
  USING    (dealer_id = auth.uid())
  WITH CHECK (dealer_id = auth.uid());

-- SUPPLIERS
DROP POLICY IF EXISTS "suppliers_update" ON suppliers;
CREATE POLICY "suppliers_update" ON suppliers
  FOR UPDATE
  USING    (dealer_id = auth.uid())
  WITH CHECK (dealer_id = auth.uid());

-- INVENTORY LOTS (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'inventory_lots') THEN
    EXECUTE 'DROP POLICY IF EXISTS "inventory_lots_update" ON inventory_lots';
    EXECUTE '
      CREATE POLICY "inventory_lots_update" ON inventory_lots
        FOR UPDATE
        USING    (dealer_id = auth.uid())
        WITH CHECK (dealer_id = auth.uid())
    ';
  END IF;
END
$$;

-- FARMER ITEMS (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'farmer_items') THEN
    EXECUTE 'DROP POLICY IF EXISTS "farmer_items_update" ON farmer_items';
    EXECUTE '
      CREATE POLICY "farmer_items_update" ON farmer_items
        FOR UPDATE
        USING    (dealer_id = auth.uid())
        WITH CHECK (dealer_id = auth.uid())
    ';
  END IF;
END
$$;

-- FARMER PRODUCT DISCOUNTS (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'farmer_product_discounts') THEN
    EXECUTE 'DROP POLICY IF EXISTS "farmer_product_discounts_update" ON farmer_product_discounts';
    EXECUTE '
      CREATE POLICY "farmer_product_discounts_update" ON farmer_product_discounts
        FOR UPDATE
        USING    (dealer_id = auth.uid())
        WITH CHECK (dealer_id = auth.uid())
    ';
  END IF;
END
$$;
