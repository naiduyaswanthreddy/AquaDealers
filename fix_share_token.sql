-- Run this in your Supabase SQL Editor to generate share links for all farmers!
ALTER TABLE farmers ADD COLUMN IF NOT EXISTS share_token UUID DEFAULT gen_random_uuid();
UPDATE farmers SET share_token = gen_random_uuid() WHERE share_token IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS farmers_share_token_key ON farmers (share_token);
