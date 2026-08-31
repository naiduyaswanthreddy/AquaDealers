-- =============================================================================
-- Per-bill WhatsApp send status, so the dealer UI can show sent/failed+retry
-- instead of the manual share button once the addon is enabled.
-- =============================================================================

ALTER TABLE bills
  ADD COLUMN IF NOT EXISTS whatsapp_status TEXT CHECK (whatsapp_status IN ('sent', 'failed')),
  ADD COLUMN IF NOT EXISTS whatsapp_sent_at TIMESTAMPTZ;

-- Written by send-bill-whatsapp regardless of whether the caller is a dealer
-- or a staff session — staff currently have no bills UPDATE policy at all, so
-- going through RLS here would silently no-op for staff-created bills.
-- Same trust boundary as check_and_increment_whatsapp_usage: p_bill_id is an
-- unguessable UUID the caller already proved read access to earlier in the
-- same request.
CREATE OR REPLACE FUNCTION public.set_bill_whatsapp_status(p_bill_id UUID, p_status TEXT)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE bills
     SET whatsapp_status = p_status,
         whatsapp_sent_at = CASE WHEN p_status = 'sent' THEN now() ELSE whatsapp_sent_at END
   WHERE id = p_bill_id;
$$;

GRANT EXECUTE ON FUNCTION public.set_bill_whatsapp_status(UUID, TEXT) TO anon, authenticated;
