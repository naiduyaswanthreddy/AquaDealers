UPDATE plan_definitions
SET features = (
  CASE
    WHEN features ? 'product_image' THEN features
    ELSE features || '["product_image"]'::jsonb
  END
)
WHERE name = 'pro_plus';
