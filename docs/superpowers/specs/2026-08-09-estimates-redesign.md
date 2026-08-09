# Estimates Redesign — Design Spec
**Date:** 2026-08-09
**Branch:** feat/estimate-bills

---

## Problem

The current estimate feature stores estimates as rows in the `bills` table with `is_estimate = true`. This causes two hard problems:

1. **Financial pollution.** Every aggregation, report, and dashboard query must explicitly exclude estimates. Seven migrations of exclusion filters were added, but any future feature touching `bills` must remember to filter — a permanent maintenance burden.
2. **Stock validation blocks estimates.** `create_bill_v2` checks stock availability before deciding to skip deduction. Estimating 20 units when only 2 are in stock fails at the RPC level.

A secondary UX problem: the estimate toggle is buried inside the billing review step — not a first-class feature.

---

## Decision

**Approach A — Fully separate table + separate flow.**

New `estimates` and `estimate_items` tables. New pages, new lightweight cart store, new service. Reuses only the `ProductSelector` component and existing invoice print templates. The `bills` table is completely untouched for new estimates.

---

## Constraints & Scope

- Existing `bills.is_estimate = true` rows stay in the bills table (backward compat). All 7 exclusion migrations remain active.
- No "Convert to Bill" functionality — estimates are standalone price quotes.
- Farmer is **required** on every estimate (needed to load farmer-specific item discounts).
- Walk-in / no-farmer estimates are out of scope.
- Estimates have no financial impact by design — separate table, never joins financial queries.

---

## Database

### New Tables

```sql
estimates
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
  estimate_number TEXT NOT NULL                          -- e.g. EST-0001, per-dealer sequence
  dealer_id       UUID NOT NULL REFERENCES dealers(id)
  branch_id       UUID REFERENCES branches(id)
  farmer_id       UUID NOT NULL REFERENCES farmers(id)  -- required
  farmer_name_snapshot  TEXT
  branch_name_snapshot  TEXT
  estimate_date   DATE NOT NULL DEFAULT CURRENT_DATE
  subtotal        NUMERIC NOT NULL DEFAULT 0
  gst_amount      NUMERIC NOT NULL DEFAULT 0
  discount_amount NUMERIC NOT NULL DEFAULT 0
  total           NUMERIC NOT NULL DEFAULT 0
  notes           TEXT
  status          TEXT NOT NULL DEFAULT 'active'        -- 'active' | 'cancelled'
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  deleted_at      TIMESTAMPTZ                           -- soft delete

estimate_items
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid()
  estimate_id         UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE
  product_id          UUID REFERENCES products(id)
  product_name        TEXT NOT NULL
  hsn_code            TEXT
  quantity            NUMERIC NOT NULL
  unit_price          NUMERIC NOT NULL
  discount_percentage NUMERIC NOT NULL DEFAULT 0
  gst_rate            NUMERIC NOT NULL DEFAULT 0
  total_price         NUMERIC NOT NULL
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
```

No `balance_due`, `amount_paid`, or `inventory_id_snapshot` — estimates never touch stock or money.

### New RPCs

| RPC | Purpose |
|-----|---------|
| `create_estimate_v1` | Insert estimate + items. Auto-generates `estimate_number` (per-dealer sequence). No stock check, no farmer `total_due` update, no payment record, no cash_book entry. |
| `get_estimates` | Paginated list for a dealer. Optional farmer filter, date range. Returns summary rows. |
| `get_estimate_detail` | Single estimate with full item list. |

### Migration Strategy

One new migration file: `20260809000001_estimates_table.sql`. All existing exclusion migrations (`20260808000001` through `20260808000007`) remain — needed for old `bills.is_estimate = true` rows.

---

## Frontend

### New Files

| File | Purpose |
|------|---------|
| `src/features/estimates/types.ts` | `Estimate`, `EstimateItem`, `EstimatePayload`, `EstimateListItem` |
| `src/features/estimates/services/estimateService.ts` | `createEstimate()`, `getEstimates()`, `getEstimateDetail()` |
| `src/features/estimates/hooks/useEstimate.ts` | React Query: `useCreateEstimate`, `useEstimates`, `useEstimateDetail` |
| `src/features/estimates/stores/estimateCartStore.ts` | Zustand + sessionStorage. Fields: `farmerId`, `farmerName`, `items`, `gstEnabled`, `discountAmount`, `notes`, `estimateDate`. No payment/credit/draft-tabs. |
| `src/features/estimates/pages/EstimatesListPage.tsx` | Paginated list; amber badge; farmer search; date filter. |
| `src/features/estimates/pages/NewEstimatePage.tsx` | Two-step flow (items → review). Calls `useCreateEstimate`. |
| `src/features/estimates/pages/EstimateDetailPage.tsx` | View + print. Reuses invoice templates. |

### Reused Components

- `src/features/billing/components/ProductSelector.tsx` — item picker (farmer discounts, GST, quantity)
- Existing invoice print templates (`TemplateOne`–`TemplateFive`) — already render ESTIMATE header when `is_estimate = true`; estimate detail page passes a compatible shape

### New Estimate Flow (NewEstimatePage)

```
NewEstimatePage
  Step 1 — Items
    FarmerPicker (required — loads farmer discounts)
    ProductSelector (no stock validation shown/enforced)
    ↓ estimateCartStore holds state

  Step 2 — Review
    Totals breakdown (subtotal, GST, discount, total)
    Notes field
    Estimate date picker
    NO payment section, NO signature, NO credit limit check
    "Save Estimate" button
    ↓ estimateService.createEstimate() → create_estimate_v1 RPC

  Success
    Simple success modal: estimate number + print button
```

### Navigation

**Desktop sidebar** (`src/components/layout/DesktopSidebar.tsx`):
- New "Estimates" item added to `SIDEBAR_ITEMS`, between Billing and Stock & Purchase.

**Mobile More page** (`src/features/placeholder/MorePage.tsx`):
- New card "Estimates" added to the "Records & Bills" section (alongside All Bills, Returns, Transactions).

**No changes to:**
- Bottom nav / FAB (center FAB stays as "New Bill")
- Dashboard widgets

### Routes (App.tsx)

```
/estimates          → EstimatesListPage     (lazy)
/estimates/new      → NewEstimatePage       (lazy)
/estimates/:id      → EstimateDetailPage    (lazy)
```

---

## Billing Cleanup

**Remove** the amber `is_estimate` toggle card from `ReviewStep.tsx`. Dealers can no longer create estimates through the billing flow.

**Keep** (for backward compat with old data):
- `CartStore.isEstimate` field + `setIsEstimate` action
- `BillingPayload.is_estimate` field
- `create_bill_v2` estimate handling
- `BillHistoryPage` estimate badge
- `BillDetailsPage` estimate banner
- All invoice template ESTIMATE rendering
- All 7 exclusion migrations

---

## Out of Scope

- Convert estimate to bill
- Estimate expiry / validity date
- Estimate sharing via link (farmer public page)
- Walk-in estimates (no farmer)
- Estimate edit after creation
- Offline estimate creation
