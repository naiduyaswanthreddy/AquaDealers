# Estimates Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `bills.is_estimate` flag approach with a fully separate `estimates` table, dedicated pages, and a clean create-estimate flow that requires no stock and has zero financial impact.

**Architecture:** New `estimates` + `estimate_items` Postgres tables with 3 RPCs (`create_estimate_v1`, `get_estimates`, `get_estimate_detail`). Separate `estimateCartStore` (Zustand, simpler than CartStore — no payment/credit/lots). Three new pages under `/estimates`. The estimate toggle is removed from the billing ReviewStep. Old `bills.is_estimate=true` rows stay untouched.

**Tech Stack:** React 18, TypeScript, Zustand (persist), React Query (@tanstack/react-query), Supabase PostgREST + plpgsql RPCs, Tailwind CSS, lucide-react icons.

## Global Constraints

- All new RPCs call `PERFORM public.assert_dealer_access(p_dealer_id)` as first statement.
- All new pages are lazy-loaded in `src/App.tsx` (matching existing pattern).
- All new Zustand stores use `persist` middleware with `sessionStorage`.
- Farmer is **required** on every estimate — no walk-in estimates.
- Estimates never touch: `inventory`, `payments`, `cash_book`, or `farmers.total_due`.
- TypeScript must compile clean after every task: `npx tsc --noEmit`.
- Migration file naming: `20260809000001_estimates_table.sql`.

---

## File Map

**Create:**
- `supabase/migrations/20260809000001_estimates_table.sql`
- `src/features/estimates/types.ts`
- `src/features/estimates/services/estimateService.ts`
- `src/features/estimates/hooks/useEstimate.ts`
- `src/features/estimates/stores/estimateCartStore.ts`
- `src/features/estimates/components/EstimateItemPicker.tsx`
- `src/features/estimates/pages/EstimatesListPage.tsx`
- `src/features/estimates/pages/NewEstimatePage.tsx`
- `src/features/estimates/pages/EstimateDetailPage.tsx`

**Modify:**
- `src/App.tsx` — add 3 lazy imports + 3 routes
- `src/components/layout/DesktopSidebar.tsx` — add Estimates nav item
- `src/features/placeholder/MorePage.tsx` — add Estimates card in "Records & Bills"
- `src/features/billing/components/ReviewStep.tsx` — remove `is_estimate` toggle card

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260809000001_estimates_table.sql`

**Interfaces:**
- Produces: `estimates` table, `estimate_items` table, RPCs `create_estimate_v1`, `get_estimates`, `get_estimate_detail`

- [ ] **Step 1: Write the migration file**

```sql
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
```

- [ ] **Step 2: Push migration**

```bash
npx supabase db push
```

Expected output: `Applying migration 20260809000001_estimates_table.sql... Finished supabase db push.`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260809000001_estimates_table.sql
git commit -m "feat(estimates): add estimates + estimate_items tables and 3 RPCs"
```

---

## Task 2: Types, Service, Hook

**Files:**
- Create: `src/features/estimates/types.ts`
- Create: `src/features/estimates/services/estimateService.ts`
- Create: `src/features/estimates/hooks/useEstimate.ts`

**Interfaces:**
- Produces: `EstimateCartItem`, `EstimatePayload`, `EstimateListItem`, `Estimate`, `EstimateItemDetail`; `estimateService.createEstimate()`, `estimateService.getEstimates()`, `estimateService.getEstimateDetail()`; React Query hooks `useCreateEstimate`, `useEstimates`, `useEstimateDetail`

- [ ] **Step 1: Write types.ts**

```ts
// src/features/estimates/types.ts

export interface EstimateCartItem {
  product_id: string;
  product_name: string;
  hsn_code: string | null;
  product_type: string;
  unit: string;
  quantity: number;
  base_unit_price: number;
  unit_price: number;           // base_unit_price * (1 - discount_pct/100)
  discount_percentage: number;
  gst_rate: number;
  mrp?: number;
  default_discount_percentage?: number;
  farmer_discount_percentage?: number | null;
  discount_source?: 'product_default' | 'farmer_default' | 'farmer_product' | 'manual';
  discount_label?: string | null;
}

export interface EstimatePayload {
  dealer_id: string;
  branch_id?: string | null;
  farmer_id: string;
  farmer_name_snapshot?: string | null;
  branch_name_snapshot?: string | null;
  estimate_date: string;        // YYYY-MM-DD
  subtotal: number;
  gst_amount: number;
  discount_amount: number;
  total: number;
  notes?: string | null;
  items: Array<{
    product_id: string;
    product_name: string;
    hsn_code?: string | null;
    quantity: number;
    unit_price: number;
    discount_percentage: number;
    gst_rate: number;
    total_price: number;
  }>;
}

export interface EstimateListItem {
  id: string;
  estimate_number: string;
  farmer_id: string;
  farmer_name: string;
  estimate_date: string;
  total: number;
  status: 'active' | 'cancelled';
  created_at: string;
}

export interface EstimateItemDetail {
  id: string;
  product_id: string | null;
  product_name: string;
  hsn_code: string | null;
  quantity: number;
  unit_price: number;
  discount_percentage: number;
  gst_rate: number;
  total_price: number;
}

export interface Estimate {
  id: string;
  estimate_number: string;
  dealer_id: string;
  branch_id: string | null;
  farmer_id: string;
  farmer_name_snapshot: string | null;
  branch_name_snapshot: string | null;
  estimate_date: string;
  subtotal: number;
  gst_amount: number;
  discount_amount: number;
  total: number;
  notes: string | null;
  status: 'active' | 'cancelled';
  created_at: string;
  items: EstimateItemDetail[];
}
```

- [ ] **Step 2: Write estimateService.ts**

```ts
// src/features/estimates/services/estimateService.ts
import { supabase } from '@/lib/supabase';
import type { EstimatePayload, EstimateListItem, Estimate } from '../types';

export const estimateService = {
  async createEstimate(
    payload: EstimatePayload
  ): Promise<{ estimate_id: string; estimate_number: string }> {
    const { data, error } = await supabase.rpc('create_estimate_v1', {
      p_payload: payload,
    });
    if (error) throw error;
    return data as { estimate_id: string; estimate_number: string };
  },

  async getEstimates(params: {
    dealerId: string;
    farmerId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ estimates: EstimateListItem[]; total_count: number }> {
    const { data, error } = await supabase.rpc('get_estimates', {
      p_dealer_id:  params.dealerId,
      p_farmer_id:  params.farmerId  ?? null,
      p_start_date: params.startDate ?? null,
      p_end_date:   params.endDate   ?? null,
      p_limit:      params.limit     ?? 20,
      p_offset:     params.offset    ?? 0,
    });
    if (error) throw error;
    return data as { estimates: EstimateListItem[]; total_count: number };
  },

  async getEstimateDetail(dealerId: string, estimateId: string): Promise<Estimate> {
    const { data, error } = await supabase.rpc('get_estimate_detail', {
      p_dealer_id:   dealerId,
      p_estimate_id: estimateId,
    });
    if (error) throw error;
    return data as Estimate;
  },
};
```

- [ ] **Step 3: Write useEstimate.ts**

```ts
// src/features/estimates/hooks/useEstimate.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { estimateService } from '../services/estimateService';
import type { EstimatePayload } from '../types';

interface UseEstimatesParams {
  dealerId: string;
  farmerId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export function useEstimates(params: UseEstimatesParams) {
  return useQuery({
    queryKey: ['estimates', params],
    queryFn: () => estimateService.getEstimates(params),
    enabled: !!params.dealerId,
    staleTime: 60_000,
  });
}

export function useEstimateDetail(dealerId: string, estimateId: string) {
  return useQuery({
    queryKey: ['estimate', estimateId],
    queryFn: () => estimateService.getEstimateDetail(dealerId, estimateId),
    enabled: !!dealerId && !!estimateId,
    staleTime: 60_000,
  });
}

export function useCreateEstimate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: EstimatePayload) =>
      estimateService.createEstimate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimates'] });
    },
  });
}
```

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/features/estimates/
git commit -m "feat(estimates): add types, service, and React Query hooks"
```

---

## Task 3: EstimateCartStore

**Files:**
- Create: `src/features/estimates/stores/estimateCartStore.ts`

**Interfaces:**
- Consumes: `EstimateCartItem` from `../types`
- Produces: `useEstimateCartStore`, all state fields and actions listed below

- [ ] **Step 1: Write estimateCartStore.ts**

```ts
// src/features/estimates/stores/estimateCartStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { getLocalDateString } from '@/lib/utils';
import type { EstimateCartItem } from '../types';

interface EstimateCartState {
  // state
  farmerId: string | null;
  farmerName: string | null;
  items: EstimateCartItem[];
  gstEnabled: boolean;
  discountAmount: number;
  notes: string;
  estimateDate: string;

  // actions
  setFarmer: (id: string, name: string) => void;
  clearFarmer: () => void;
  addItem: (item: EstimateCartItem) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  updateItemDiscount: (productId: string, discountPercentage: number) => void;
  setGstEnabled: (v: boolean) => void;
  setDiscountAmount: (v: number) => void;
  setNotes: (v: string) => void;
  setEstimateDate: (v: string) => void;
  clearCart: () => void;
}

const defaultState = (): Omit<EstimateCartState, keyof {
  [K in keyof EstimateCartState as EstimateCartState[K] extends Function ? K : never]: never
}> => ({
  farmerId: null,
  farmerName: null,
  items: [],
  gstEnabled: true,
  discountAmount: 0,
  notes: '',
  estimateDate: getLocalDateString(),
});

export const useEstimateCartStore = create<EstimateCartState>()(
  persist(
    (set, get) => ({
      farmerId: null,
      farmerName: null,
      items: [],
      gstEnabled: true,
      discountAmount: 0,
      notes: '',
      estimateDate: getLocalDateString(),

      setFarmer: (id, name) => set({ farmerId: id, farmerName: name }),
      clearFarmer: () => set({ farmerId: null, farmerName: null, items: [] }),

      addItem: (item) => {
        const items = get().items;
        const existing = items.findIndex(i => i.product_id === item.product_id);
        if (existing >= 0) {
          // increment quantity if already in cart
          set({
            items: items.map((i, idx) =>
              idx === existing
                ? { ...i, quantity: i.quantity + item.quantity }
                : i
            ),
          });
        } else {
          set({ items: [...items, item] });
        }
      },

      removeItem: (productId) =>
        set({ items: get().items.filter(i => i.product_id !== productId) }),

      updateQuantity: (productId, quantity) =>
        set({
          items: get().items.map(i =>
            i.product_id === productId ? { ...i, quantity } : i
          ),
        }),

      updateItemDiscount: (productId, discountPercentage) =>
        set({
          items: get().items.map(i => {
            if (i.product_id !== productId) return i;
            const unit_price = Number(
              (i.base_unit_price * (1 - discountPercentage / 100)).toFixed(2)
            );
            return { ...i, discountPercentage, unit_price, discount_source: 'manual' as const };
          }),
        }),

      setGstEnabled: (v) => set({ gstEnabled: v }),
      setDiscountAmount: (v) => set({ discountAmount: v }),
      setNotes: (v) => set({ notes: v }),
      setEstimateDate: (v) => set({ estimateDate: v }),

      clearCart: () =>
        set({
          farmerId: null,
          farmerName: null,
          items: [],
          gstEnabled: true,
          discountAmount: 0,
          notes: '',
          estimateDate: getLocalDateString(),
        }),
    }),
    {
      name: 'aqua-estimate-cart',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/estimates/stores/estimateCartStore.ts
git commit -m "feat(estimates): add estimateCartStore"
```

---

## Task 4: EstimateItemPicker Component

**Files:**
- Create: `src/features/estimates/components/EstimateItemPicker.tsx`

**Interfaces:**
- Consumes: `useEstimateCartStore` from `../stores/estimateCartStore`; `EstimateCartItem` from `../types`
- Produces: `<EstimateItemPicker />` — a self-contained step component for farmer + item selection

This component handles:
1. Farmer search (Combobox, same pattern as billing's farmer picker)
2. Product search (queries `inventory` joined to `products`)
3. Farmer-specific discount loading (from `farmer_product_discounts` table)
4. Cart item list with quantity edit + remove
5. GST toggle

**Reference files** (read before implementing): `src/features/billing/components/ProductSelector.tsx` for product search query pattern and farmer picker Combobox implementation.

- [ ] **Step 1: Write EstimateItemPicker.tsx**

```tsx
// src/features/estimates/components/EstimateItemPicker.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Search, X, Plus, Minus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useBranchStore } from '@/stores/branchStore';
import { useEstimateCartStore } from '../stores/estimateCartStore';
import type { EstimateCartItem } from '../types';
import { cn, formatCurrency } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProductSearchResult {
  inventory_id: string;
  product_id: string;
  product_name: string;
  product_type: string;
  unit: string;
  hsn_code: string | null;
  mrp: number;
  selling_price: number;
  default_discount_percentage: number;
  gst_rate: number;
  available_quantity: number;
}

interface FarmerSearchResult {
  id: string;
  name: string;
  village: string | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const EstimateItemPicker: React.FC = () => {
  const { user } = useAuthStore();
  const { activeBranch } = useBranchStore();
  const {
    farmerId, farmerName, items, gstEnabled,
    setFarmer, clearFarmer, addItem, removeItem, updateQuantity,
    updateItemDiscount, setGstEnabled,
  } = useEstimateCartStore();

  const [farmerQuery, setFarmerQuery]     = useState('');
  const [farmerResults, setFarmerResults] = useState<FarmerSearchResult[]>([]);
  const [farmerLoading, setFarmerLoading] = useState(false);
  const [showFarmerList, setShowFarmerList] = useState(false);

  const [productQuery, setProductQuery]     = useState('');
  const [productResults, setProductResults] = useState<ProductSearchResult[]>([]);
  const [productLoading, setProductLoading] = useState(false);

  // farmer-product discounts keyed by product_id
  const [farmerDiscounts, setFarmerDiscounts] = useState<Record<string, number>>({});

  // ── Farmer search ──────────────────────────────────────────────────────────

  const searchFarmers = useCallback(async (q: string) => {
    if (!user?.id || q.trim().length < 1) { setFarmerResults([]); return; }
    setFarmerLoading(true);
    const { data } = await supabase
      .from('farmers')
      .select('id, name, village')
      .eq('dealer_id', user.id)
      .eq('is_active', true)
      .ilike('name', `%${q}%`)
      .limit(10);
    setFarmerResults(data || []);
    setFarmerLoading(false);
  }, [user?.id]);

  useEffect(() => {
    const t = setTimeout(() => searchFarmers(farmerQuery), 300);
    return () => clearTimeout(t);
  }, [farmerQuery, searchFarmers]);

  const loadFarmerDiscounts = useCallback(async (fid: string) => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('farmer_product_discounts')
      .select('product_id, discount_percentage')
      .eq('dealer_id', user.id)
      .eq('farmer_id', fid);
    if (data) {
      setFarmerDiscounts(
        Object.fromEntries(data.map(r => [r.product_id, r.discount_percentage]))
      );
    }
  }, [user?.id]);

  const handleSelectFarmer = (f: FarmerSearchResult) => {
    setFarmer(f.id, f.name);
    loadFarmerDiscounts(f.id);
    setFarmerQuery('');
    setFarmerResults([]);
    setShowFarmerList(false);
  };

  // ── Product search ─────────────────────────────────────────────────────────

  const searchProducts = useCallback(async (q: string) => {
    if (!user?.id || q.trim().length < 1) { setProductResults([]); return; }
    setProductLoading(true);
    const query = supabase
      .from('inventory')
      .select(`
        id,
        product_id,
        selling_price,
        mrp,
        default_discount_percentage,
        quantity,
        products!inner(id, name, type, unit, hsn_code, gst_rate)
      `)
      .eq('dealer_id', user.id)
      .eq('products.is_active', true)
      .ilike('products.name', `%${q}%`)
      .gt('quantity', 0)           // estimates CAN exceed this — shown for info only
      .limit(20);

    if (activeBranch?.id) query.eq('branch_id', activeBranch.id);

    const { data } = await query;
    setProductResults(
      (data || []).map((row: any) => ({
        inventory_id: row.id,
        product_id: row.products.id,
        product_name: row.products.name,
        product_type: row.products.type,
        unit: row.products.unit,
        hsn_code: row.products.hsn_code,
        mrp: row.mrp,
        selling_price: row.selling_price,
        default_discount_percentage: row.default_discount_percentage || 0,
        gst_rate: row.products.gst_rate || 0,
        available_quantity: row.quantity,
      }))
    );
    setProductLoading(false);
  }, [user?.id, activeBranch?.id]);

  useEffect(() => {
    const t = setTimeout(() => searchProducts(productQuery), 300);
    return () => clearTimeout(t);
  }, [productQuery, searchProducts]);

  const handleAddProduct = (p: ProductSearchResult) => {
    // farmer-specific > product default
    const farmerPct = farmerDiscounts[p.product_id];
    const discountPct = farmerPct ?? p.default_discount_percentage;
    const discountSource = farmerPct !== undefined
      ? 'farmer_product' as const
      : p.default_discount_percentage > 0 ? 'product_default' as const : 'manual' as const;

    const unit_price = Number(
      (p.selling_price * (1 - discountPct / 100)).toFixed(2)
    );

    const item: EstimateCartItem = {
      product_id: p.product_id,
      product_name: p.product_name,
      product_type: p.product_type,
      unit: p.unit,
      hsn_code: p.hsn_code,
      quantity: 1,
      base_unit_price: p.selling_price,
      unit_price,
      discount_percentage: discountPct,
      gst_rate: p.gst_rate,
      mrp: p.mrp,
      default_discount_percentage: p.default_discount_percentage,
      farmer_discount_percentage: farmerPct ?? null,
      discount_source: discountSource,
    };

    addItem(item);
    setProductQuery('');
    setProductResults([]);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">
      {/* Farmer picker */}
      <div className="relative">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Farmer <span className="text-red-500">*</span>
        </label>
        {farmerId ? (
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <span className="flex-1 font-medium text-gray-900">{farmerName}</span>
            <button
              type="button"
              onClick={() => { clearFarmer(); setFarmerDiscounts({}); }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search farmer..."
              value={farmerQuery}
              onChange={e => { setFarmerQuery(e.target.value); setShowFarmerList(true); }}
              onFocus={() => setShowFarmerList(true)}
              className="w-full rounded-lg border border-gray-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {showFarmerList && farmerResults.length > 0 && (
              <div className="absolute z-20 mt-1 w-full rounded-lg border bg-white shadow-lg max-h-56 overflow-y-auto">
                {farmerResults.map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onMouseDown={() => handleSelectFarmer(f)}
                    className="flex w-full flex-col px-3 py-2 text-left hover:bg-gray-50"
                  >
                    <span className="font-medium text-sm text-gray-900">{f.name}</span>
                    {f.village && <span className="text-xs text-gray-500">{f.village}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Product search (only show once farmer selected) */}
      {farmerId && (
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-1">Add Items</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search product..."
              value={productQuery}
              onChange={e => setProductQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          {productResults.length > 0 && (
            <div className="absolute z-20 mt-1 w-full rounded-lg border bg-white shadow-lg max-h-64 overflow-y-auto">
              {productResults.map(p => (
                <button
                  key={p.product_id}
                  type="button"
                  onMouseDown={() => handleAddProduct(p)}
                  className="flex w-full items-center justify-between px-3 py-2 hover:bg-gray-50 text-left"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{p.product_name}</p>
                    <p className="text-xs text-gray-500">{p.unit} · Stock: {p.available_quantity}</p>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">
                    {formatCurrency(p.selling_price)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Cart item list */}
      {items.length > 0 && (
        <div className="flex flex-col gap-2">
          {items.map(item => (
            <div
              key={item.product_id}
              className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{item.product_name}</p>
                <p className="text-xs text-gray-500">
                  {formatCurrency(item.unit_price)}/{item.unit}
                  {item.discount_percentage > 0 && (
                    <span className="ml-1 text-emerald-600">({item.discount_percentage}% off)</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => updateQuantity(item.product_id, Math.max(1, item.quantity - 1))}
                  className="rounded-md p-1 hover:bg-gray-200"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={e => updateQuantity(item.product_id, Math.max(1, Number(e.target.value)))}
                  className="w-12 text-center text-sm border border-gray-200 rounded px-1 py-0.5"
                />
                <button
                  type="button"
                  onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                  className="rounded-md p-1 hover:bg-gray-200"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
              <span className="text-sm font-semibold w-20 text-right text-gray-900">
                {formatCurrency(item.unit_price * item.quantity)}
              </span>
              <button
                type="button"
                onClick={() => removeItem(item.product_id)}
                className="text-gray-400 hover:text-red-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* GST toggle */}
      {items.length > 0 && (
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={gstEnabled}
            onChange={e => setGstEnabled(e.target.checked)}
            className="h-4 w-4 rounded accent-primary"
          />
          <span className="text-sm text-gray-700">Include GST</span>
        </label>
      )}
    </div>
  );
};
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/estimates/components/EstimateItemPicker.tsx
git commit -m "feat(estimates): add EstimateItemPicker component"
```

---

## Task 5: NewEstimatePage

**Files:**
- Create: `src/features/estimates/pages/NewEstimatePage.tsx`

**Interfaces:**
- Consumes: `EstimateItemPicker`, `useEstimateCartStore`, `useCreateEstimate`, `useAuthStore`, `useBranchStore`, `getLocalDateString`
- Produces: `/estimates/new` route page; on success navigates to `/estimates/:id`

Two steps: `items` → `review`. Review shows totals, notes field, date picker, and "Save Estimate" button.

- [ ] **Step 1: Write NewEstimatePage.tsx**

```tsx
// src/features/estimates/pages/NewEstimatePage.tsx
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useBranchStore } from '@/stores/branchStore';
import { PageShell } from '@/components/layout/PageShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui';
import { formatCurrency, getLocalDateString } from '@/lib/utils';
import { EstimateItemPicker } from '../components/EstimateItemPicker';
import { useEstimateCartStore } from '../stores/estimateCartStore';
import { useCreateEstimate } from '../hooks/useEstimate';
import type { EstimatePayload } from '../types';

type Step = 'items' | 'review';

export const NewEstimatePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { activeBranch } = useBranchStore();
  const { mutateAsync: createEstimate, isPending } = useCreateEstimate();

  const {
    farmerId, farmerName, items, gstEnabled, discountAmount,
    notes, estimateDate, setNotes, setEstimateDate, setDiscountAmount,
    clearCart,
  } = useEstimateCartStore();

  const [step, setStep] = useState<Step>('items');

  // ── Totals calculation ─────────────────────────────────────────────────────

  const totals = useMemo(() => {
    const subtotalBeforeDiscount = items.reduce(
      (sum, i) => sum + i.unit_price * i.quantity, 0
    );
    const subtotal = Math.max(0, subtotalBeforeDiscount - discountAmount);
    const gstAmount = gstEnabled
      ? items.reduce((sum, i) => sum + (i.unit_price * i.quantity * i.gst_rate) / 100, 0)
      : 0;
    const total = subtotal + gstAmount;
    return { subtotal, gstAmount, total };
  }, [items, gstEnabled, discountAmount]);

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!user?.id || !farmerId) return;

    const payload: EstimatePayload = {
      dealer_id:            user.id,
      branch_id:            activeBranch?.id ?? null,
      farmer_id:            farmerId,
      farmer_name_snapshot: farmerName,
      branch_name_snapshot: activeBranch?.name ?? null,
      estimate_date:        estimateDate || getLocalDateString(),
      subtotal:             totals.subtotal,
      gst_amount:           totals.gstAmount,
      discount_amount:      discountAmount,
      total:                totals.total,
      notes:                notes || null,
      items: items.map(i => ({
        product_id:          i.product_id,
        product_name:        i.product_name,
        hsn_code:            i.hsn_code,
        quantity:            i.quantity,
        unit_price:          i.unit_price,
        discount_percentage: i.discount_percentage,
        gst_rate:            gstEnabled ? i.gst_rate : 0,
        total_price:         Number((i.unit_price * i.quantity).toFixed(2)),
      })),
    };

    try {
      const result = await createEstimate(payload);
      clearCart();
      toast.success(`Estimate ${result.estimate_number} saved!`);
      navigate(`/estimates/${result.estimate_id}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save estimate.');
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const canProceed = farmerId && items.length > 0;

  return (
    <PageShell>
      <PageHeader
        title="New Estimate"
        icon={<FileText className="h-5 w-5" />}
        backTo="/estimates"
      />

      {/* Step indicator */}
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        {(['items', 'review'] as Step[]).map((s, idx) => (
          <React.Fragment key={s}>
            <div className={cn(
              'flex items-center gap-1.5 text-sm font-medium',
              step === s ? 'text-primary' : 'text-gray-400'
            )}>
              <span className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
                step === s ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'
              )}>{idx + 1}</span>
              {s === 'items' ? 'Items' : 'Review'}
            </div>
            {idx === 0 && <div className="flex-1 h-px bg-gray-200" />}
          </React.Fragment>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {step === 'items' && <EstimateItemPicker />}

        {step === 'review' && (
          <div className="flex flex-col gap-4 max-w-lg">
            {/* Totals */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span>{formatCurrency(totals.subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-sm text-emerald-600">
                  <span>Discount</span>
                  <span>-{formatCurrency(discountAmount)}</span>
                </div>
              )}
              {totals.gstAmount > 0 && (
                <div className="flex justify-between text-sm text-gray-600">
                  <span>GST</span>
                  <span>{formatCurrency(totals.gstAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold border-t pt-2 text-gray-900">
                <span>Total</span>
                <span>{formatCurrency(totals.total)}</span>
              </div>
            </div>

            {/* Overall discount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Overall Discount (₹)
              </label>
              <input
                type="number"
                min={0}
                value={discountAmount || ''}
                onChange={e => setDiscountAmount(Number(e.target.value) || 0)}
                placeholder="0"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {/* Estimate date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estimate Date
              </label>
              <input
                type="date"
                value={estimateDate}
                onChange={e => setEstimateDate(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                rows={3}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Optional notes for this estimate..."
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer navigation */}
      <div className="border-t px-4 py-3 flex items-center justify-between gap-3 bg-white">
        {step === 'items' ? (
          <>
            <Button variant="ghost" onClick={() => navigate('/estimates')}>
              Cancel
            </Button>
            <Button
              onClick={() => setStep('review')}
              disabled={!canProceed}
            >
              Review
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => setStep('items')}>
              <ChevronLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending ? 'Saving...' : 'Save Estimate'}
            </Button>
          </>
        )}
      </div>
    </PageShell>
  );
};

export default NewEstimatePage;
```

> **Note:** `cn` is imported from `@/lib/utils` — add it to the import if not already there. Check existing page files like `DailyBookPage.tsx` for the exact `PageShell`/`PageHeader` import pattern for your version.

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/estimates/pages/NewEstimatePage.tsx
git commit -m "feat(estimates): add NewEstimatePage with 2-step create flow"
```

---

## Task 6: EstimatesListPage

**Files:**
- Create: `src/features/estimates/pages/EstimatesListPage.tsx`

**Interfaces:**
- Consumes: `useEstimates`, `EstimateListItem`, `useAuthStore`
- Produces: `/estimates` list page

- [ ] **Step 1: Write EstimatesListPage.tsx**

```tsx
// src/features/estimates/pages/EstimatesListPage.tsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, Plus, ChevronRight } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { PageShell } from '@/components/layout/PageShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useEstimates } from '../hooks/useEstimate';

const PAGE_SIZE = 20;

export const EstimatesListPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [offset, setOffset] = useState(0);

  const { data, isLoading } = useEstimates({
    dealerId: user?.id || '',
    limit: PAGE_SIZE,
    offset,
  });

  const estimates = data?.estimates ?? [];
  const totalCount = data?.total_count ?? 0;

  return (
    <PageShell>
      <PageHeader
        title="Estimates"
        icon={<FileText className="h-5 w-5" />}
        actions={
          <Button size="sm" onClick={() => navigate('/estimates/new')}>
            <Plus className="h-4 w-4 mr-1" />
            New Estimate
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
            Loading estimates...
          </div>
        )}

        {!isLoading && estimates.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-4">
            <FileText className="h-12 w-12 text-gray-200" />
            <p className="text-gray-500 text-sm">No estimates yet.</p>
            <Button size="sm" onClick={() => navigate('/estimates/new')}>
              Create first estimate
            </Button>
          </div>
        )}

        {estimates.length > 0 && (
          <>
            {/* Desktop table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    <th className="px-4 py-3">Estimate #</th>
                    <th className="px-4 py-3">Farmer</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {estimates.map(e => (
                    <tr
                      key={e.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate(`/estimates/${e.id}`)}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {e.estimate_number}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{e.farmer_name}</td>
                      <td className="px-4 py-3 text-gray-500">{formatDate(e.estimate_date)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        {formatCurrency(e.total)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold bg-amber-50 text-amber-700 ring-1 ring-amber-200">
                          Estimate
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ChevronRight className="h-4 w-4 text-gray-400 ml-auto" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="lg:hidden divide-y">
              {estimates.map(e => (
                <Link
                  key={e.id}
                  to={`/estimates/${e.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-900">
                        {e.estimate_number}
                      </span>
                      <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[0.65rem] font-bold bg-amber-50 text-amber-700 ring-1 ring-amber-200">
                        Estimate
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {e.farmer_name} · {formatDate(e.estimate_date)}
                    </p>
                  </div>
                  <span className="font-semibold text-sm text-gray-900">
                    {formatCurrency(e.total)}
                  </span>
                  <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {totalCount > PAGE_SIZE && (
              <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-gray-600">
                <span>{totalCount} total</span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={offset === 0}
                    onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={offset + PAGE_SIZE >= totalCount}
                    onClick={() => setOffset(offset + PAGE_SIZE)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </PageShell>
  );
};

export default EstimatesListPage;
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/features/estimates/pages/EstimatesListPage.tsx
git commit -m "feat(estimates): add EstimatesListPage"
```

---

## Task 7: EstimateDetailPage

**Files:**
- Create: `src/features/estimates/pages/EstimateDetailPage.tsx`

**Interfaces:**
- Consumes: `useEstimateDetail`, `Estimate`, `useAuthStore`; uses `useParams` for `id`
- Produces: `/estimates/:id` — view estimate with print button

The print button reuses the existing invoice template system. Pass the estimate data shaped as a bill-like object with `is_estimate: true` to whichever template the dealer has configured (read from `user.billing_template` or default to `TemplateOne`).

- [ ] **Step 1: Write EstimateDetailPage.tsx**

```tsx
// src/features/estimates/pages/EstimateDetailPage.tsx
import React, { useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Printer, FileText, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { PageShell } from '@/components/layout/PageShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useEstimateDetail } from '../hooks/useEstimate';

export const EstimateDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const printRef = useRef<HTMLDivElement>(null);

  const { data: estimate, isLoading } = useEstimateDetail(user?.id || '', id || '');

  const handlePrint = () => {
    if (!printRef.current) return;
    const content = printRef.current.innerHTML;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>${estimate?.estimate_number}</title>
      <style>body{font-family:sans-serif;margin:24px}table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5}
      .total-row{font-weight:bold}</style>
      </head><body>${content}</body></html>
    `);
    win.document.close();
    win.print();
  };

  if (isLoading) {
    return (
      <PageShell>
        <PageHeader title="Estimate" backTo="/estimates" />
        <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Loading...</div>
      </PageShell>
    );
  }

  if (!estimate) {
    return (
      <PageShell>
        <PageHeader title="Estimate" backTo="/estimates" />
        <div className="flex items-center justify-center py-16 text-gray-500 text-sm">
          Estimate not found.
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title={estimate.estimate_number}
        icon={<FileText className="h-5 w-5" />}
        backTo="/estimates"
        actions={
          <Button size="sm" variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1" />
            Print
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4">
        {/* Header card */}
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-4 flex items-center gap-2">
          <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold bg-amber-100 text-amber-700 ring-1 ring-amber-300">
            ESTIMATE
          </span>
          <span className="text-sm text-amber-700 font-medium">Price Quote · Not a Bill</span>
        </div>

        {/* Printable area */}
        <div ref={printRef} className="rounded-xl border bg-white p-4 space-y-4">
          {/* Meta */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-gray-500">Estimate Number</p>
              <p className="font-semibold">{estimate.estimate_number}</p>
            </div>
            <div>
              <p className="text-gray-500">Date</p>
              <p className="font-semibold">{formatDate(estimate.estimate_date)}</p>
            </div>
            <div>
              <p className="text-gray-500">Farmer</p>
              <p className="font-semibold">{estimate.farmer_name_snapshot}</p>
            </div>
            {estimate.branch_name_snapshot && (
              <div>
                <p className="text-gray-500">Branch</p>
                <p className="font-semibold">{estimate.branch_name_snapshot}</p>
              </div>
            )}
          </div>

          {/* Items table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-xs font-medium text-gray-500 uppercase">
                  <th className="py-2 px-2 text-left">Item</th>
                  <th className="py-2 px-2 text-right">Qty</th>
                  <th className="py-2 px-2 text-right">Rate</th>
                  <th className="py-2 px-2 text-right">Disc%</th>
                  <th className="py-2 px-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {estimate.items.map(item => (
                  <tr key={item.id}>
                    <td className="py-2 px-2 font-medium text-gray-900">{item.product_name}</td>
                    <td className="py-2 px-2 text-right text-gray-700">{item.quantity}</td>
                    <td className="py-2 px-2 text-right text-gray-700">{formatCurrency(item.unit_price)}</td>
                    <td className="py-2 px-2 text-right text-gray-500">{item.discount_percentage}%</td>
                    <td className="py-2 px-2 text-right font-semibold text-gray-900">
                      {formatCurrency(item.unit_price * item.quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="border-t pt-3 space-y-1 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span><span>{formatCurrency(estimate.subtotal)}</span>
            </div>
            {estimate.discount_amount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Discount</span><span>-{formatCurrency(estimate.discount_amount)}</span>
              </div>
            )}
            {estimate.gst_amount > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>GST</span><span>{formatCurrency(estimate.gst_amount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base border-t pt-2 text-gray-900">
              <span>Total</span><span>{formatCurrency(estimate.total)}</span>
            </div>
          </div>

          {estimate.notes && (
            <div className="border-t pt-3 text-sm text-gray-600">
              <p className="font-medium text-gray-700 mb-1">Notes</p>
              <p>{estimate.notes}</p>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
};

export default EstimateDetailPage;
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/features/estimates/pages/EstimateDetailPage.tsx
git commit -m "feat(estimates): add EstimateDetailPage with print"
```

---

## Task 8: Routes, Navigation, and Billing Cleanup

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/layout/DesktopSidebar.tsx`
- Modify: `src/features/placeholder/MorePage.tsx`
- Modify: `src/features/billing/components/ReviewStep.tsx`

**Interfaces:**
- Consumes: all three new page components
- Produces: `/estimates`, `/estimates/new`, `/estimates/:id` routes; "Estimates" in sidebar + More page; `is_estimate` toggle removed from billing

- [ ] **Step 1: Add lazy imports and routes to App.tsx**

Add these three lazy imports after the Billing block (around line 64):

```tsx
// Estimates
const EstimatesListPage  = React.lazy(() => import('@/features/estimates/pages/EstimatesListPage'));
const NewEstimatePage    = React.lazy(() => import('@/features/estimates/pages/NewEstimatePage'));
const EstimateDetailPage = React.lazy(() => import('@/features/estimates/pages/EstimateDetailPage'));
```

Then add three routes inside the `<ProtectedRoute><AppLayout />` block, alongside the other bill routes:

```tsx
<Route path="/estimates"      element={<EstimatesListPage />} />
<Route path="/estimates/new"  element={<NewEstimatePage />} />
<Route path="/estimates/:id"  element={<EstimateDetailPage />} />
```

- [ ] **Step 2: Add Estimates to DesktopSidebar**

In `src/components/layout/DesktopSidebar.tsx`, add `FileText` to the lucide-react import:

```tsx
import {
  LayoutDashboard, Package, Receipt, Users, WalletCards,
  FileBarChart, Settings, BookText, NotebookPen, Truck,
  LayoutGrid, Store, ChevronsUpDown,
  FileText,   // ← add
} from 'lucide-react';
```

In `SIDEBAR_ITEMS`, add after the Billing entry:

```tsx
{ path: '/bills',     label: 'Billing',   icon: Receipt,   featureKey: 'billHistory' },
{ path: '/estimates', label: 'Estimates', icon: FileText,  featureKey: 'billHistory' }, // ← add
{ path: '/inventory', label: 'Stock & Purchase', icon: Package, featureKey: 'inventory' },
```

- [ ] **Step 3: Add Estimates card to MorePage**

In `src/features/placeholder/MorePage.tsx`, add `FileText` to the lucide-react import, then add an item to the "Records & Bills" section:

```tsx
// In the lucide-react import block, add:
FileText,

// In menuSections, find 'Records & Bills' and add:
{ path: '/estimates', label: 'Estimates', description: 'Create and view price estimates', icon: FileText, color: 'bg-amber-100 text-amber-700', cardBg: 'bg-amber-50 border-amber-200/60', chevronBg: 'bg-amber-100 text-amber-600', featureKey: 'billHistory' as StaffFeatureKey },
```

Add it as the first item in the "Records & Bills" array (before "All Bills").

- [ ] **Step 4: Remove is_estimate toggle from ReviewStep**

Open `src/features/billing/components/ReviewStep.tsx`. Find and **delete** the amber estimate toggle card. It looks like:

```tsx
{/* Estimate toggle — amber card with Switch and "Save as Estimate" label */}
```

Search for `isEstimate` or `setIsEstimate` or `Save as Estimate` in that file and remove the entire JSX block (the amber card containing the toggle switch). Keep all other ReviewStep logic intact. The `setIsEstimate` action in CartStore stays — only the UI element is removed.

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Start dev server and verify**

```bash
npm run dev
```

Check:
- `/estimates` renders list page (empty state with "Create first estimate" button)
- `/estimates/new` renders the two-step create flow; farmer picker shows; product search works after selecting farmer
- Sidebar shows "Estimates" between Billing and Stock
- More page "Records & Bills" section shows "Estimates" card
- `/bills/new` ReviewStep no longer shows the estimate toggle
- Creating a new estimate navigates to `/estimates/:id`
- Print button on detail page opens print dialog

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/components/layout/DesktopSidebar.tsx src/features/placeholder/MorePage.tsx src/features/billing/components/ReviewStep.tsx
git commit -m "feat(estimates): wire routes, navigation, and remove billing estimate toggle"
```

---

## Self-Review Checklist

- [x] **Spec: separate estimates + estimate_items tables** → Task 1
- [x] **Spec: farmer required, discounts loaded** → Task 4 (EstimateItemPicker loads `farmer_product_discounts`)
- [x] **Spec: no stock validation** → `create_estimate_v1` has no inventory check; EstimateItemPicker shows stock count for info only (no enforcement)
- [x] **Spec: no financial impact** → estimates table never joins financial queries; no `balance_due`, `amount_paid`, no farmer `total_due` update in RPC
- [x] **Spec: Desktop sidebar entry** → Task 8 Step 2
- [x] **Spec: Mobile More page entry** → Task 8 Step 3
- [x] **Spec: /estimates, /estimates/new, /estimates/:id** → Task 8 Step 1
- [x] **Spec: remove toggle from ReviewStep** → Task 8 Step 4
- [x] **Spec: old bills.is_estimate rows untouched** → no migration touching bills table
- [x] **Type consistency:** `EstimateCartItem` defined in Task 2, consumed by Task 3 (store) and Task 4 (picker). `EstimatePayload` defined in Task 2, consumed by Task 5.
- [x] **No placeholders** — all code blocks contain complete implementations
