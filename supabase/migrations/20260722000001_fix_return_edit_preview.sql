-- An edit preview is calculated while the original return is still applied.
-- The replacement RPC undoes that return first, so the old preview must not be
-- compared again. create_farmer_return_v1 will recalculate it after the undo.
CREATE OR REPLACE FUNCTION public.replace_farmer_return_v1(p_event_id UUID, p_payload JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.undo_transaction_v1(p_event_id, 'Edited return');
  RETURN public.create_farmer_return_v1(p_payload - 'expected_preview');
END;
$$;

GRANT EXECUTE ON FUNCTION public.replace_farmer_return_v1(UUID, JSONB) TO authenticated;
NOTIFY pgrst, 'reload schema';
