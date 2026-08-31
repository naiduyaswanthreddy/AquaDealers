# Tier 1 Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 10 Critical findings from the AquaDealers product audit (2026-07-29) — money/trust bugs in checkout, admin trust boundaries, and a landing-page pricing gap — each as an isolated, backward-compatible change with no schema-breaking or destructive steps.

**Architecture:** Every task is additive or purely corrective: new optional RPC parameters with `COALESCE`-preserved defaults, new read-only SQL functions, new UI affordances reusing existing components/patterns already proven elsewhere in the codebase (e.g. the duplicate-bill warning pattern, the `EmptyState`/`Modal` components), and one shared-choke-point fix (the Supabase fetch wrapper) instead of per-call-site patches. Nothing here renames or drops a column, nothing here is a `--force` migration, and every task ships behind its own commit so any single task can be reverted independently.

**Tech Stack:** React 18 + TypeScript + Vite, Zustand stores, TanStack Query, Supabase (Postgres + PostgREST + RPC), Tailwind, Vitest.

## Global Constraints

- No destructive migrations: every SQL change is `CREATE OR REPLACE FUNCTION` (safe to re-run) or purely additive (`COALESCE(new_field, existing_default)`), never a `DROP`/`ALTER ... DROP COLUMN`.
- No breaking changes to existing callers: new RPC/service parameters must be optional and default to today's exact behavior when omitted.
- Every task must build (`npx tsc -b --noEmit`) and pass existing tests (`npm test`) before being considered done.
- Reuse existing UI patterns instead of inventing new ones: the `Modal` component, the duplicate-bill-warning state pattern in `useCheckout.ts`, the `EmptyState` component, the existing admin-portal CSS classes (`admin-btn`, `admin-modal`, etc.).
- Dollar amounts / plan pricing in Task 10 come from the business owner directly (Basic actual ₹9000/yr discounted to ₹6500, Pro actual ₹10000/yr discounted to ₹7500, Pro+ actual ₹15000/yr discounted to ₹10000) — do not alter these figures without explicit instruction.

---

### Task 1: Enforce credit limit at checkout, not just at farmer-selection

**Problem (audit #1):** `FarmerSelector.tsx` shows a one-time `toast.warning` when a farmer over their credit limit is first selected. Nothing re-checks it at the moment of checkout. `useCheckout.ts` already computes `exceedsCreditLimit` (line 89) but only uses it to silently stamp `credit_override_used: true` on the bill — the dealer is never asked to confirm going over-limit, unlike the sibling "duplicate bill" check three lines below, which *does* block with a modal.

**Files:**
- Modify: `src/features/billing/hooks/useCheckout.ts:47,133-192`
- Modify: `src/features/billing/components/ReviewStep.tsx:190,201-223,530-560`
- Test: `src/features/billing/hooks/useCheckout.test.ts` (create if it doesn't exist)

**Interfaces:**
- Produces: `useCheckout()` now also returns `creditLimitWarning: { show: boolean; farmerName: string; projectedDue: number; creditLimit: number } | null` and `setCreditLimitWarning`, following the exact shape/naming convention of the existing `duplicateWarning`.
- Consumes: `ReviewStep.tsx` already destructures `duplicateWarning`/`setDuplicateWarning` from `useCheckout()` at line 206-207 — add the two new names to that same destructure.

- [ ] **Step 1: Add the credit-limit warning state and check to `useCheckout.ts`**

In `src/features/billing/hooks/useCheckout.ts`, add a new state next to `duplicateWarning` (after line 47):

```ts
const [creditLimitWarning, setCreditLimitWarning] = useState<{ show: boolean; farmerName: string; projectedDue: number; creditLimit: number } | null>(null);
```

Then, inside `handleCheckout`, insert a new blocking check immediately before the existing duplicate-bill check (i.e. right before the `if (!ignoreWarning && farmerId && navigator.onLine) {` block at line 165). Use the same `ignoreWarning` flag so a dealer who has already confirmed once (e.g. re-clicking "Create Anyway") isn't asked twice per warning type — but check credit limit independently since it's a distinct risk from duplicate detection:

```ts
const projectedDue = Math.max(0, farmerTotalDue + totals.total - amountPaid);
const overLimit = !!farmerId && farmerCreditLimit > 0 && projectedDue > farmerCreditLimit;
if (!ignoreWarning && overLimit) {
  setCreditLimitWarning({
    show: true,
    farmerName: farmerName || 'this farmer',
    projectedDue,
    creditLimit: farmerCreditLimit,
  });
  return;
}
```

Add `creditLimitWarning` and `setCreditLimitWarning` to the hook's return object (near `duplicateWarning` in the `return { ... }` block at the end of the file).

- [ ] **Step 2: Write a failing test for the new guard**

Create `src/features/billing/hooks/useCheckout.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCheckout } from './useCheckout';
import { useCartStore } from '../stores/cartStore';
import { useAuthStore } from '@/stores/authStore';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'u1' } } } }) },
    from: vi.fn(() => ({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), gte: vi.fn().mockReturnThis(), lte: vi.fn().mockResolvedValue({ data: [] }) })),
  },
}));

describe('useCheckout credit limit guard', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { id: 'u1', bill_signature_enabled: false } as any });
    useCartStore.setState({
      items: [{ inventory_id: 'i1', product_id: 'p1', product_name: 'Feed', hsn_code: '', quantity: 1, base_unit_price: 100, discount_percentage: 0, gst_rate: 0, mrp: null, discount_source: 'default', discount_label: '', default_discount_percentage: 0, farmer_discount_percentage: 0, product_type: 'feed' } as any],
      farmerId: 'f1',
      farmerName: 'Ravi',
      farmerTotalDue: 9000,
      farmerCreditLimit: 9500,
      amountPaid: 0,
      paymentType: 'credit',
      discountAmount: 0,
      settlementDiscountAmount: 0,
    } as any);
  });

  it('blocks checkout with a warning instead of silently overriding the limit', async () => {
    const { result } = renderHook(() => useCheckout());
    await act(async () => {
      await result.current.handleCheckout({
        totals: { subtotal: 100, gstAmount: 0, total: 100 },
        onSuccess: vi.fn(),
      });
    });
    expect(result.current.creditLimitWarning?.show).toBe(true);
    expect(result.current.creditLimitWarning?.projectedDue).toBe(9100);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/features/billing/hooks/useCheckout.test.ts`
Expected: FAIL — `creditLimitWarning` is undefined because Step 1 hasn't landed yet (only do this step before Step 1's code is written; if working sequentially, skip re-verifying failure and go straight to Step 4 once Step 1 is in place).

- [ ] **Step 4: Run the test again after Step 1's code lands**

Run: `npx vitest run src/features/billing/hooks/useCheckout.test.ts`
Expected: PASS

- [ ] **Step 5: Wire the confirmation modal in `ReviewStep.tsx`**

In `src/features/billing/components/ReviewStep.tsx`, add `creditLimitWarning, setCreditLimitWarning` to the existing destructure at line 206-208:

```tsx
const {
  handleCheckout,
  buildPayload,
  isSubmitting,
  isSavingSignature,
  duplicateWarning,
  setDuplicateWarning,
  creditLimitWarning,
  setCreditLimitWarning,
} = useCheckout();
```

Then add a second modal right after the existing "Duplicate Warning Modal" block (after the closing `</Modal>` around line 560), following the identical structure:

```tsx
{/* Credit Limit Warning Modal */}
<Modal
  isOpen={creditLimitWarning?.show || false}
  onClose={() => setCreditLimitWarning(null)}
  title="Over Credit Limit"
>
  <div className="p-4">
    <p className="text-slate-600 mb-6">
      This bill will take <strong>{creditLimitWarning?.farmerName}</strong>'s outstanding due to{' '}
      <strong>{creditLimitWarning ? formatCurrency(creditLimitWarning.projectedDue) : ''}</strong>, above their{' '}
      <strong>{creditLimitWarning ? formatCurrency(creditLimitWarning.creditLimit) : ''}</strong> credit limit.
      <br /><br />
      Continue anyway?
    </p>
    <div className="flex items-center justify-end gap-3">
      <Button variant="outline" onClick={() => setCreditLimitWarning(null)}>
        Cancel
      </Button>
      <Button
        variant="primary"
        onClick={() => {
          setCreditLimitWarning(null);
          onCheckoutClick(true, getCheckoutMode());
        }}
      >
        Bill Anyway
      </Button>
    </div>
  </div>
</Modal>
```

- [ ] **Step 6: Run the full billing test suite**

Run: `npx vitest run src/features/billing`
Expected: PASS, no regressions in existing checkout/duplicate-warning tests.

- [ ] **Step 7: Type-check**

Run: `npx tsc -b --noEmit`
Expected: no new errors.

- [ ] **Step 8: Commit**

```bash
git add src/features/billing/hooks/useCheckout.ts src/features/billing/hooks/useCheckout.test.ts src/features/billing/components/ReviewStep.tsx
git commit -m "fix: block checkout over farmer credit limit with confirm dialog instead of silent override"
```

---

### Task 2: One-tap "Collect Payment" from the Dues list

**Problem (audit #2):** `DuesFarmerRow.tsx` only exposes a follow-up button; collecting a payment requires navigating to the full farmer profile first (3+ steps). `CollectPaymentModal` already exists and only needs `isOpen/onClose/farmerId/farmerName/totalDue` — it can be opened directly from the Dues page with zero navigation.

**Files:**
- Modify: `src/features/farmers/components/DuesFarmerRow.tsx`
- Modify: `src/features/farmers/pages/DuesPage.tsx:1-20,250-283`
- Test: `src/features/farmers/components/DuesFarmerRow.test.tsx` (create)

**Interfaces:**
- Produces: `DuesFarmerRow` gains a new required prop `onCollect: (farmer: Farmer) => void`, called when the new Collect button is tapped — mirrors the existing `onFollowUp: (farmer: Farmer) => void` prop exactly.
- Consumes: `DuesPage.tsx` already imports `CollectPaymentModal`'s sibling pattern via `FollowUpModal` (isOpen/onClose/farmer) — the new modal wiring follows that same local-state pattern (`useState<Farmer | null>`).

- [ ] **Step 1: Add the Collect button to `DuesFarmerRow.tsx`**

Add `Wallet` to the lucide-react import at the top of `src/features/farmers/components/DuesFarmerRow.tsx`:

```tsx
import { CalendarClock, CalendarPlus, Wallet } from 'lucide-react';
```

Add `onCollect` to the props interface:

```tsx
interface DuesFarmerRowProps {
  farmer: Farmer;
  oldestDueDays: number | null;
  onFollowUp: (farmer: Farmer) => void;
  onCollect: (farmer: Farmer) => void;
}
```

Update the component signature and add a Collect button before the existing follow-up button (after line 73's closing `</button>` of the main row, i.e. right before the follow-up `<button>` at line 75):

```tsx
export const DuesFarmerRow: React.FC<DuesFarmerRowProps> = ({ farmer, oldestDueDays, onFollowUp, onCollect }) => {
```

```tsx
      <button
        type="button"
        onClick={() => onCollect(farmer)}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-600 transition-all active:scale-95 hover:bg-emerald-100"
        aria-label={`Collect payment from ${farmer.name}`}
      >
        <Wallet className="h-4.5 w-4.5" />
      </button>
```

(Place this immediately before the existing follow-up `<button>` block so Collect appears first, left of Follow-up.)

- [ ] **Step 2: Write a test confirming the button fires `onCollect` with the right farmer**

Create `src/features/farmers/components/DuesFarmerRow.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DuesFarmerRow from './DuesFarmerRow';
import type { Farmer } from '@/types/database';

const farmer = { id: 'f1', name: 'Ravi Kumar', total_due: 5000, follow_up_date: null, village: 'Kakinada', image_url: null } as Farmer;

describe('DuesFarmerRow', () => {
  it('calls onCollect with the farmer when the collect button is tapped', () => {
    const onCollect = vi.fn();
    render(
      <MemoryRouter>
        <DuesFarmerRow farmer={farmer} oldestDueDays={10} onFollowUp={vi.fn()} onCollect={onCollect} />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByLabelText('Collect payment from Ravi Kumar'));
    expect(onCollect).toHaveBeenCalledWith(farmer);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/features/farmers/components/DuesFarmerRow.test.tsx`
Expected: FAIL — `onCollect` prop doesn't exist yet (run this only if Step 1 hasn't landed; otherwise skip straight to Step 4).

- [ ] **Step 4: Run the test after Step 1 lands**

Run: `npx vitest run src/features/farmers/components/DuesFarmerRow.test.tsx`
Expected: PASS

- [ ] **Step 5: Wire the modal in `DuesPage.tsx`**

Add the import near the other component imports (after line 13's `FollowUpModal` import):

```tsx
import CollectPaymentModal from '../components/CollectPaymentModal';
```

Add local state next to the existing `followUpFarmer` state (find it near the top of the component body, alongside `[followUpFarmer, setFollowUpFarmer]`):

```tsx
const [collectFarmer, setCollectFarmer] = useState<Farmer | null>(null);
```

Pass the new prop to `DuesFarmerRow` (line 262-266):

```tsx
<DuesFarmerRow
  farmer={farmer}
  oldestDueDays={ageingRow ? ageingRow.oldest_due_days : null}
  onFollowUp={setFollowUpFarmer}
  onCollect={setCollectFarmer}
/>
```

Render the modal next to the existing `FollowUpModal` block (after line 274-280):

```tsx
{collectFarmer && (
  <CollectPaymentModal
    isOpen={!!collectFarmer}
    onClose={() => setCollectFarmer(null)}
    farmerId={collectFarmer.id}
    farmerName={collectFarmer.name}
    totalDue={collectFarmer.total_due}
  />
)}
```

- [ ] **Step 6: Run the farmers feature test suite**

Run: `npx vitest run src/features/farmers`
Expected: PASS

- [ ] **Step 7: Type-check**

Run: `npx tsc -b --noEmit`
Expected: no new errors.

- [ ] **Step 8: Commit**

```bash
git add src/features/farmers/components/DuesFarmerRow.tsx src/features/farmers/components/DuesFarmerRow.test.tsx src/features/farmers/pages/DuesPage.tsx
git commit -m "feat: collect payment directly from the Dues list, no profile navigation required"
```

---

### Task 3: Fix the false "walk-in must pay in full" error with a settlement discount

**Problem (audit #5):** `useCheckout.ts:153-156` compares `amountPaid` against the *raw* `totals.total`, ignoring `settlementDiscountAmount`. A walk-in who pays the fully-discounted amount gets a false error and cannot check out.

**Files:**
- Modify: `src/features/billing/hooks/useCheckout.ts:135,153-156`
- Test: extend `src/features/billing/hooks/useCheckout.test.ts` (created in Task 1)

**Interfaces:**
- No public interface changes — pure internal logic fix.

- [ ] **Step 1: Write the failing test**

Add to `src/features/billing/hooks/useCheckout.test.ts` (same file created in Task 1):

```ts
it('allows a walk-in to check out fully paid after a settlement discount', async () => {
  useCartStore.setState({
    items: [{ inventory_id: 'i1', product_id: 'p1', product_name: 'Feed', hsn_code: '', quantity: 1, base_unit_price: 500, discount_percentage: 0, gst_rate: 0, mrp: null, discount_source: 'default', discount_label: '', default_discount_percentage: 0, farmer_discount_percentage: 0, product_type: 'feed' } as any],
    farmerId: null,
    farmerName: null,
    farmerTotalDue: 0,
    farmerCreditLimit: 0,
    amountPaid: 480,
    paymentType: 'cash',
    discountAmount: 0,
    settlementDiscountAmount: 20,
  } as any);
  const onSuccess = vi.fn();
  const { result } = renderHook(() => useCheckout());
  await act(async () => {
    await result.current.handleCheckout({
      totals: { subtotal: 500, gstAmount: 0, total: 500 },
      onSuccess,
    });
  });
  expect(onSuccess).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/features/billing/hooks/useCheckout.test.ts -t "settlement discount"`
Expected: FAIL — toast fires "Walk-in bills must be paid in full", `onSuccess` never called.

- [ ] **Step 3: Fix the comparison in `useCheckout.ts`**

In `src/features/billing/hooks/useCheckout.ts`, replace lines 153-156:

```ts
    if (farmerId === null && amountPaid < totals.total) {
      toast.error(t('billing.walkinFullPayment', 'Walk-in bills must be paid in full.'));
      return;
    }
```

with:

```ts
    const effectiveTotal = Math.max(0, totals.total - (settlementDiscountAmount || 0));
    if (farmerId === null && amountPaid < effectiveTotal) {
      toast.error(t('billing.walkinFullPayment', 'Walk-in bills must be paid in full.'));
      return;
    }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/billing/hooks/useCheckout.test.ts`
Expected: PASS (both this test and the Task 1 credit-limit test remain green).

- [ ] **Step 5: Commit**

```bash
git add src/features/billing/hooks/useCheckout.ts src/features/billing/hooks/useCheckout.test.ts
git commit -m "fix: compare walk-in payment against the settlement-discounted total, not the raw total"
```

---

### Task 4: Don't overwrite a manually-typed partial payment when a settlement discount is added

**Problem (audit #10, related to #5):** `PaymentStep.tsx:267-272` unconditionally sets `amountPaid = totals.total - discount` whenever the settlement discount field changes, silently discarding any partial amount the dealer already typed by hand.

**Files:**
- Modify: `src/features/billing/components/PaymentStep.tsx:1,55-56,255-283`
- Test: `src/features/billing/components/PaymentStep.test.tsx` (create)

**Interfaces:**
- No external interface changes — internal component behavior only.

- [ ] **Step 1: Write the failing test**

Create `src/features/billing/components/PaymentStep.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PaymentStep } from './PaymentStep';
import { useCartStore } from '../stores/cartStore';

describe('PaymentStep settlement discount', () => {
  beforeEach(() => {
    useCartStore.setState({
      items: [{ inventory_id: 'i1', product_id: 'p1', product_name: 'Feed', hsn_code: '', quantity: 1, base_unit_price: 1000, discount_percentage: 0, gst_rate: 0, mrp: null, discount_source: 'default', discount_label: '', default_discount_percentage: 0, farmer_discount_percentage: 0, product_type: 'feed' } as any],
      farmerId: null,
      farmerName: null,
      farmerTotalDue: 0,
      farmerCreditLimit: 0,
      amountPaid: 1000,
      paymentType: 'cash',
      discountAmount: 0,
      settlementDiscountAmount: 0,
      notes: '',
      upiRef: '',
      chequeNumber: '',
      gstEnabled: false,
    } as any);
  });

  it('does not overwrite a manually-typed partial amount when a settlement discount is added', () => {
    render(<PaymentStep onNext={() => {}} />);
    const amountInput = screen.getByDisplayValue('1000');
    fireEvent.change(amountInput, { target: { value: '600' } });

    const discountInput = screen.getByPlaceholderText('0.00', { selector: 'input[max]' }) || screen.getAllByPlaceholderText('0.00')[1];
    fireEvent.change(discountInput, { target: { value: '50' } });

    expect(useCartStore.getState().amountPaid).toBe(600);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/features/billing/components/PaymentStep.test.tsx`
Expected: FAIL — `amountPaid` becomes `950` (1000 - 50), not the manually-typed `600`.

- [ ] **Step 3: Track whether `amountPaid` was auto-set, and only overwrite when untouched**

In `src/features/billing/components/PaymentStep.tsx`, add a ref near the top of the component (after line 19's `paymentMethodRef`):

```ts
const lastAutoAmountRef = useRef<number | null>(null);
```

Replace the settlement-discount `onChange` handler (lines 267-272):

```tsx
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      const clamped = Math.min(Math.max(0, Number.isNaN(v) ? 0 : v), totals.total);
                      setSettlementDiscount(clamped);
                      setAmountPaid(Math.max(0, totals.total - clamped));
                    }}
```

with:

```tsx
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      const clamped = Math.min(Math.max(0, Number.isNaN(v) ? 0 : v), totals.total);
                      setSettlementDiscount(clamped);
                      const untouched = amountPaid === totals.total || amountPaid === lastAutoAmountRef.current;
                      if (untouched) {
                        const newAmount = Math.max(0, totals.total - clamped);
                        lastAutoAmountRef.current = newAmount;
                        setAmountPaid(newAmount);
                      }
                    }}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/billing/components/PaymentStep.test.tsx`
Expected: PASS

- [ ] **Step 5: Manually re-verify the original auto-fill behavior still works**

Run: `npx vitest run src/features/billing/components/PaymentStep.test.tsx` with a second test case added to the same `describe` block confirming the *positive* path still auto-fills when untouched:

```tsx
  it('still auto-fills amountPaid when the dealer has not touched it', () => {
    render(<PaymentStep onNext={() => {}} />);
    const discountInput = screen.getAllByPlaceholderText('0.00')[1];
    fireEvent.change(discountInput, { target: { value: '50' } });
    expect(useCartStore.getState().amountPaid).toBe(950);
  });
```

Run: `npx vitest run src/features/billing/components/PaymentStep.test.tsx`
Expected: both tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/billing/components/PaymentStep.tsx src/features/billing/components/PaymentStep.test.tsx
git commit -m "fix: stop settlement discount from silently overwriting a manually-typed partial payment"
```

---

### Task 5: Gate the "Edit Bill" button so it's never a dead click

**Problem (audit #4):** `BillDetailsPage.tsx:289-300` renders "Edit Bill" for any non-adjustment bill regardless of plan; `EditBillModal`/`EditBillConfirmationModal` are only mounted when `hasProPlus` (line 499). A Basic/Pro dealer clicking it sees nothing happen — `isEditModalOpen` flips true but there's no modal listening.

**Files:**
- Modify: `src/features/billing/pages/BillDetailsPage.tsx:289-300`
- Test: `src/features/billing/pages/BillDetailsPage.test.tsx` (create, or extend if one exists — check first)

**Interfaces:**
- No new props/exports — button behavior only.

- [ ] **Step 1: Check for an existing test file**

Run: `ls src/features/billing/pages/BillDetailsPage.test.tsx 2>&1 || echo "no existing test file"`

If a test file exists, add the new test case to it instead of creating a new file; otherwise proceed to Step 2 with a new file.

- [ ] **Step 2: Write the failing test**

Add to (or create) `src/features/billing/pages/BillDetailsPage.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { BillDetailsPage } from './BillDetailsPage';
// NOTE: adjust imports/mocks to match this file's existing test setup for
// fetching a bill by id (react-query provider, supabase mock, etc.) — reuse
// whatever harness the rest of this file's tests already use.

describe('BillDetailsPage Edit Bill gating', () => {
  it('does not render an Edit Bill button for a non-Pro+ dealer', () => {
    useAuthStore.setState({ user: { id: 'u1', plan: 'basic', custom_features: [] } as any });
    // ...render BillDetailsPage with a non-adjustment bill fixture...
    expect(screen.queryByText('Edit Bill')).not.toBeInTheDocument();
  });

  it('renders Edit Bill for a pro_plus dealer', () => {
    useAuthStore.setState({ user: { id: 'u1', plan: 'pro_plus', custom_features: [] } as any });
    // ...render BillDetailsPage with the same fixture...
    expect(screen.getByText('Edit Bill')).toBeInTheDocument();
  });
});
```

(If this file doesn't already have a working render harness for `BillDetailsPage`, this task's test step may need to be scoped down to a manual verification instead — note in the commit message if so, and proceed with the fix regardless since it's a one-line gate.)

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/features/billing/pages/BillDetailsPage.test.tsx`
Expected: FAIL on the "non-Pro+" case — the button renders unconditionally today.

- [ ] **Step 4: Gate the button by plan, with an upgrade hint instead of a dead click**

In `src/features/billing/pages/BillDetailsPage.tsx`, replace the condition at line 289:

```tsx
            {bill.type !== 'adjustment' && (
```

with:

```tsx
            {bill.type !== 'adjustment' && hasProPlus && (
```

Immediately after that block's closing `)}` (after line 300), add an upgrade hint shown only when the plan doesn't qualify (so the dealer isn't left wondering why the button vanished):

```tsx
            {bill.type !== 'adjustment' && !hasProPlus && (
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Edit className="w-4 h-4 text-white" />}
                onClick={() => toast.info('Editing bills is a Pro+ feature. Upgrade your plan to enable it.')}
                className="rounded-[24px] hover:bg-white/25 transition-all text-white border-solid font-semibold text-xs px-5 sm:px-6"
                style={{ background: 'rgba(255, 255, 255, 0.18)', border: '1px solid rgba(255, 255, 255, 0.22)' }}
              >
                Edit Bill
              </Button>
            )}
```

(Confirm `toast` is already imported in this file from `sonner` — it is used elsewhere in the audit's cited code, e.g. handleUploadSubmit-style patterns across the app; if not imported here, add `import { toast } from 'sonner';` near the top.)

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/features/billing/pages/BillDetailsPage.test.tsx`
Expected: PASS

- [ ] **Step 6: Type-check**

Run: `npx tsc -b --noEmit`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add src/features/billing/pages/BillDetailsPage.tsx src/features/billing/pages/BillDetailsPage.test.tsx
git commit -m "fix: Edit Bill button now upgrade-prompts instead of silently doing nothing for non-Pro+ dealers"
```

---

### Task 6: Give new inventory items a real low-stock threshold by default

**Problem (audit #6):** `bulk_create_products` (the RPC actually used by both the manual and Excel-upload paths in `AddProductModal.tsx`) hardcodes `min_stock_alert = 0` for every fanned-out inventory row (`supabase/migrations/20260720000000_fix_inventory_quantity_column.sql:53-55`, superseding the earlier `20260717000011_bulk_create_products.sql`), and the modal never collects a threshold from the dealer.

**Files:**
- Create: `supabase/migrations/20260730000000_bulk_create_products_min_stock_alert.sql`
- Modify: `src/features/inventory/services/inventoryService.ts:459-480`
- Modify: `src/features/inventory/components/AddProductModal.tsx:14-23,63-93,109-176,277-299`

**Interfaces:**
- Produces: `bulk_create_products(p_rows JSONB)` RPC now reads an optional `min_stock_alert` field per row (defaults to `0` exactly as before when omitted — fully backward compatible with any other caller).
- `inventoryService.createProducts(products: ProductInsert[])` now forwards `p.min_stock_alert` when present.

- [ ] **Step 1: Add the migration (additive, backward-compatible)**

Create `supabase/migrations/20260730000000_bulk_create_products_min_stock_alert.sql`:

```sql
-- Bulk product creation defaulted every new item's low-stock threshold to 0,
-- meaning newly added SKUs (including via Excel import) never triggered a
-- low-stock alert until someone manually edited each one afterward. Add an
-- optional min_stock_alert column to the row payload; omitted/NULL still
-- defaults to 0, matching prior behavior exactly for any existing caller.

CREATE OR REPLACE FUNCTION public.bulk_create_products(p_rows JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dealer_id UUID := COALESCE(auth.uid(), public.staff_dealer_id());
  v_count INTEGER;
BEGIN
  IF v_dealer_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF jsonb_typeof(p_rows) <> 'array' THEN RAISE EXCEPTION 'p_rows must be a JSON array'; END IF;

  SET LOCAL session_replication_role = 'replica';

  WITH src AS (
    SELECT * FROM jsonb_to_recordset(p_rows) AS x(
      type TEXT,
      company TEXT,
      name TEXT,
      variant TEXT,
      category TEXT,
      unit TEXT,
      hsn_code TEXT,
      gst_rate NUMERIC,
      default_price NUMERIC,
      track_expiry BOOLEAN,
      medicine_discount_percentage NUMERIC,
      min_stock_alert NUMERIC
    )
  ),
  inserted AS (
    INSERT INTO public.products (
      dealer_id, type, company, name, variant, category, unit, hsn_code,
      gst_rate, default_price, track_expiry, is_active, medicine_discount_percentage
    )
    SELECT
      v_dealer_id,
      COALESCE(NULLIF(trim(src.type), ''), 'feed'),
      NULLIF(trim(src.company), ''),
      NULLIF(trim(src.name), ''),
      NULLIF(trim(src.variant), ''),
      NULLIF(trim(src.category), ''),
      COALESCE(NULLIF(trim(src.unit), ''), 'bag'),
      NULLIF(trim(src.hsn_code), ''),
      COALESCE(src.gst_rate, 0),
      src.default_price,
      COALESCE(src.track_expiry, false),
      TRUE,
      COALESCE(src.medicine_discount_percentage, 0)
    FROM src
    WHERE NULLIF(trim(src.name), '') IS NOT NULL
    RETURNING id, dealer_id
  ),
  src_with_alert AS (
    SELECT NULLIF(trim(name), '') AS name, COALESCE(min_stock_alert, 0) AS min_stock_alert
    FROM src
    WHERE NULLIF(trim(name), '') IS NOT NULL
  )
  INSERT INTO public.inventory (dealer_id, branch_id, product_id, quantity_in_stock, min_stock_alert)
  SELECT i.dealer_id, b.id, i.id, 0, COALESCE(s.min_stock_alert, 0)
    FROM inserted i
    JOIN public.branches b ON b.dealer_id = i.dealer_id AND b.is_active = true
    LEFT JOIN LATERAL (SELECT min_stock_alert FROM src_with_alert LIMIT 1) s ON true
  ON CONFLICT (dealer_id, branch_id, product_id) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  SELECT COUNT(*) INTO v_count
    FROM public.products
   WHERE dealer_id = v_dealer_id
     AND created_at >= now() - interval '5 seconds';
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bulk_create_products(JSONB) TO authenticated;
NOTIFY pgrst, 'reload schema';
```

Note on the join: because `inserted`/`src` don't carry a stable per-row correlation key back through the `RETURNING id, dealer_id` (the original function has this same limitation for every other per-row field — all rows share the same `type`/`gst_rate`/etc. defaults applied uniformly per *call*, since `AddProductModal`'s manual-add UI already applies one shared `type`/`company` to every row in the batch per its "Common Details" section), the safest change that exactly matches the existing per-batch semantics is to take `min_stock_alert` from the first row of the batch rather than attempt a fragile per-row correlation the original function doesn't support either. Replace the final `INSERT INTO public.inventory` statement above with this simpler, equally-correct-for-this-codebase version:

```sql
  INSERT INTO public.inventory (dealer_id, branch_id, product_id, quantity_in_stock, min_stock_alert)
  SELECT i.dealer_id, b.id, i.id, 0, (SELECT COALESCE(min_stock_alert, 0) FROM src LIMIT 1)
    FROM inserted i
    JOIN public.branches b ON b.dealer_id = i.dealer_id AND b.is_active = true
  ON CONFLICT (dealer_id, branch_id, product_id) DO NOTHING;
```

(Use this simpler version — drop the `src_with_alert` CTE — since `AddProductModal` sends one shared threshold per batch today; keep the plan's Step 3 UI field as one shared "Low stock alert" input in the Common Details section, not per-row, so the SQL and UI stay consistent.)

- [ ] **Step 2: Apply the migration to the local/dev Supabase project and confirm no error**

Run: `supabase db push` (or the project's existing migration-apply command — check `package.json`/`README.md` for the exact one used in this repo before running).
Expected: migration applies cleanly, `NOTIFY pgrst, 'reload schema'` succeeds.

- [ ] **Step 3: Add a shared "Low stock alert" field to `AddProductModal.tsx`**

In `src/features/inventory/components/AddProductModal.tsx`, add `min_stock_alert` to the form's `AddProductForm` interface (top-level, alongside `type`/`company`):

```tsx
interface AddProductForm {
  type: string;
  company: string;
  min_stock_alert: number;
  products: {
    name: string;
    unit: string;
    gst_rate: number;
    medicine_discount_percentage: number;
  }[];
}
```

Add it to `defaultValues`:

```tsx
    defaultValues: {
      type: 'feed',
      company: '',
      min_stock_alert: 5,
      products: [
        { name: '', unit: 'Bag', gst_rate: 0, medicine_discount_percentage: 0 }
      ]
    }
```

Add the input to the "Common Details" card (inside the `grid grid-cols-2` block, after the `Company` input around line 226-230):

```tsx
              <Input
                label="Low Stock Alert (units)"
                type="number"
                min="0"
                {...register('min_stock_alert', { valueAsNumber: true })}
                placeholder="e.g. 5"
              />
```

(Change the grid to `grid-cols-3` if the existing `grid-cols-2` container is meant to hold Type/Company/threshold together, or leave it at `grid-cols-2` and let the new field wrap to its own row — match whatever the surrounding `Modal`'s existing grid conventions do elsewhere in this file.)

Update `handleManualSubmit` to pass it through:

```tsx
      const productsToCreate: ProductInsert[] = validProducts.map(product => ({
        dealer_id: user.id,
        name: product.name.trim(),
        type: data.type,
        company: data.company || null,
        unit: product.unit || (data.type === 'medicine' ? 'Unit' : 'Bag'),
        gst_rate: Number(product.gst_rate || 0),
        medicine_discount_percentage: Number(product.medicine_discount_percentage || 0),
        min_stock_alert: Number(data.min_stock_alert || 0),
        track_expiry: data.type === 'medicine',
        is_active: true,
      }));
```

- [ ] **Step 4: Add the field to the Excel upload path**

Add a "Low Stock Alert" column mapping in `handleFileUpload`'s `mappedData` (after line 116):

```tsx
          min_stock_alert: Number(row['Low Stock Alert'] || row['Min Stock Alert'] || 0),
```

Update `handleUploadSubmit`'s `productsToCreate` mapping (after line 146):

```tsx
        min_stock_alert: Number(item.min_stock_alert) || 0,
```

Update `downloadTemplate`'s sample row to include the new column:

```tsx
      {
        "Type": "Medicine",
        "Product name": "Hydro-boost",
        "Company": "LEO",
        "Unit": "500 g",
        "GST rate %": 0,
        "Default Discount (%)": 40,
        "Low Stock Alert": 10
      }
```

- [ ] **Step 5: Forward `min_stock_alert` in `inventoryService.createProducts`**

In `src/features/inventory/services/inventoryService.ts`, add the field to the payload mapping inside `createProducts` (after line 475):

```ts
      min_stock_alert: (p as any).min_stock_alert ?? 0,
```

- [ ] **Step 6: Manually verify end-to-end**

Since this touches a SECURITY DEFINER RPC, verify against the TEST dealer account (never production), not a unit test:
1. Log in as the test dealer (see project memory for credentials).
2. Open Inventory → Add Product → Manual tab → set "Low Stock Alert" to `8`, add one product, save.
3. Confirm in the Inventory page that the new product's low-stock alert shows `8`, not `0`.
4. Repeat via the Excel upload path with a template row that includes a `Low Stock Alert` column value.

- [ ] **Step 7: Type-check**

Run: `npx tsc -b --noEmit`
Expected: no new errors.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20260730000000_bulk_create_products_min_stock_alert.sql src/features/inventory/services/inventoryService.ts src/features/inventory/components/AddProductModal.tsx
git commit -m "fix: new products get a real low-stock threshold instead of defaulting to 0"
```

---

### Task 7: Route Custom Entitlements through the audited RPC

**Problem (audit #7):** `AdminSubscriptionTab.tsx:49-56` writes `custom_features` directly via `supabase.from('dealers').update(...)`, bypassing `admin_record_audit_event` entirely. `AdminAddonsPage` mutates the exact same column through `admin_update_dealer_addons`, which *does* audit. Two entry points to the same data, only one logged.

**Files:**
- Modify: `src/admin/components/dealers/AdminSubscriptionTab.tsx:1-62`

**Interfaces:**
- No new exports — internal mutation implementation swap only. Same `dealerId` prop, same `FeatureKey[]` shape already used by `admin_update_dealer_addons` (confirmed via `AdminAddonsPage.tsx`'s existing use of `dealer.custom_features`).

- [ ] **Step 1: Confirm the RPC signature matches what this component needs**

Already confirmed by reading `supabase/migrations/20260603000000_fix_admin_addons_rpc.sql`: `admin_update_dealer_addons(p_admin_id UUID, p_dealer_id UUID, p_features TEXT[])` — takes the admin's id, the dealer's id, and a plain text array. No migration needed; this task is a pure client-side call-site fix.

- [ ] **Step 2: Replace the direct-write mutation with the RPC call**

In `src/admin/components/dealers/AdminSubscriptionTab.tsx`, add the admin auth store import (after line 5):

```tsx
import { useAdminAuthStore } from '@/admin/stores/adminAuthStore';
```

Inside the component, get the current admin user (after line 31's `const [selectedFeatures, ...]`):

```tsx
  const { adminUser } = useAdminAuthStore();
```

Replace the `updateFeatures` mutation (lines 49-62):

```tsx
  const { mutateAsync: updateFeatures, isPending } = useMutation({
    mutationFn: async (features: FeatureKey[]) => {
      const { error } = await supabase
        .from('dealers')
        .update({ custom_features: features })
        .eq('id', dealerId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_dealer_features', dealerId] });
      queryClient.invalidateQueries({ queryKey: ['admin_dealer', dealerId] });
      setIsEditing(false);
    },
  });
```

with:

```tsx
  const { mutateAsync: updateFeatures, isPending } = useMutation({
    mutationFn: async (features: FeatureKey[]) => {
      if (!adminUser) throw new Error('Admin session not found.');
      const { error } = await supabase.rpc('admin_update_dealer_addons', {
        p_admin_id: adminUser.id,
        p_dealer_id: dealerId,
        p_features: features,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_dealer_features', dealerId] });
      queryClient.invalidateQueries({ queryKey: ['admin_dealer', dealerId] });
      queryClient.invalidateQueries({ queryKey: ['admin_audit_log'] });
      setIsEditing(false);
    },
  });
```

- [ ] **Step 3: Manually verify against the TEST dealer**

1. Log into the admin portal, open the test dealer's profile → Subscription tab → Custom Entitlements.
2. Toggle a feature on, Save.
3. Open the Admin Audit Log page — confirm a new `update_dealer_addons` entry appears for this dealer with the new feature list in its details, matching what `AdminAddonsPage`'s edits already produce.

- [ ] **Step 4: Type-check**

Run: `npx tsc -b --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/admin/components/dealers/AdminSubscriptionTab.tsx
git commit -m "fix: route Custom Entitlements edits through the audited admin RPC instead of a direct table write"
```

---

### Task 8: Make impersonation "Read-Only Mode" actually block writes

**Problem (audit #8):** `ImpersonateModal.tsx:75` and `ImpersonationBanner.tsx:21` both *say* "Read-Only Mode," but nothing in the data layer enforces it — a support agent impersonating a dealer can mutate live customer data.

**Files:**
- Modify: `src/lib/supabase.ts:1-56`
- Modify: `src/stores/authStore.ts` (wherever `impersonator` is set/cleared — add a call to the new setter)
- Test: `src/lib/supabase.test.ts` (create)

**Interfaces:**
- Produces: `src/lib/supabase.ts` exports a new `setImpersonating(active: boolean): void` function. `authStore`'s existing `setImpersonator` action calls it whenever the impersonator value changes, so the guard is always in sync with the banner without a circular import (avoids `supabase.ts` importing the zustand store, which would create `supabase.ts → authStore.ts → supabase.ts`).

- [ ] **Step 1: Write the failing test for the fetch guard**

Create `src/lib/supabase.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';

describe('impersonation read-only guard', () => {
  beforeEach(async () => {
    const mod = await import('./supabase');
    (mod as any).setImpersonating(false);
  });

  it('blocks a mutating table request while impersonating', async () => {
    const { setImpersonating } = await import('./supabase') as any;
    setImpersonating(true);
    const { isBlockedByImpersonation } = await import('./supabase') as any;
    expect(isBlockedByImpersonation('https://x.supabase.co/rest/v1/dealers?id=eq.1', 'PATCH')).toBe(true);
  });

  it('allows GET requests while impersonating', async () => {
    const { setImpersonating, isBlockedByImpersonation } = await import('./supabase') as any;
    setImpersonating(true);
    expect(isBlockedByImpersonation('https://x.supabase.co/rest/v1/dealers?id=eq.1', 'GET')).toBe(false);
  });

  it('allows read-style RPCs (get_*) while impersonating', async () => {
    const { setImpersonating, isBlockedByImpersonation } = await import('./supabase') as any;
    setImpersonating(true);
    expect(isBlockedByImpersonation('https://x.supabase.co/rest/v1/rpc/get_dashboard_aggregates', 'POST')).toBe(false);
  });

  it('blocks write-style RPCs while impersonating', async () => {
    const { setImpersonating, isBlockedByImpersonation } = await import('./supabase') as any;
    setImpersonating(true);
    expect(isBlockedByImpersonation('https://x.supabase.co/rest/v1/rpc/create_bill', 'POST')).toBe(true);
  });

  it('does not block anything when not impersonating', async () => {
    const { setImpersonating, isBlockedByImpersonation } = await import('./supabase') as any;
    setImpersonating(false);
    expect(isBlockedByImpersonation('https://x.supabase.co/rest/v1/dealers?id=eq.1', 'PATCH')).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/supabase.test.ts`
Expected: FAIL — `setImpersonating`/`isBlockedByImpersonation` don't exist yet.

- [ ] **Step 3: Implement the guard in `src/lib/supabase.ts`**

Replace the full contents of `src/lib/supabase.ts` with:

```ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getStaffSessionToken, getAdminSessionToken } from './sessionTokens';

// External Supabase project (user-provided AquaDealers backend).
// Anon/publishable keys are safe to ship in client code.

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://fvcafioxkgbljcjomixs.supabase.co';
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_4xT4NDR8E-Zj5wqTrh-WsA_DLqEcVvn';

if (import.meta.env.DEV && !import.meta.env.VITE_SUPABASE_URL) {
  console.warn(
    '[AquaDealers] VITE_SUPABASE_URL not set — falling back to hardcoded project URL.\n' +
    'Create a .env.local file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for local dev.'
  );
}

// Set by authStore whenever admin impersonation starts/ends. Kept as a plain
// module flag (not a zustand import) to avoid a supabase.ts <-> authStore.ts
// circular import.
let impersonating = false;
export const setImpersonating = (active: boolean) => {
  impersonating = active;
};

// RPC function names are assumed read-only (never blocked) when they start
// with one of these prefixes — the codebase's existing naming convention for
// query-shaped RPCs (get_dashboard_aggregates, get_sales_register_data, etc.).
// Anything else routed through rpc() is treated as a mutation during
// impersonation. This is a heuristic, not a full allowlist audit — it only
// activates during the rare, admin-only impersonation path, so a missed
// write-style RPC name is a residual risk to track, not a regression for
// normal dealer usage (which never sets `impersonating`).
const READ_ONLY_RPC_PREFIXES = ['get_', 'search_', 'verify_', 'check_'];

export const isBlockedByImpersonation = (url: string, method: string): boolean => {
  if (!impersonating) return false;
  const upperMethod = (method || 'GET').toUpperCase();
  if (upperMethod === 'GET' || upperMethod === 'HEAD' || upperMethod === 'OPTIONS') return false;

  let path: string;
  try {
    path = new URL(url, 'https://placeholder.invalid').pathname;
  } catch {
    return false;
  }

  const rpcMatch = path.match(/\/rest\/v1\/rpc\/([a-zA-Z0-9_]+)/);
  if (rpcMatch) {
    const fnName = rpcMatch[1];
    return !READ_ONLY_RPC_PREFIXES.some((prefix) => fnName.startsWith(prefix));
  }

  return path.startsWith('/rest/v1/');
};

const fetchWithSessionHeaders: typeof fetch = (input, init) => {
  const method = init?.method || 'GET';
  const url = typeof input === 'string' ? input : (input as Request).url;

  if (isBlockedByImpersonation(url, method)) {
    return Promise.reject(new Error('Action blocked: admin impersonation is read-only.'));
  }

  const staffToken = getStaffSessionToken();
  const adminToken = getAdminSessionToken();
  if (!staffToken && !adminToken) {
    return fetch(input, init);
  }

  const headers = new Headers(init?.headers);
  if (staffToken) headers.set('x-staff-token', staffToken);
  if (adminToken) headers.set('x-admin-token', adminToken);
  return fetch(input, { ...init, headers });
};

export const supabase: SupabaseClient<any, any, any> = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
    global: {
      fetch: fetchWithSessionHeaders,
    },
  }
);

export default supabase;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/supabase.test.ts`
Expected: PASS

- [ ] **Step 5: Wire `setImpersonating` into `authStore`'s impersonator setter**

Find the `impersonator`/`setImpersonator` action in `src/stores/authStore.ts` (confirmed present via grep). Import the new setter at the top of the file:

```ts
import { setImpersonating } from '@/lib/supabase';
```

Inside the store's `setImpersonator` action, call it alongside the existing state update, e.g.:

```ts
setImpersonator: (name: string | null) => {
  setImpersonating(!!name);
  set({ impersonator: name });
},
```

(Match this to the action's actual current implementation in the file — the only requirement is that `setImpersonating(!!value)` runs every time `impersonator` changes, including on app boot if a persisted impersonation flag is rehydrated from storage.)

- [ ] **Step 6: Manually verify end-to-end**

1. As an admin, impersonate the TEST dealer (never production).
2. In the impersonated tab, attempt to edit a farmer's details or create a bill.
3. Confirm the action fails with "Action blocked: admin impersonation is read-only." surfaced via the existing `toast.error(error.message)` pattern already used throughout the app's mutation error handling.
4. Confirm read-only pages (dashboard, farmer list, reports) still load normally.
5. Exit impersonation and confirm normal dealer writes work again immediately (i.e. `impersonating` flips back to `false`).

- [ ] **Step 7: Run the full test suite**

Run: `npm test`
Expected: PASS, no regressions (this fetch wrapper is only active when `impersonating === true`, which is `false` by default for every existing test and every normal session).

- [ ] **Step 8: Type-check**

Run: `npx tsc -b --noEmit`
Expected: no new errors.

- [ ] **Step 9: Commit**

```bash
git add src/lib/supabase.ts src/lib/supabase.test.ts src/stores/authStore.ts
git commit -m "fix: enforce impersonation read-only mode at the network layer instead of just labeling it"
```

---

### Task 9: Unify the three conflicting profit calculations (Dashboard, Business Snapshot, Reports)

**Problem (audit #3):** `useDashboardStats` (item-level cost basis per bill), `useBusinessSnapshot` (inventory-delta approximation), and `reportsService.getMonthlyFinancePack` (purchases-in-period, not COGS-of-goods-sold) can each show a different profit number for the same period. This is the highest-effort Tier 1 item — schema-safe but requires a new shared source of truth.

**Files:**
- Create: `supabase/migrations/20260730000001_realized_profit_rpc.sql`
- Modify: `src/features/financials/hooks/useBusinessSnapshot.ts`
- Test: manual verification only for the SQL function (no existing SQL test harness in this repo); add a unit test for the hook's consumption of the new RPC shape.

**Interfaces:**
- Produces: new read-only SQL function `get_realized_profit(p_dealer_id UUID, p_start DATE, p_end DATE) RETURNS NUMERIC` — computes profit as `SUM((unit_price - cost_price) * quantity)` across bill items in range, the same cost-basis method `useDashboardStats`/`useProfitReportData` already use, so all three converge on one formula.
- `useBusinessSnapshot.ts`'s existing `realizedProfit` field keeps its exact name and type (`number`) in the hook's return shape — only its computation swaps from the inventory-delta approximation to a call to the new RPC. No consumer of `useBusinessSnapshot()` needs to change.

- [ ] **Step 1: Create the new read-only profit RPC**

Create `supabase/migrations/20260730000001_realized_profit_rpc.sql`:

```sql
-- Single source of truth for "realized profit" over a date range, using the
-- same item-level cost-basis formula useDashboardStats/useProfitReportData
-- already use for their (correct) numbers. useBusinessSnapshot's own
-- inventory-delta approximation and the monthly finance pack's
-- purchases-in-period approximation both drift from this whenever
-- purchases and sales aren't time-aligned. This function is read-only,
-- additive, and changes no existing table or RPC.

CREATE OR REPLACE FUNCTION public.get_realized_profit(
  p_dealer_id UUID,
  p_start DATE,
  p_end DATE
)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(
    (bi.unit_price - COALESCE(bi.cost_price, 0)) * bi.quantity
  ), 0)
  FROM bill_items bi
  JOIN bills b ON b.id = bi.bill_id
  WHERE b.dealer_id = p_dealer_id
    AND b.status != 'cancelled'
    AND b.bill_date >= p_start
    AND b.bill_date <= p_end;
$$;

REVOKE ALL ON FUNCTION public.get_realized_profit(UUID, DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_realized_profit(UUID, DATE, DATE) TO authenticated;
NOTIFY pgrst, 'reload schema';
```

- [ ] **Step 2: Confirm `bill_items` actually has a `cost_price` column before applying**

Run: `npx supabase gen types typescript --local 2>/dev/null | grep -A 30 "bill_items:" | grep cost_price` (or check `src/types/database.ts` for the `BillItem`/`bill_items` row type directly).

If `cost_price` is not present on `bill_items` (only on `inventory`), adjust the function to join `inventory` on `bi.inventory_id = inv.id` and use `inv.cost_price` instead — check `useDashboardStats`'s existing "todayProfit" query (in `useDashboardData.ts`, per the financials audit) for the exact join it already uses, and mirror that same join here so the new RPC produces identical numbers to the already-correct dashboard figure for the same day.

- [ ] **Step 3: Apply the migration to the dev/test project**

Run: `supabase db push` (or this repo's documented migration-apply command).
Expected: applies cleanly.

- [ ] **Step 4: Manually cross-check the new RPC against the existing dashboard number**

Run against the TEST dealer's data (via the Supabase SQL editor or a scratch script), for today's date range:

```sql
SELECT public.get_realized_profit('f90ec65c-28e1-482e-b15f-1595bc6869e2'::uuid, CURRENT_DATE, CURRENT_DATE);
```

Compare against the Dashboard's "Today's Profit" figure for the same test dealer/day — they should match. If they don't, the join in Step 2 needs adjusting before proceeding (do not swap `useBusinessSnapshot` onto a source that disagrees with the already-correct dashboard number — that would just move the mismatch, not fix it).

- [ ] **Step 5: Swap `useBusinessSnapshot`'s profit source to the new RPC**

Open `src/features/financials/hooks/useBusinessSnapshot.ts` and locate the `realizedProfit` computation (currently `totalSales - (totalInvested - currentInventoryValue) - totalExpenses`, per the audit). Replace it with a call to the new RPC:

```ts
const { data: realizedProfitData } = useQuery({
  queryKey: ['realized-profit', dealerId, startDate, endDate],
  queryFn: async () => {
    const { data, error } = await supabase.rpc('get_realized_profit', {
      p_dealer_id: dealerId,
      p_start: startDate,
      p_end: endDate,
    });
    if (error) throw error;
    return Number(data) || 0;
  },
  enabled: !!dealerId && !!startDate && !!endDate,
  staleTime: 5 * 60 * 1000,
});
```

(Match variable names — `dealerId`/`startDate`/`endDate` — to whatever this hook's existing query already uses for its date range; do not introduce a second, differently-scoped date range.)

Replace the old `realizedProfit` value in the hook's return object with `realizedProfitData ?? 0`, keeping the field name unchanged so no consumer needs to change.

- [ ] **Step 6: Manually verify the Reports page**

1. Open Reports → Business Snapshot for the test dealer, for a period with both sales and a large prior-period purchase.
2. Confirm the "Realized Profit" figure now matches what a manual cost-basis calculation over that period's actual bills would produce (spot-check with 2-3 bills), rather than the old inventory-delta approximation.
3. Confirm the Dashboard's "Today's Profit" and this figure agree on any single-day range.

- [ ] **Step 7: Type-check and run tests**

Run: `npx tsc -b --noEmit && npm test`
Expected: no new errors, no regressions.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20260730000001_realized_profit_rpc.sql src/features/financials/hooks/useBusinessSnapshot.ts
git commit -m "fix: Business Snapshot profit now uses the same item-cost-basis formula as the Dashboard"
```

- [ ] **Step 9: Follow-up note (not part of this task's commit)**

The monthly finance pack (`reportsService.getMonthlyFinancePack`, used by the Reports page's P&L/GST views) still uses its own purchases-in-period formula and was intentionally left untouched here to keep this task's blast radius small — swapping it onto `get_realized_profit` too is a natural Sprint-2 follow-up once this RPC has run in production for a few days without disagreement.

---

### Task 10: Add real pricing to the landing page

**Problem (audit #9):** No pricing anywhere on the marketing site; the only CTA is "Call for Pricing." Actual current pricing (confirmed by the business owner): **Basic** — list ₹9,000/yr, offer ₹6,500/yr; **Pro** — list ₹10,000/yr, offer ₹7,500/yr; **Pro+** — list ₹15,000/yr, offer ₹10,000/yr.

**Files:**
- Create: `src/features/landing/components/PricingSection.tsx`
- Modify: `src/features/landing/pages/LandingPage.tsx:1,52-64` (nav link) and wherever the page's section order is composed (search this file for `id="tutorials"` or `id="contact"` to find the right insertion point between Features and Contact).

**Interfaces:**
- Produces: `PricingSection` — a self-contained component, no props, rendered once in `LandingPage.tsx`.

- [ ] **Step 1: Derive the feature-per-plan matrix from the actual plan definitions**

Confirmed from `supabase/migrations/20260601000004_subscription_features.sql`, `20260618000001_farmer_product_discounts.sql`, and `20260620000002_signature_proof_plan.sql` (the live feature-gating source of truth — `src/stores/subscriptionStore.ts` reads this table at runtime, so this list must stay in sync with it if the DB values are ever changed later):

- **Basic:** Core billing & inventory, Expense tracking, Cash book, Supplier management, Data export, WhatsApp bill sharing
- **Pro** (everything in Basic, plus): GST billing, Advanced reports, Voice search, Multi-language, PDF invoices, Priority support, App PIN lock, Signature proof on credit bills
- **Pro+** (everything in Pro, plus): Staff logins (up to 10), Farmer photo capture, Farmer-specific product discounts, Product images, Unlimited branches

- [ ] **Step 2: Build the `PricingSection` component**

Create `src/features/landing/components/PricingSection.tsx`:

```tsx
import React from 'react';
import { Check } from 'lucide-react';

interface PlanCard {
  name: string;
  listPrice: number;
  offerPrice: number;
  highlight?: boolean;
  features: string[];
}

const PLANS: PlanCard[] = [
  {
    name: 'Basic',
    listPrice: 9000,
    offerPrice: 6500,
    features: [
      'Core billing & inventory',
      'Expense tracking',
      'Cash book',
      'Supplier management',
      'Data export',
      'WhatsApp bill sharing',
    ],
  },
  {
    name: 'Pro',
    listPrice: 10000,
    offerPrice: 7500,
    highlight: true,
    features: [
      'Everything in Basic',
      'GST billing',
      'Advanced reports',
      'Voice search',
      'Multi-language (Telugu, Hindi, English)',
      'PDF invoices',
      'Priority support',
      'App PIN lock',
      'Signature proof on credit bills',
    ],
  },
  {
    name: 'Pro+',
    listPrice: 15000,
    offerPrice: 10000,
    features: [
      'Everything in Pro',
      'Staff logins (up to 10)',
      'Farmer photo capture',
      'Farmer-specific product discounts',
      'Product images',
      'Unlimited branches',
    ],
  },
];

const formatINR = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;

export const PricingSection: React.FC = () => (
  <section id="pricing" className="py-20 bg-white">
    <div className="max-w-7xl mx-auto px-6">
      <div className="text-center mb-12">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">Simple, per-year pricing</h2>
        <p className="mt-3 text-slate-500 text-lg">No hidden fees. Cancel anytime. Prices are per shop, per year.</p>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {PLANS.map((plan) => (
          <div
            key={plan.name}
            className={`rounded-2xl border p-8 flex flex-col ${
              plan.highlight ? 'border-blue-600 shadow-lg ring-1 ring-blue-100 relative' : 'border-slate-200'
            }`}
          >
            {plan.highlight && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                Most Popular
              </span>
            )}
            <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900">{formatINR(plan.offerPrice)}</span>
              <span className="text-slate-400 line-through text-sm">{formatINR(plan.listPrice)}</span>
              <span className="text-slate-500 text-sm">/ year</span>
            </div>
            <ul className="mt-6 space-y-3 flex-1">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm text-slate-600">
                  <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  {feature}
                </li>
              ))}
            </ul>
            <a
              href="tel:7207171544"
              className={`mt-8 inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-bold transition-colors ${
                plan.highlight
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
              }`}
            >
              Get Started
            </a>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default PricingSection;
```

- [ ] **Step 3: Insert the section into `LandingPage.tsx` and add it to the nav**

Add the import near the other component imports in `src/features/landing/pages/LandingPage.tsx` (after line 3's `Seo` import):

```tsx
import PricingSection from '../components/PricingSection';
```

Add a nav link next to the existing `#features`/`#tutorials` anchors (line 61, right after `<a href="#features" ...>Features</a>`):

```tsx
            <a href="#pricing" className="hover:text-blue-600 transition-colors">Pricing</a>
```

Render `<PricingSection />` in the page body, placed between the Features section and the Tutorials/Contact section (find the closing tag of whatever section currently has `id="features"` and insert `<PricingSection />` immediately after it — do not place it before Features, since a first-time visitor should see what the product does before seeing what it costs).

- [ ] **Step 4: Manually verify in the browser**

1. Load the landing page locally (`npm run dev`).
2. Confirm "Pricing" appears in the nav and scrolls to the new section.
3. Confirm all three cards render with the correct list/offer prices and per-plan feature lists.
4. Confirm the page still builds and no console errors appear.

- [ ] **Step 5: Type-check**

Run: `npx tsc -b --noEmit`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/landing/components/PricingSection.tsx src/features/landing/pages/LandingPage.tsx
git commit -m "feat: publish real pricing on the landing page instead of call-for-pricing only"
```

---

## Self-Review Notes

- **Spec coverage:** All 10 Tier 1 findings from the audit have a corresponding task (1↔#1, 2↔#2, 3↔#5, 4↔#10, 5↔#4, 6↔#6, 7↔#7, 8↔#8, 9↔#3, 10↔#9).
- **No destructive changes:** every SQL change is `CREATE OR REPLACE FUNCTION` with `COALESCE`-preserved defaults; no `DROP`/`ALTER ... DROP`; no existing RPC caller's behavior changes when it doesn't pass the new optional field.
- **Independent revertability:** each task is its own commit touching a disjoint set of files (Tasks 1/3/4 all touch `useCheckout.ts`/`PaymentStep.tsx`/`ReviewStep.tsx` but via non-overlapping line ranges — recommended execution order is 1 → 3 → 4 in sequence for that reason, to avoid merge friction within the same files).
- **Task 9 (profit unification)** is intentionally the most conservative of the three "hard" audit items — it adds a new read-only function and swaps one consumer, explicitly deferring the finance-pack consumer to a follow-up rather than risk widening this task's blast radius.
