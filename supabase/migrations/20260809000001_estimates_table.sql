-- supabase/migrations/20260809000001_estimates_table.sql

-- ── Tables ────────────────────────────────────────────────────────────────────

CREATE TABLE public.estimates (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_number       TEXT        NOT NULL,
  dealer_id             UUID        NOT NULL REFERENCES public.dealers(id),
  branch_id             UUID        REFERENCES public.branches(id),
  farmer_id             UUID        NOT NULL REFERENCES public.farmers(id),
  farmer_name_snapshot  TEXT,
  branch_name_snapshot  TEXT,
  estimate_date         DATE        NOT NULL DEFAULT CURRENT_DATE,
  subtotal              NUMERIC     NOT NULL DEFAULT 0,
  gst_amount            NUMERIC     NOT NULL DEFAULT 0,
  discount_amount       NUMERIC     NOT NULL DEFAULT 0,
  total                 NUMERIC     NOT NULL DEFAULT 0,
  notes                 TEXT,
  status                TEXT        NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'cancelled')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);

CREATE TABLE public.estimate_items (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id          UUID        NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  product_id           UUID        REFERENCES public.products(id),
  product_name         TEXT        NOT NULL,
  hsn_code             TEXT,
  quantity             NUMERIC     NOT NULL,
  unit_price           NUMERIC     NOT NULL,
  discount_percentage  NUMERIC     NOT NULL DEFAULT 0,
  gst_rate             NUMERIC     NOT NULL DEFAULT 0,
  total_price          NUMERIC     NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_estimates_dealer_id   ON public.estimates(dealer_id);
CREATE INDEX idx_estimates_farmer_id   ON public.estimates(farmer_id);
CREATE INDEX idx_estimates_date        ON public.estimates(estimate_date DESC);
CREATE INDEX idx_estimate_items_est_id ON public.estimate_items(estimate_id);

-- RLS: dealer can only see their own estimates
ALTER TABLE public.estimates      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimate_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dealer_own_estimates" ON public.estimates
  FOR ALL USING (dealer_id = auth.uid());

CREATE POLICY "dealer_own_estimate_items" ON public.estimate_items
  FOR ALL USING (
    estimate_id IN (SELECT id FROM public.estimates WHERE dealer_id = auth.uid())
  );

-- ── RPC: create_estimate_v1 ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_estimate_v1(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dealer_id      UUID    := (p_payload->>'dealer_id')::UUID;
  v_farmer_id      UUID    := (p_payload->>'farmer_id')::UUID;
  v_branch_id      UUID    := NULLIF(p_payload->>'branch_id', '')::UUID;
  v_estimate_id    UUID    := gen_random_uuid();
  v_estimate_number TEXT;
  v_seq            INTEGER;
  v_item           JSONB;
BEGIN
  PERFORM public.assert_dealer_access(v_dealer_id);

  IF v_farmer_id IS NULL THEN
    RAISE EXCEPTION 'farmer_id is required for estimates';
  END IF;

  -- Per-dealer sequential estimate number (EST-0001, EST-0002, ...)
  SELECT COALESCE(MAX(
    CASE WHEN estimate_number ~ '^EST-[0-9]+$'
    THEN CAST(SUBSTRING(estimate_number FROM 5) AS INTEGER)
    ELSE 0 END
  ), 0) + 1
  INTO v_seq
  FROM public.estimates
  WHERE dealer_id = v_dealer_id;

  v_estimate_number := 'EST-' || LPAD(v_seq::TEXT, 4, '0');

  INSERT INTO public.estimates (
    id, estimate_number, dealer_id, branch_id, farmer_id,
    farmer_name_snapshot, branch_name_snapshot, estimate_date,
    subtotal, gst_amount, discount_amount, total, notes, status
  ) VALUES (
    v_estimate_id,
    v_estimate_number,
    v_dealer_id,
    v_branch_id,
    v_farmer_id,
    p_payload->>'farmer_name_snapshot',
    p_payload->>'branch_name_snapshot',
    COALESCE(NULLIF(p_payload->>'estimate_date','')::DATE, CURRENT_DATE),
    COALESCE((p_payload->>'subtotal')::NUMERIC,        0),
    COALESCE((p_payload->>'gst_amount')::NUMERIC,      0),
    COALESCE((p_payload->>'discount_amount')::NUMERIC, 0),
    COALESCE((p_payload->>'total')::NUMERIC,           0),
    NULLIF(p_payload->>'notes', ''),
    'active'
  );

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'items') LOOP
    INSERT INTO public.estimate_items (
      estimate_id, product_id, product_name, hsn_code,
      quantity, unit_price, discount_percentage, gst_rate, total_price
    ) VALUES (
      v_estimate_id,
      NULLIF(v_item->>'product_id', '')::UUID,
      v_item->>'product_name',
      NULLIF(v_item->>'hsn_code', ''),
      (v_item->>'quantity')::NUMERIC,
      (v_item->>'unit_price')::NUMERIC,
      COALESCE((v_item->>'discount_percentage')::NUMERIC, 0),
      COALESCE((v_item->>'gst_rate')::NUMERIC,            0),
      (v_item->>'total_price')::NUMERIC
    );
  END LOOP;

  RETURN jsonb_build_object(
    'estimate_id',     v_estimate_id,
    'estimate_number', v_estimate_number
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_estimate_v1(JSONB) TO authenticated;

-- ── RPC: get_estimates ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_estimates(
  p_dealer_id  UUID,
  p_farmer_id  UUID    DEFAULT NULL,
  p_start_date DATE    DEFAULT NULL,
  p_end_date   DATE    DEFAULT NULL,
  p_limit      INTEGER DEFAULT 20,
  p_offset     INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_limit  INTEGER := LEAST(GREATEST(COALESCE(p_limit,  20), 1), 100);
  v_offset INTEGER :=      GREATEST(COALESCE(p_offset,   0), 0);
BEGIN
  PERFORM public.assert_dealer_access(p_dealer_id);

  WITH filtered AS (
    SELECT
      e.id,
      e.estimate_number,
      e.farmer_id,
      COALESCE(e.farmer_name_snapshot, f.name) AS farmer_name,
      e.estimate_date,
      e.total,
      e.status,
      e.created_at,
      COUNT(*) OVER() AS total_count
    FROM public.estimates e
    LEFT JOIN public.farmers f ON f.id = e.farmer_id
    WHERE e.dealer_id  = p_dealer_id
      AND e.deleted_at IS NULL
      AND (p_farmer_id  IS NULL OR e.farmer_id    = p_farmer_id)
      AND (p_start_date IS NULL OR e.estimate_date >= p_start_date)
      AND (p_end_date   IS NULL OR e.estimate_date <= p_end_date)
    ORDER BY e.estimate_date DESC, e.created_at DESC
    LIMIT v_limit OFFSET v_offset
  )
  SELECT jsonb_build_object(
    'estimates',   COALESCE(jsonb_agg(to_jsonb(filtered) - 'total_count'), '[]'::jsonb),
    'total_count', COALESCE(MAX(filtered.total_count), 0)
  )
  INTO v_result
  FROM filtered;

  RETURN COALESCE(v_result, jsonb_build_object('estimates','[]','total_count',0));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_estimates(UUID, UUID, DATE, DATE, INTEGER, INTEGER) TO authenticated;

-- ── RPC: get_estimate_detail ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_estimate_detail(
  p_dealer_id  UUID,
  p_estimate_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  PERFORM public.assert_dealer_access(p_dealer_id);

  SELECT jsonb_build_object(
    'id',                   e.id,
    'estimate_number',      e.estimate_number,
    'dealer_id',            e.dealer_id,
    'branch_id',            e.branch_id,
    'farmer_id',            e.farmer_id,
    'farmer_name_snapshot', e.farmer_name_snapshot,
    'branch_name_snapshot', e.branch_name_snapshot,
    'estimate_date',        e.estimate_date,
    'subtotal',             e.subtotal,
    'gst_amount',           e.gst_amount,
    'discount_amount',      e.discount_amount,
    'total',                e.total,
    'notes',                e.notes,
    'status',               e.status,
    'created_at',           e.created_at,
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',                  ei.id,
        'product_id',          ei.product_id,
        'product_name',        ei.product_name,
        'hsn_code',            ei.hsn_code,
        'quantity',            ei.quantity,
        'unit_price',          ei.unit_price,
        'discount_percentage', ei.discount_percentage,
        'gst_rate',            ei.gst_rate,
        'total_price',         ei.total_price
      ) ORDER BY ei.created_at)
      FROM public.estimate_items ei
      WHERE ei.estimate_id = e.id
    ), '[]'::jsonb)
  )
  INTO v_result
  FROM public.estimates e
  WHERE e.id        = p_estimate_id
    AND e.dealer_id = p_dealer_id
    AND e.deleted_at IS NULL;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_estimate_detail(UUID, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
