-- Phase 1: Robustness Features - Database Hardening

-- 1. Add deleted_at to support soft deletes on major tables
ALTER TABLE IF EXISTS "bills" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP WITH TIME ZONE;
ALTER TABLE IF EXISTS "stock_purchases" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP WITH TIME ZONE;
ALTER TABLE IF EXISTS "farmers" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP WITH TIME ZONE;
ALTER TABLE IF EXISTS "inventory" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP WITH TIME ZONE;
ALTER TABLE IF EXISTS "payments" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP WITH TIME ZONE;
ALTER TABLE IF EXISTS "cash_book" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP WITH TIME ZONE;
ALTER TABLE IF EXISTS "expenses" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP WITH TIME ZONE;

-- 2. Add sync_version to support offline conflict resolution
ALTER TABLE IF EXISTS "bills" ADD COLUMN IF NOT EXISTS "sync_version" INTEGER DEFAULT 1;
ALTER TABLE IF EXISTS "stock_purchases" ADD COLUMN IF NOT EXISTS "sync_version" INTEGER DEFAULT 1;
ALTER TABLE IF EXISTS "farmers" ADD COLUMN IF NOT EXISTS "sync_version" INTEGER DEFAULT 1;
ALTER TABLE IF EXISTS "inventory" ADD COLUMN IF NOT EXISTS "sync_version" INTEGER DEFAULT 1;
ALTER TABLE IF EXISTS "payments" ADD COLUMN IF NOT EXISTS "sync_version" INTEGER DEFAULT 1;
ALTER TABLE IF EXISTS "cash_book" ADD COLUMN IF NOT EXISTS "sync_version" INTEGER DEFAULT 1;
ALTER TABLE IF EXISTS "expenses" ADD COLUMN IF NOT EXISTS "sync_version" INTEGER DEFAULT 1;

-- 3. Create basic B-Tree indexes for frequent filter and sort operations
-- (Helps with Month-end confusion date range filters and server-side filtering)
CREATE INDEX IF NOT EXISTS idx_bills_date ON "bills"("bill_date" DESC);
CREATE INDEX IF NOT EXISTS idx_bills_farmer_id ON "bills"("farmer_id");
CREATE INDEX IF NOT EXISTS idx_bills_deleted_at ON "bills"("deleted_at") WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS idx_stock_purchases_date ON "stock_purchases"("purchase_date" DESC);
CREATE INDEX IF NOT EXISTS idx_stock_purchases_deleted_at ON "stock_purchases"("deleted_at") WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS idx_payments_date ON "payments"("payment_date" DESC);
CREATE INDEX IF NOT EXISTS idx_payments_deleted_at ON "payments"("deleted_at") WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS idx_farmers_deleted_at ON "farmers"("deleted_at") WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS idx_cash_book_deleted_at ON "cash_book"("deleted_at") WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_deleted_at ON "expenses"("deleted_at") WHERE "deleted_at" IS NULL;
