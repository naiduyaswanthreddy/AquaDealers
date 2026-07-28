-- Cleanup function: delete transaction_events older than 30 days
-- Called daily by pg_cron at 2am UTC
CREATE OR REPLACE FUNCTION public.cleanup_old_transaction_events()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.transaction_events
  WHERE created_at < now() - interval '30 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_old_transaction_events() TO service_role;

-- Schedule with pg_cron (requires pg_cron extension enabled in Supabase dashboard)
-- Run daily at 2:00 AM UTC
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'cleanup-transaction-events-daily',
      '0 2 * * *',
      'SELECT public.cleanup_old_transaction_events()'
    );
  END IF;
END;
$$;
