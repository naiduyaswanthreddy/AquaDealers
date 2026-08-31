-- Extend the transaction undo window from 48 hours to 7 days.
-- Only log_transaction_event_v1 writes undo_expires_at, so that is the only
-- function that needs to change. The undo guard checks this timestamp at
-- runtime, so existing events with a 48-hour window keep their original expiry.

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
    now() + interval '7 days'
  )
  ON CONFLICT (source_type, source_id) DO NOTHING;
END;
$$;
