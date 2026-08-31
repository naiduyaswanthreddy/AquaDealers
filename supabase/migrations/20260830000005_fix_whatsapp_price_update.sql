-- This project's Postgres enforces "UPDATE requires a WHERE clause" (safe-update
-- guard) — add the always-true singleton condition explicitly.
CREATE OR REPLACE FUNCTION public.admin_set_whatsapp_price(p_admin_id UUID, p_price NUMERIC)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM admin_assert_access(p_admin_id);
  UPDATE whatsapp_platform_settings SET price_per_message = p_price, updated_at = now() WHERE id = true;

  INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (p_admin_id, 'set_whatsapp_price', 'whatsapp_platform_settings', NULL,
          jsonb_build_object('price_per_message', p_price));
END;
$$;
