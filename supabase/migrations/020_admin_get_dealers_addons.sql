-- =============================================================================
-- AquaDealer Addons Fix Part 2
-- Migration 020: Return custom_features in admin_get_dealers and cleanup
-- =============================================================================

-- Clean up any incorrectly stringified custom_features from previous bug
UPDATE dealers 
SET custom_features = '[]'::jsonb
WHERE jsonb_typeof(custom_features) = 'string';

CREATE OR REPLACE FUNCTION public.admin_get_dealers(
  p_admin_id UUID,
  p_filters JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_page INT := GREATEST(COALESCE((p_filters->>'page')::INT, 1), 1);
  v_limit INT := GREATEST(COALESCE((p_filters->>'limit')::INT, 100), 1);
  v_offset INT := (v_page - 1) * v_limit;
  v_search TEXT := NULLIF(trim(p_filters->>'search'), '');
  v_plan TEXT := NULLIF(trim(p_filters->>'plan'), '');
  v_status TEXT := NULLIF(trim(p_filters->>'status'), '');
  v_district TEXT := NULLIF(trim(p_filters->>'district'), '');
BEGIN
  PERFORM public.admin_assert_access(p_admin_id);

  RETURN (
    WITH filtered AS (
      SELECT d.*
      FROM dealers d
      WHERE
        (v_search IS NULL OR d.name ILIKE '%' || v_search || '%' OR d.shop_name ILIKE '%' || v_search || '%' OR d.phone ILIKE '%' || v_search || '%')
        AND (v_plan IS NULL OR d.plan = v_plan)
        AND (
          v_status IS NULL
          OR (v_status = 'active' AND d.is_active = true)
          OR (v_status = 'suspended' AND d.is_active = false)
        )
        AND (v_district IS NULL OR d.district = v_district)
    ),
    paged AS (
      SELECT *
      FROM filtered
      ORDER BY created_at DESC
      OFFSET v_offset
      LIMIT v_limit
    )
    SELECT jsonb_build_object(
      'data',
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'name', p.name,
            'shop_name', p.shop_name,
            'phone', p.phone,
            'email', p.email,
            'district', p.district,
            'state', p.state,
            'plan', p.plan,
            'plan_expires_at', p.plan_expires_at,
            'is_active', p.is_active,
            'created_at', p.created_at,
            'custom_features', COALESCE(p.custom_features, '[]'::jsonb)
          )
          ORDER BY p.created_at DESC
        )
        FROM paged p
      ), '[]'::JSONB),
      'count', (SELECT COUNT(*) FROM filtered)
    )
  );
END;
$$;
