-- CREATE OR REPLACE FUNCTION only replaces a function with the exact same
-- parameter list — adding p_reason in 20260830000008 changed the arg count,
-- so it created a second overload instead of replacing the original 2-arg
-- version from 20260830000003. Nothing calls the 2-arg form anymore (every
-- call site passes p_reason), but leaving it means a future 2-arg call would
-- silently leave whatsapp_status_reason stale instead of erroring.
DROP FUNCTION IF EXISTS public.set_bill_whatsapp_status(UUID, TEXT);
