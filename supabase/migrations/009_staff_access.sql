-- =============================================================================
-- AquaDealer Staff Access
-- Migration 009: Dealer-managed staff accounts, PIN login, and public portal resolution
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.staff_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  pin_hash TEXT NOT NULL,
  branch_ids UUID[] NOT NULL DEFAULT '{}'::UUID[],
  permissions JSONB NOT NULL DEFAULT '{
    "dashboard": "hidden",
    "billHistory": "hidden",
    "newBill": "visible",
    "farmerList": "hidden",
    "addFarmer": "visible",
    "inventory": "hidden",
    "suppliers": "hidden",
    "cashbook": "hidden",
    "expenses": "hidden",
    "reports": "hidden",
    "settings": "hidden",
    "branches": "hidden",
    "staffManagement": "hidden"
  }'::JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_members_dealer_id ON public.staff_members(dealer_id);
CREATE INDEX IF NOT EXISTS idx_staff_members_is_active ON public.staff_members(is_active);
CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_members_dealer_pin_hash ON public.staff_members(dealer_id, pin_hash);

ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS staff_members_select ON public.staff_members;
DROP POLICY IF EXISTS staff_members_insert ON public.staff_members;
DROP POLICY IF EXISTS staff_members_update ON public.staff_members;
DROP POLICY IF EXISTS staff_members_delete ON public.staff_members;

CREATE POLICY staff_members_select ON public.staff_members
  FOR SELECT USING (dealer_id = auth.uid());

CREATE POLICY staff_members_insert ON public.staff_members
  FOR INSERT WITH CHECK (dealer_id = auth.uid());

CREATE POLICY staff_members_update ON public.staff_members
  FOR UPDATE USING (dealer_id = auth.uid());

CREATE POLICY staff_members_delete ON public.staff_members
  FOR DELETE USING (dealer_id = auth.uid());

CREATE OR REPLACE FUNCTION public.slugify_text(p_value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(
    trim(both '-' from regexp_replace(lower(coalesce(p_value, '')), '[^a-z0-9]+', '-', 'g')),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.set_staff_members_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_staff_members_updated_at ON public.staff_members;
CREATE TRIGGER trg_staff_members_updated_at
BEFORE UPDATE ON public.staff_members
FOR EACH ROW
EXECUTE FUNCTION public.set_staff_members_updated_at();

CREATE OR REPLACE FUNCTION public.staff_portal_context(
  p_shop_slug TEXT,
  p_branch_slug TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dealer dealers%ROWTYPE;
  v_branch branches%ROWTYPE;
  v_shop_slug TEXT := public.slugify_text(p_shop_slug);
  v_branch_slug TEXT := public.slugify_text(p_branch_slug);
BEGIN
  SELECT *
  INTO v_dealer
  FROM dealers
  WHERE public.slugify_text(shop_name) = v_shop_slug
    AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shop not found';
  END IF;

  SELECT *
  INTO v_branch
  FROM branches
  WHERE dealer_id = v_dealer.id
    AND public.slugify_text(name) = v_branch_slug
    AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Branch not found';
  END IF;

  RETURN jsonb_build_object(
    'dealerId', v_dealer.id,
    'shopName', v_dealer.shop_name,
    'branchId', v_branch.id,
    'branchName', v_branch.name,
    'shopSlug', v_shop_slug,
    'branchSlug', v_branch_slug,
    'portalUrl', '/' || v_shop_slug || '/' || v_branch_slug || '/staff'
  );
END;
$$;

DROP FUNCTION IF EXISTS public.staff_portal_login(TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.staff_portal_login(
  p_shop_slug TEXT,
  p_branch_slug TEXT,
  p_pin_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_context JSONB;
  v_dealer_id UUID;
  v_branch_id UUID;
  v_shop_name TEXT;
  v_branch_name TEXT;
  v_shop_slug TEXT;
  v_branch_slug TEXT;
  v_staff public.staff_members%ROWTYPE;
BEGIN
  v_context := public.staff_portal_context(p_shop_slug, p_branch_slug);
  v_dealer_id := (v_context->>'dealerId')::UUID;
  v_branch_id := (v_context->>'branchId')::UUID;
  v_shop_name := v_context->>'shopName';
  v_branch_name := v_context->>'branchName';
  v_shop_slug := v_context->>'shopSlug';
  v_branch_slug := v_context->>'branchSlug';

  SELECT *
  INTO v_staff
  FROM public.staff_members
  WHERE dealer_id = v_dealer_id
    AND is_active = true
    AND pin_hash = p_pin_hash
    AND (
      COALESCE(array_length(branch_ids, 1), 0) = 0
      OR v_branch_id = ANY(branch_ids)
    )
  ORDER BY created_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid PIN or access denied';
  END IF;

  UPDATE public.staff_members
  SET last_login_at = now()
  WHERE id = v_staff.id;

  RETURN jsonb_build_object(
    'dealerId', v_dealer_id,
    'shopName', v_shop_name,
    'branchId', v_branch_id,
    'branchName', v_branch_name,
    'shopSlug', v_shop_slug,
    'branchSlug', v_branch_slug,
    'portalUrl', '/' || v_shop_slug || '/' || v_branch_slug || '/staff',
    'staff', jsonb_build_object(
      'id', v_staff.id,
      'name', v_staff.name,
      'phone', v_staff.phone,
      'branchIds', to_jsonb(v_staff.branch_ids),
      'permissions', v_staff.permissions,
      'defaultRoute', CASE
        WHEN COALESCE((v_staff.permissions->>'newBill'), 'hidden') = 'visible' THEN '/bills/new'
        WHEN COALESCE((v_staff.permissions->>'addFarmer'), 'hidden') = 'visible' THEN '/farmers/new'
        WHEN COALESCE((v_staff.permissions->>'billHistory'), 'hidden') = 'visible' THEN '/bills'
        WHEN COALESCE((v_staff.permissions->>'farmerList'), 'hidden') = 'visible' THEN '/farmers'
        ELSE '/more'
      END
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.slugify_text(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_portal_context(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_portal_login(TEXT, TEXT, TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
