-- Migration: Add is_walk_in flag to farmers
-- Description: Allows designating a farmer record as a walk-in customer

ALTER TABLE farmers ADD COLUMN IF NOT EXISTS is_walk_in BOOLEAN DEFAULT false;
