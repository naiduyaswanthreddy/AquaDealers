-- Distinguish WHY a send failed (quota exhausted vs an actual send/network
-- failure) so the UI can tell the dealer something actionable instead of a
-- generic "Failed". Separate column, not a wider status enum — keeps the
-- existing 'sent'/'failed' CHECK untouched (no risk to already-written rows).
ALTER TABLE bills ADD COLUMN IF NOT EXISTS whatsapp_status_reason TEXT;

CREATE OR REPLACE FUNCTION public.set_bill_whatsapp_status(p_bill_id UUID, p_status TEXT, p_reason TEXT DEFAULT NULL)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE bills
     SET whatsapp_status = p_status,
         whatsapp_status_reason = p_reason,
         whatsapp_sent_at = CASE WHEN p_status = 'sent' THEN now() ELSE whatsapp_sent_at END
   WHERE id = p_bill_id;
$$;
