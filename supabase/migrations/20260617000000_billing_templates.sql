-- Add template settings to branches table
ALTER TABLE branches
ADD COLUMN IF NOT EXISTS invoice_template text DEFAULT 'template_1',
ADD COLUMN IF NOT EXISTS statement_template text DEFAULT 'statement_1',
ADD COLUMN IF NOT EXISTS template_settings jsonb DEFAULT '{"showLogo": true, "showBank": true, "showTax": true, "showTerms": true}'::jsonb;
