-- =============================================================================
-- STAFF TRANSACTION FILTER
-- Adds current_staff_id() helper and p_staff_id filter to get_transaction_events_v1
-- so staff members see only the transactions they created.
-- Also fixes log_transaction_event_v1 to store the staff member UUID (not dealer UUID)
-- in created_by when triggered from a staff session.
-- =============================================================================

-- Returns the staff_members.id for the current staff session token, or NULL.
CREATE OR REPLACE FUNCTION public.current_staff_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token UUID;
  v_staff_id UUID;
BEGIN
  v_token := public.request_header_uuid('x-staff-token');
  IF v_token IS NULL THEN RETURN NULL; END IF;
  SELECT ss.staff_id INTO v_staff_id
    FROM staff_sessions ss
    JOIN staff_members sm ON sm.id = ss.staff_id
   WHERE ss.token = v_token
     AND NOT ss.revoked
     AND ss.expires_at > now()
     AND sm.is_active;
  RETURN v_staff_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.current_staff_id() TO authenticated, anon;

-- Update log_transaction_event_v1: store staff_id in created_by when in staff mode,
-- dealer auth.uid() otherwise.
CREATE OR REPLACE FUNCTION public.log_transaction_event_v1(
  p_dealer_id UUID,
  p_branch_id UUID,
  p_source_type TEXT,
  p_source_id UUID,
  p_reference TEXT,
  p_party_name TEXT,
  p_amount NUMERIC,
  p_quantity NUMERIC,
  p_details JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.transaction_events (
    dealer_id, branch_id, source_type, source_id, reference, party_name,
    amount, quantity, details, created_by, undo_expires_at
  ) VALUES (
    p_dealer_id, p_branch_id, p_source_type, p_source_id, p_reference, p_party_name,
    p_amount, p_quantity, COALESCE(p_details, '{}'::jsonb),
    COALESCE(public.current_staff_id(), auth.uid()),
    now() + interval '48 hours'
  )
  ON CONFLICT (source_type, source_id) DO NOTHING;
END;
$$;

-- Update get_transaction_events_v1: add p_staff_id filter.
CREATE OR REPLACE FUNCTION public.get_transaction_events_v1(
  p_branch_id UUID DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_type TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0,
  p_staff_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_dealer_id UUID := COALESCE(public.staff_dealer_id(), auth.uid());
  v_total BIGINT;
  v_data JSONB;
BEGIN
  IF v_dealer_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT count(*) INTO v_total
    FROM public.transaction_events e
   WHERE e.dealer_id = v_dealer_id
     AND (p_branch_id IS NULL OR e.branch_id = p_branch_id)
     AND (p_start_date IS NULL OR e.created_at::date >= p_start_date)
     AND (p_end_date IS NULL OR e.created_at::date <= p_end_date)
     AND (p_type IS NULL OR e.source_type = p_type)
     AND (p_status IS NULL OR e.status = p_status)
     AND (p_staff_id IS NULL OR e.created_by = p_staff_id)
     AND (p_search IS NULL OR concat_ws(' ', e.reference, e.party_name, e.source_type, e.details->>'description') ILIKE '%' || p_search || '%');

  SELECT COALESCE(jsonb_agg(row_to_json(x) ORDER BY x.created_at DESC), '[]'::jsonb) INTO v_data FROM (
    SELECT e.*, b.name branch_name,
      (e.status = 'active' AND e.undo_expires_at > now() AND e.source_type IN (
        'bill','bill_return','farmer_payment','stock_purchase','supplier_payment','stock_transfer','expense','cash_entry'
      )) can_undo,
      CASE
        WHEN e.status = 'undone' THEN 'Undone'
        WHEN e.status = 'read_only' THEN 'History only'
        WHEN e.undo_expires_at <= now() THEN 'Undo window ended'
        ELSE 'Undo available'
      END undo_state
    FROM public.transaction_events e
    LEFT JOIN public.branches b ON b.id = e.branch_id
    WHERE e.dealer_id = v_dealer_id
      AND (p_branch_id IS NULL OR e.branch_id = p_branch_id)
      AND (p_start_date IS NULL OR e.created_at::date >= p_start_date)
      AND (p_end_date IS NULL OR e.created_at::date <= p_end_date)
      AND (p_type IS NULL OR e.source_type = p_type)
      AND (p_status IS NULL OR e.status = p_status)
      AND (p_staff_id IS NULL OR e.created_by = p_staff_id)
      AND (p_search IS NULL OR concat_ws(' ', e.reference, e.party_name, e.source_type, e.details->>'description') ILIKE '%' || p_search || '%')
    ORDER BY e.created_at DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100)
    OFFSET GREATEST(COALESCE(p_offset, 0), 0)
  ) x;

  RETURN jsonb_build_object('data', v_data, 'total', v_total);
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_transaction_events_v1(UUID, DATE, DATE, TEXT, TEXT, TEXT, INT, INT, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
