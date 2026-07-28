-- Ensure branch theme colors exist in deployed databases and refresh PostgREST's schema cache.
ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS color TEXT;

NOTIFY pgrst, 'reload schema';
