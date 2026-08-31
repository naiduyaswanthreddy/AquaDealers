-- =============================================================================
-- Admin sessions use the plain anon key + a custom x-admin-token header, not a
-- real Supabase Auth session — so they run as Postgres role `anon`, not
-- `authenticated`. The `TO authenticated` policy from 20260830000001 would
-- silently return zero rows to the admin plan-management UI. Fix: read plans
-- through an admin_assert_access-gated RPC (the same proven pattern
-- admin_get_dealers already uses) instead of a direct table select, and lock
-- the table down entirely since nothing needs direct access to it anymore.
-- =============================================================================

DROP POLICY IF EXISTS whatsapp_addon_plans_select ON whatsapp_addon_plans;
CREATE POLICY whatsapp_addon_plans_no_access ON whatsapp_addon_plans
  FOR ALL USING (false);

CREATE OR REPLACE FUNCTION public.admin_get_whatsapp_plans(p_admin_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  PERFORM admin_assert_access(p_admin_id);

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', id,
        'name', name,
        'monthly_limit', monthly_limit,
        'is_active', is_active,
        'created_at', created_at
      )
      ORDER BY monthly_limit ASC
    )
    FROM whatsapp_addon_plans
  ), '[]'::JSONB);
END;
$$;
