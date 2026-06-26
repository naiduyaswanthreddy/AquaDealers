-- Add authorized_signatory_data to dealers table
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS authorized_signatory_data JSONB;
