-- =============================================================================
-- Admin WhatsApp usage overview: total sent this month across all dealers,
-- per-dealer usage, and a cost estimate from an admin-set price/message.
-- =============================================================================

-- Singleton settings row (id must be true, PK enforces there's ever only one).
CREATE TABLE IF NOT EXISTS whatsapp_platform_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  price_per_message NUMERIC NOT NULL DEFAULT 0 CHECK (price_per_message >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO whatsapp_platform_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

ALTER TABLE whatsapp_platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY whatsapp_platform_settings_no_access ON whatsapp_platform_settings
  FOR ALL USING (false);

CREATE OR REPLACE FUNCTION public.admin_set_whatsapp_price(p_admin_id UUID, p_price NUMERIC)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM admin_assert_access(p_admin_id);
  UPDATE whatsapp_platform_settings SET price_per_message = p_price, updated_at = now();

  INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (p_admin_id, 'set_whatsapp_price', 'whatsapp_platform_settings', NULL,
          jsonb_build_object('price_per_message', p_price));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_whatsapp_overview(p_admin_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_period TEXT := to_char(now(), 'YYYY-MM');
  v_price NUMERIC;
  v_total INT;
  v_per_dealer JSONB;
BEGIN
  PERFORM admin_assert_access(p_admin_id);

  SELECT price_per_message INTO v_price FROM whatsapp_platform_settings;

  SELECT COALESCE(SUM(sent_count), 0) INTO v_total
    FROM whatsapp_message_usage
   WHERE period = v_period;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('dealer_id', dealer_id, 'used', sent_count)), '[]'::JSONB)
    INTO v_per_dealer
    FROM whatsapp_message_usage
   WHERE period = v_period;

  RETURN jsonb_build_object(
    'price_per_message', v_price,
    'total_sent_this_month', v_total,
    'total_cost_this_month', ROUND(v_total * v_price, 2),
    'per_dealer', v_per_dealer
  );
END;
$$;
