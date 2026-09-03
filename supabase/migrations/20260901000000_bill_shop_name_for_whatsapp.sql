-- The WhatsApp bill template needs the dealer's shop name as a variable, but
-- `dealers` has only `id = auth.uid()` policies (002_rls.sql) — there is NO
-- staff policy on it (unlike bills/bill_items/farmers, which staff can read).
-- So a staff-created bill would resolve shop_name to NULL, and WhatsApp
-- rejects a template send if ANY variable is empty — silently breaking every
-- staff bill's notification.
--
-- Trust boundary: same as check_and_increment_whatsapp_usage /
-- set_bill_whatsapp_status — p_bill_id is an unguessable UUID capability
-- token, and a shop name is not sensitive (it is already shown on the public
-- farmer statement page).
CREATE OR REPLACE FUNCTION public.get_bill_shop_name(p_bill_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT d.shop_name
    FROM bills b
    JOIN dealers d ON d.id = b.dealer_id
   WHERE b.id = p_bill_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_bill_shop_name(UUID) TO anon, authenticated;
