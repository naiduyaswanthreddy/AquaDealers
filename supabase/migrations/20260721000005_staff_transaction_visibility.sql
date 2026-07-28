CREATE OR REPLACE FUNCTION public.get_transaction_events_v1(p_branch_id UUID DEFAULT NULL, p_start_date DATE DEFAULT NULL, p_end_date DATE DEFAULT NULL, p_type TEXT DEFAULT NULL, p_status TEXT DEFAULT NULL, p_search TEXT DEFAULT NULL, p_limit INT DEFAULT 50, p_offset INT DEFAULT 0)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_dealer_id UUID := COALESCE(public.staff_dealer_id(), auth.uid()); v_total BIGINT; v_data JSONB;
BEGIN
  IF v_dealer_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT count(*) INTO v_total FROM public.transaction_events e WHERE e.dealer_id=v_dealer_id
    AND (p_branch_id IS NULL OR e.branch_id=p_branch_id) AND (p_start_date IS NULL OR e.created_at::date>=p_start_date) AND (p_end_date IS NULL OR e.created_at::date<=p_end_date)
    AND (p_type IS NULL OR e.source_type=p_type) AND (p_status IS NULL OR e.status=p_status)
    AND (p_search IS NULL OR concat_ws(' ',e.reference,e.party_name,e.source_type,e.details->>'description') ILIKE '%'||p_search||'%');
  SELECT COALESCE(jsonb_agg(row_to_json(x) ORDER BY x.created_at DESC),'[]'::jsonb) INTO v_data FROM (
    SELECT e.*,b.name branch_name,(e.status='active' AND e.undo_expires_at>now() AND e.source_type IN ('bill','bill_return','farmer_payment','stock_purchase','supplier_payment','stock_transfer','expense','cash_entry')) can_undo,
      CASE WHEN e.status='undone' THEN 'Undone' WHEN e.status='read_only' THEN 'History only' WHEN e.undo_expires_at<=now() THEN 'Undo window ended' ELSE 'Undo available' END undo_state
    FROM public.transaction_events e LEFT JOIN public.branches b ON b.id=e.branch_id WHERE e.dealer_id=v_dealer_id
      AND (p_branch_id IS NULL OR e.branch_id=p_branch_id) AND (p_start_date IS NULL OR e.created_at::date>=p_start_date) AND (p_end_date IS NULL OR e.created_at::date<=p_end_date)
      AND (p_type IS NULL OR e.source_type=p_type) AND (p_status IS NULL OR e.status=p_status)
      AND (p_search IS NULL OR concat_ws(' ',e.reference,e.party_name,e.source_type,e.details->>'description') ILIKE '%'||p_search||'%')
    ORDER BY e.created_at DESC LIMIT LEAST(GREATEST(COALESCE(p_limit,50),1),100) OFFSET GREATEST(COALESCE(p_offset,0),0)
  ) x;
  RETURN jsonb_build_object('data',v_data,'total',v_total);
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_transaction_events_v1(UUID, DATE, DATE, TEXT, TEXT, TEXT, INT, INT) TO authenticated;
NOTIFY pgrst, 'reload schema';
