-- Add p_search parameter to get_estimates RPC for farmer name / estimate number search.

CREATE OR REPLACE FUNCTION public.get_estimates(
  p_dealer_id  UUID,
  p_farmer_id  UUID    DEFAULT NULL,
  p_start_date DATE    DEFAULT NULL,
  p_end_date   DATE    DEFAULT NULL,
  p_limit      INTEGER DEFAULT 20,
  p_offset     INTEGER DEFAULT 0,
  p_search     TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_limit  INTEGER := LEAST(GREATEST(COALESCE(p_limit,  20), 1), 100);
  v_offset INTEGER :=      GREATEST(COALESCE(p_offset,   0), 0);
  v_search TEXT    := NULLIF(TRIM(p_search), '');
BEGIN
  PERFORM public.assert_dealer_access(p_dealer_id);

  WITH filtered AS (
    SELECT
      e.id,
      e.estimate_number,
      e.farmer_id,
      COALESCE(e.farmer_name_snapshot, f.name) AS farmer_name,
      e.estimate_date,
      e.total,
      e.status,
      e.created_at,
      COUNT(*) OVER() AS total_count
    FROM public.estimates e
    LEFT JOIN public.farmers f ON f.id = e.farmer_id
    WHERE e.dealer_id  = p_dealer_id
      AND e.deleted_at IS NULL
      AND (p_farmer_id  IS NULL OR e.farmer_id    = p_farmer_id)
      AND (p_start_date IS NULL OR e.estimate_date >= p_start_date)
      AND (p_end_date   IS NULL OR e.estimate_date <= p_end_date)
      AND (v_search IS NULL
           OR e.estimate_number ILIKE '%' || v_search || '%'
           OR COALESCE(e.farmer_name_snapshot, f.name) ILIKE '%' || v_search || '%')
    ORDER BY e.estimate_date DESC, e.created_at DESC
    LIMIT v_limit OFFSET v_offset
  )
  SELECT jsonb_build_object(
    'estimates',   COALESCE(jsonb_agg(to_jsonb(filtered) - 'total_count'), '[]'::jsonb),
    'total_count', COALESCE(MAX(filtered.total_count), 0)
  )
  INTO v_result
  FROM filtered;

  RETURN COALESCE(v_result, jsonb_build_object('estimates','[]','total_count',0));
END;
$$;

-- Grant to both old and new signatures
GRANT EXECUTE ON FUNCTION public.get_estimates(UUID, UUID, DATE, DATE, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_estimates(UUID, UUID, DATE, DATE, INTEGER, INTEGER, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
