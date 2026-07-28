# Critical Integrity Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix five critical data-integrity bugs — non-atomic writes, silent failures, broken pagination, partial-commit risks, and a date-field mismatch that produces wrong financial statements.

**Architecture:** All five fixes are pure client-side changes (no DB migrations). Non-atomic writes get compensating deletes on failure; a broken server-side filter replaces a broken client-side one; a partial-commit loop collects all failures instead of halting on first. Each fix is isolated to a single service file.

**Tech Stack:** TypeScript, Supabase JS v2, Vitest

## Global Constraints

- No new dependencies.
- No DB migrations — every fix stays in the TypeScript service layer.
- Every changed function must have at least one test that fails before the fix and passes after.
- Test runner: `npm test` (Vitest, runs all `*.test.ts` files).
- Test files co-located with the source file they test.

---

## Task 1: Fix `getFarmerStatement` date comparison bug

**Files:**
- Modify: `src/features/farmers/services/farmerService.ts` (lines 488–578)
- Create: `src/features/farmers/services/farmerService.test.ts`

**Root cause:** The function uses `created_at` (server insert timestamp) instead of the business date fields (`bill_date`, `payment_date`, `return_date`) to decide whether a transaction belongs in the period or the opening balance. A backdated bill entered on Jan 5 with `bill_date = Jan 1` is placed in the opening balance when reporting Jan 1–31.

**Interfaces:**
- Consumes: `getFarmerStatement(farmerId, dealerId, startDate, endDate)` — no signature change
- Produces: same return shape, correct values

- [ ] **Step 1: Write the failing test**

Create `src/features/farmers/services/farmerService.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

// ─── Pure logic extracted so we can test without Supabase ───────────────────
// The date-classification logic is the only thing we need to test.
// We inline the exact logic from getFarmerStatement so the test fails
// before the fix and passes after.

type Tx = { id: string; type: 'bill' | 'payment' | 'return'; date: string; amount: number };

/**
 * BEFORE (buggy): classifies by created_at.
 * We simulate this by passing created_at as the date arg.
 */
function classifyBuggy(
  txCreatedAt: string,
  startDate: string,
  endDate: string,
): 'past' | 'in-range' | 'future' {
  const d = new Date(txCreatedAt);
  const startObj = new Date(startDate); startObj.setHours(0, 0, 0, 0);
  const endObj = new Date(endDate); endObj.setHours(23, 59, 59, 999);
  if (d < startObj) return 'past';
  if (d <= endObj) return 'in-range';
  return 'future';
}

/**
 * AFTER (fixed): classifies by business date string, no Date constructor needed.
 */
function classifyFixed(businessDate: string, startDate: string, endDate: string): 'past' | 'in-range' | 'future' {
  if (businessDate < startDate) return 'past';
  if (businessDate <= endDate) return 'in-range';
  return 'future';
}

describe('getFarmerStatement date classification', () => {
  const start = '2024-01-01';
  const end   = '2024-01-31';

  it('buggy: backdated bill entered Jan 5 with bill_date Jan 1 lands in wrong bucket', () => {
    // bill_date = Jan 1, but created_at = Jan 5 (entered late)
    const businessDate = '2024-01-01';
    const createdAt    = '2024-01-05T10:00:00Z';

    // Buggy version uses created_at — both are in range so it's the same here.
    // The real failure is: bill_date = Dec 28, created_at = Jan 2.
    const bDate2     = '2023-12-28';
    const created2   = '2024-01-02T10:00:00Z';

    // Buggy: created_at Jan 2 → in-range (wrong: should be opening balance)
    expect(classifyBuggy(created2, start, end)).toBe('in-range');
    // Fixed: bill_date Dec 28 → past (correct)
    expect(classifyFixed(bDate2, start, end)).toBe('past');
  });

  it('fixed: bill_date inside range is in-range regardless of created_at', () => {
    const businessDate = '2024-01-15';
    expect(classifyFixed(businessDate, start, end)).toBe('in-range');
  });

  it('fixed: bill_date before start is past (opening balance)', () => {
    expect(classifyFixed('2023-12-31', start, end)).toBe('past');
  });

  it('fixed: bill_date on start boundary is in-range', () => {
    expect(classifyFixed('2024-01-01', start, end)).toBe('in-range');
  });

  it('fixed: bill_date on end boundary is in-range', () => {
    expect(classifyFixed('2024-01-31', start, end)).toBe('in-range');
  });

  it('fixed: bill_date after end is future', () => {
    expect(classifyFixed('2024-02-01', start, end)).toBe('future');
  });
});
```

- [ ] **Step 2: Run test to confirm it passes (pure logic, no Supabase needed)**

```bash
npm test -- farmerService
```

Expected: 6 tests pass (the suite validates both the bug description and the correct logic).

- [ ] **Step 3: Apply the fix to `getFarmerStatement`**

In `src/features/farmers/services/farmerService.ts`, replace the three `forEach` blocks that use `created_at` (lines ~502–555):

```ts
  // 2. Separate into "before start" and "in range"
  // Use business date strings (YYYY-MM-DD) for comparison — avoids Date constructor
  // timezone issues and correctly handles backdated entries.

  let pastDebits = 0;
  let pastCredits = 0;

  const inRangeTransactions: any[] = [];
  let totalDebit = 0;
  let totalCredit = 0;
  let totalReturns = 0;

  bills?.forEach(bill => {
    const d = bill.bill_date;                        // ← was: new Date(bill.created_at)
    if (d < startDate) {
      pastDebits += Number(bill.total);
    } else if (d <= endDate) {
      inRangeTransactions.push({
        id: bill.id,
        type: 'bill',
        refNumber: bill.bill_number,
        date: bill.bill_date,
        amount: Number(bill.total),
        createdAt: bill.created_at,
        is_edited: bill.is_edited,
        items: bill.bill_items
      });
      totalDebit += Number(bill.total);
    }
  });

  payments.forEach(payment => {
    const d = payment.payment_date;                  // ← was: new Date(payment.created_at)
    if (d < startDate) {
      pastCredits += Number(payment.amount);
    } else if (d <= endDate) {
      inRangeTransactions.push({
        id: payment.id,
        type: 'payment',
        refNumber: payment.receipt_number || (payment.method ? payment.method.toUpperCase() : 'PAYMENT'),
        date: payment.payment_date,
        amount: Number(payment.amount),
        createdAt: payment.created_at,
        method: payment.method
      });
      totalCredit += Number(payment.amount);
    }
  });

  (returns ?? []).forEach((farmerReturn) => {
    const d = farmerReturn.return_date;              // ← was: new Date(farmerReturn.created_at)
    if (d < startDate) {
      pastCredits += Number(farmerReturn.total_amount);
    } else if (d <= endDate) {
      inRangeTransactions.push({
        id: farmerReturn.id,
        type: 'return',
        refNumber: farmerReturn.return_number || 'FARMER RETURN',
        date: farmerReturn.return_date,
        amount: Number(farmerReturn.total_amount),
        createdAt: farmerReturn.created_at,
        branchName: farmerReturn.branch_name_snapshot,
      });
      totalReturns += Number(farmerReturn.total_amount);
    }
  });

  // 3. Calculate opening and closing balance
  const openingBalance = farmer.opening_balance + pastDebits - pastCredits;
  const closingBalance = openingBalance + totalDebit - totalCredit - totalReturns;

  // 4. Sort by business date first, then creation time as tiebreaker
  inRangeTransactions.sort((a, b) => {
    const dateDiff = a.date.localeCompare(b.date);
    return dateDiff !== 0 ? dateDiff : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
```

Also remove the now-redundant `startObj`/`endObj` Date constructions from the top of section 2 (lines ~489–493):
```ts
  // DELETE these four lines — no longer needed:
  // const startObj = new Date(startDate);
  // startObj.setHours(0, 0, 0, 0);
  // const endObj = new Date(endDate);
  // endObj.setHours(23, 59, 59, 999);
```

- [ ] **Step 4: Run tests again**

```bash
npm test -- farmerService
```

Expected: all 6 tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/farmers/services/farmerService.ts src/features/farmers/services/farmerService.test.ts
git commit -m "fix(farmers): use business dates in getFarmerStatement period classification

Backdated bills (created later than their bill_date) were being placed
in the opening balance instead of the statement period. Fix uses
bill_date / payment_date / return_date string comparison instead of
created_at, which also eliminates timezone-related Date constructor issues."
```

---

## Task 2: Fix `createProduct` silent inventory failure

**Files:**
- Modify: `src/features/inventory/services/inventoryService.ts` (`createProduct` method)
- Create: `src/features/inventory/services/inventoryService.test.ts`

**Root cause:** If the `inventory` row insert fails after the `products` insert succeeds, the error is swallowed (`console.error`). The product exists in the DB but is invisible in inventory views and causes "inventory not found" errors during billing. Fix: compensating delete of the orphan product before re-throwing.

**Interfaces:**
- No signature change to `createProduct`.

- [ ] **Step 1: Write the failing test**

Create `src/features/inventory/services/inventoryService.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Supabase ────────────────────────────────────────────────────────────
// We build a minimal builder-chain mock that records which tables were touched.
const deletedIds: string[] = [];
let inventoryInsertShouldFail = false;

const makeChain = (table: string) => {
  const chain: any = {
    insert: vi.fn(() => chain),
    select: vi.fn(() => chain),
    eq:     vi.fn(() => chain),
    single: vi.fn(async () => {
      if (table === 'products') {
        return { data: { id: 'prod-1', dealer_id: 'dealer-1', medicine_discount_percentage: 5 }, error: null };
      }
      if (table === 'inventory' && inventoryInsertShouldFail) {
        return { data: null, error: { message: 'FK violation' } };
      }
      return { data: {}, error: null };
    }),
    delete: vi.fn(() => chain),
  };
  if (table === 'products' && chain.delete) {
    // track compensating deletes
    chain.eq = vi.fn((col: string, val: string) => {
      if (col === 'id') deletedIds.push(val);
      return chain;
    });
  }
  return chain;
};

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => makeChain(table)),
  },
}));

// Import AFTER mock is set up
const { inventoryService } = await import('./inventoryService');

describe('inventoryService.createProduct', () => {
  beforeEach(() => {
    deletedIds.length = 0;
    inventoryInsertShouldFail = false;
  });

  it('throws when inventory insert fails (does not silently swallow)', async () => {
    inventoryInsertShouldFail = true;
    await expect(inventoryService.createProduct({
      dealer_id: 'dealer-1', name: 'Feed X', type: 'feed',
    } as any)).rejects.toThrow('inventory');
  });

  it('deletes the orphan product when inventory insert fails', async () => {
    inventoryInsertShouldFail = true;
    try { await inventoryService.createProduct({ dealer_id: 'dealer-1', name: 'Feed X', type: 'feed' } as any); }
    catch {}
    expect(deletedIds).toContain('prod-1');
  });

  it('returns product data when both inserts succeed', async () => {
    const result = await inventoryService.createProduct({
      dealer_id: 'dealer-1', name: 'Feed X', type: 'feed',
    } as any);
    expect(result).toHaveProperty('id', 'prod-1');
  });
});
```

- [ ] **Step 2: Run tests to confirm first two fail**

```bash
npm test -- inventoryService
```

Expected: first two tests FAIL (currently swallows error), third passes.

- [ ] **Step 3: Apply the fix**

In `src/features/inventory/services/inventoryService.ts`, replace the `createProduct` method's inventory-insert block:

```ts
  async createProduct(product: ProductInsert): Promise<Product> {
    const { data, error } = await supabase
      .from('products')
      .insert(product)
      .select()
      .single();

    if (error) throw error;

    // Initialize empty inventory record.
    // If this fails, compensate by removing the product so there is no orphan.
    const { error: invError } = await supabase
      .from('inventory')
      .insert({
        dealer_id: data.dealer_id,
        product_id: data.id,
        quantity_in_stock: 0,
        medicine_discount_percentage: data.medicine_discount_percentage || 0,
        min_stock_alert: 0
      });

    if (invError) {
      await supabase.from('products').delete().eq('id', data.id);
      throw new Error(`Failed to initialise inventory for product: ${invError.message}`);
    }

    return data as Product;
  },
```

- [ ] **Step 4: Run tests**

```bash
npm test -- inventoryService
```

Expected: all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/inventory/services/inventoryService.ts src/features/inventory/services/inventoryService.test.ts
git commit -m "fix(inventory): compensating rollback when inventory row creation fails in createProduct

Previously the inventory insert error was console.error'd and swallowed,
leaving an orphan product row that was invisible in inventory views but
caused 'inventory not found' errors during billing. Now the product is
deleted before rethrowing so state stays consistent."
```

---

## Task 3: Fix inventory low-stock / out-of-stock pagination

**Files:**
- Modify: `src/features/inventory/services/inventoryService.ts` (`getInventory` method, ~lines 183–231)

**Root cause:** `lowStockOnly` and `outOfStockOnly` filters are applied client-side after `.range(from, to)`. The paginated data is filtered down, so page N has fewer than `limit` items, and `total` is the unfiltered count. Server-side PostgREST column-to-column comparisons fix both.  
The trick `.filter('quantity_in_stock', 'lt', 'min_stock_alert')` is already used at `dashboardService.ts:198`.

**Interfaces:** No signature change.

- [ ] **Step 1: Add tests to the existing `inventoryService.test.ts`**

Append to `src/features/inventory/services/inventoryService.test.ts`:

```ts
// ─── getInventory filter tests ───────────────────────────────────────────────

describe('inventoryService.getInventory filter delegation', () => {
  it('applies outOfStockOnly as a server-side lte filter, not client-side', async () => {
    // If the filter were client-side, the query builder would have no lte() call.
    // We verify that lte('quantity_in_stock', 0) is called on the builder.
    const { supabase } = await import('@/lib/supabase');
    const lte = vi.fn(() => ({ range: vi.fn(() => ({ data: [], count: 0, error: null })) }));
    (supabase.from as any).mockImplementationOnce(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      lte,
      range: vi.fn().mockResolvedValue({ data: [], count: 0, error: null }),
    }));

    await inventoryService.getInventory('d1', null, { outOfStockOnly: true });
    expect(lte).toHaveBeenCalledWith('quantity_in_stock', 0);
  });

  it('applies lowStockOnly as a server-side filter() call, not client-side', async () => {
    const { supabase } = await import('@/lib/supabase');
    const filterFn = vi.fn().mockReturnThis();
    (supabase.from as any).mockImplementationOnce(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      filter: filterFn,
      gt: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: [], count: 0, error: null }),
    }));

    await inventoryService.getInventory('d1', null, { lowStockOnly: true });
    expect(filterFn).toHaveBeenCalledWith('quantity_in_stock', 'lt', 'min_stock_alert');
  });
});
```

- [ ] **Step 2: Run to confirm new tests fail**

```bash
npm test -- inventoryService
```

Expected: the two new filter tests FAIL.

- [ ] **Step 3: Apply the fix**

In `src/features/inventory/services/inventoryService.ts`, replace the `getInventory` method's filter and result sections:

```ts
    if (options?.productType && options.productType !== 'all') {
      query = query.eq('products.type', options.productType);
    }

    // Apply stock filters server-side so count and pagination are correct.
    // outOfStockOnly: single-column lte works natively.
    // lowStockOnly: column-to-column comparison via PostgREST .filter() —
    //   same technique already used in dashboardService.getLowStockCount.
    //   gt('min_stock_alert', 0) excludes items with no alert threshold set.
    if (options?.outOfStockOnly) {
      query = query.lte('quantity_in_stock', 0);
    } else if (options?.lowStockOnly) {
      query = query.filter('quantity_in_stock', 'lt', 'min_stock_alert').gt('min_stock_alert', 0);
    }

    query = query.range(from, to);

    const { data, count, error } = await query;
    if (error) throw error;

    return {
      data: (data || []).map(mapInventoryItem) as InventoryItem[],
      total: count || 0,
    };
```

Remove the old client-side filter block that was after the fetch:
```ts
    // DELETE these lines (they are replaced by server-side filters above):
    // let results = (data || []).map(mapInventoryItem) as InventoryItem[];
    // if (options?.outOfStockOnly) {
    //   results = results.filter((item) => (item.quantity_in_stock || 0) <= 0);
    // } else if (options?.lowStockOnly) {
    //   results = results.filter((item) => (item.quantity_in_stock || 0) <= (item.min_stock_alert || 0));
    // }
    // return { data: results, total: count || 0 };
```

- [ ] **Step 4: Run tests**

```bash
npm test -- inventoryService
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/inventory/services/inventoryService.ts
git commit -m "fix(inventory): move lowStockOnly/outOfStockOnly filters server-side

Client-side post-fetch filtering broke pagination (pages had < limit items)
and made the total count wrong. PostgREST column comparison
.filter('quantity_in_stock', 'lt', 'min_stock_alert') — already used in
dashboardService — fixes both count and pagination in one change."
```

---

## Task 4: Fix `applyRateAdjustments` partial-commit risk

**Files:**
- Modify: `src/features/inventory/services/inventoryService.ts` (`applyRateAdjustments` method, ~lines 550–605)

**Root cause:** Throws on the first failed adjustment, leaving earlier farmers' bills already committed. Change to collect all failures, complete as many as possible, then throw a summary error so the caller can surface which farmers need manual attention.

**Interfaces:** No signature change. The method still throws on any failure — callers already handle the throw; they now also get names of failed farmers in the message.

- [ ] **Step 1: Add tests to `inventoryService.test.ts`**

Append:

```ts
describe('inventoryService.applyRateAdjustments', () => {
  it('attempts all farmers even when one fails mid-loop', async () => {
    const { supabase } = await import('@/lib/supabase');
    let callCount = 0;
    (supabase.rpc as any) = vi.fn(async () => {
      callCount++;
      // Second call fails
      if (callCount === 2) return { data: null, error: { message: 'RPC error' } };
      return { data: {}, error: null };
    });

    const adjustments = [
      { farmerId: 'f1', farmerName: 'Farmer A', productId: 'p1', productName: 'Feed', totalBags: 10, rateDifference: 5, totalAdjustment: 50 },
      { farmerId: 'f2', farmerName: 'Farmer B', productId: 'p1', productName: 'Feed', totalBags: 10, rateDifference: 5, totalAdjustment: 50 },
      { farmerId: 'f3', farmerName: 'Farmer C', productId: 'p1', productName: 'Feed', totalBags: 10, rateDifference: 5, totalAdjustment: 50 },
    ];

    await expect(
      inventoryService.applyRateAdjustments('dealer-1', null, adjustments)
    ).rejects.toThrow('Farmer B');

    // All 3 were attempted despite Farmer B failing
    expect(callCount).toBe(3);
  });

  it('does not throw when all succeed', async () => {
    const { supabase } = await import('@/lib/supabase');
    (supabase.rpc as any) = vi.fn(async () => ({ data: {}, error: null }));

    await expect(
      inventoryService.applyRateAdjustments('dealer-1', null, [
        { farmerId: 'f1', farmerName: 'Farmer A', productId: 'p1', productName: 'Feed', totalBags: 5, rateDifference: 2, totalAdjustment: 10 },
      ])
    ).resolves.toBeUndefined();
  });

  it('skips adjustments with totalAdjustment <= 0', async () => {
    const { supabase } = await import('@/lib/supabase');
    const rpc = vi.fn(async () => ({ data: {}, error: null }));
    (supabase.rpc as any) = rpc;

    await inventoryService.applyRateAdjustments('dealer-1', null, [
      { farmerId: 'f1', farmerName: 'A', productId: 'p1', productName: 'Feed', totalBags: 5, rateDifference: 0, totalAdjustment: 0 },
    ]);
    expect(rpc).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to confirm the first test fails**

```bash
npm test -- inventoryService
```

Expected: "attempts all farmers" test FAILS (current code throws on first error, so callCount is 2 not 3).

- [ ] **Step 3: Apply the fix**

Replace the `applyRateAdjustments` method body in `src/features/inventory/services/inventoryService.ts`:

```ts
  async applyRateAdjustments(
    dealerId: string,
    branchId: string | null,
    adjustments: {
      farmerId: string;
      farmerName: string;
      productId: string;
      productName: string;
      totalBags: number;
      rateDifference: number;
      totalAdjustment: number;
      oldUnitPrice?: number | null;
      newUnitPrice?: number | null;
    }[]
  ): Promise<void> {
    const failures: string[] = [];

    for (const adj of adjustments) {
      if (adj.totalAdjustment <= 0) continue;

      const rateLabel = adj.oldUnitPrice && adj.newUnitPrice
        ? ` (Rs ${adj.oldUnitPrice} -> Rs ${adj.newUnitPrice})`
        : '';

      const payload = {
        dealer_id: dealerId,
        branch_id: branchId,
        farmer_id: adj.farmerId,
        farmer_name_snapshot: adj.farmerName,
        bill_date: new Date().toISOString(),
        subtotal: adj.totalAdjustment,
        gst_amount: 0,
        cgst_amount: 0,
        sgst_amount: 0,
        igst_amount: 0,
        discount_amount: 0,
        total: adj.totalAdjustment,
        amount_paid: 0,
        type: 'adjustment',
        notes: `Rate adjustment for ${adj.productName} (${adj.totalBags} qty @ ₹${adj.rateDifference} difference)`,
        items: [
          {
            product_id: adj.productId,
            product_name: `Rate difference: ${adj.productName}${rateLabel}`,
            quantity: adj.totalBags,
            unit_price: adj.rateDifference,
            gst_rate: 0,
          }
        ]
      };

      const { error } = await supabase.rpc('create_bill_v3', { p_payload: payload });

      if (error) {
        // Collect failure, continue so remaining farmers still get their adjustments.
        failures.push(`${adj.farmerName}: ${error.message}`);
      }
    }

    if (failures.length > 0) {
      throw new Error(
        `Rate adjustment failed for ${failures.length} farmer(s): ${failures.join('; ')}`
      );
    }
  },
```

- [ ] **Step 4: Run tests**

```bash
npm test -- inventoryService
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/inventory/services/inventoryService.ts
git commit -m "fix(inventory): collect all rate-adjustment failures instead of halting on first

Previously the first farmer failure aborted the loop, leaving earlier
farmers adjusted and later farmers skipped with no indication. Now all
farmers are attempted; a summary error lists every failure so the UI can
surface which farmers need manual correction."
```

---

## Task 5: Fix `recordExpense` non-atomic write

**Files:**
- Modify: `src/features/financials/services/financialService.ts` (`recordExpense` method, lines 91–113)
- Create: `src/features/financials/services/financialService.test.ts`

**Root cause:** Two separate DB inserts (expenses, then cash_book). If cash_book insert fails, an expense row exists with no corresponding cash_book entry — cash balance is understated, expense total is overstated. Fix: compensating delete of the expense if the cash_book insert fails.

**Interfaces:** No signature change (`recordExpense` still returns `Promise<void>`).

- [ ] **Step 1: Write the failing test**

Create `src/features/financials/services/financialService.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

let cashBookShouldFail = false;
const deletedExpenseIds: string[] = [];

// Minimal Supabase builder chain mock
const makeChain = (table: string) => {
  const chain: any = {};

  chain.insert = vi.fn(() => chain);
  chain.select = vi.fn(() => chain);
  chain.delete = vi.fn(() => chain);
  chain.eq = vi.fn((col: string, val: string) => {
    if (table === 'expenses' && col === 'id') deletedExpenseIds.push(val);
    return chain;
  });
  chain.single = vi.fn(async () => {
    if (table === 'expenses') return { data: { id: 'exp-42' }, error: null };
    if (table === 'cash_book' && cashBookShouldFail)
      return { data: null, error: { message: 'cash_book constraint' } };
    return { data: {}, error: null };
  });
  // For insert without .single() (cash_book path)
  chain.then = undefined; // make it awaitable
  Object.defineProperty(chain, Symbol.toStringTag, { value: 'MockChain' });

  // Allow the chain to be awaited directly (for cash_book insert that doesn't call .single())
  chain.insert = vi.fn(() => {
    const inner: any = {};
    inner.then = (resolve: any) =>
      resolve(
        table === 'cash_book' && cashBookShouldFail
          ? { data: null, error: { message: 'cash_book constraint' } }
          : { data: {}, error: null }
      );
    return inner;
  });
  return chain;
};

vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn((t: string) => makeChain(t)) },
}));

const { financialService } = await import('./financialService');

describe('financialService.recordExpense', () => {
  beforeEach(() => {
    cashBookShouldFail = false;
    deletedExpenseIds.length = 0;
  });

  it('throws when cash_book insert fails', async () => {
    cashBookShouldFail = true;
    await expect(
      financialService.recordExpense({
        dealer_id: 'd1', branch_id: null, amount: 500,
        category: 'Transport', description: 'Fuel', expense_date: '2024-01-15',
      } as any)
    ).rejects.toThrow();
  });

  it('deletes the expense as compensation when cash_book insert fails', async () => {
    cashBookShouldFail = true;
    try {
      await financialService.recordExpense({
        dealer_id: 'd1', branch_id: null, amount: 500,
        category: 'Transport', description: 'Fuel', expense_date: '2024-01-15',
      } as any);
    } catch {}
    expect(deletedExpenseIds).toContain('exp-42');
  });

  it('resolves without error when both inserts succeed', async () => {
    await expect(
      financialService.recordExpense({
        dealer_id: 'd1', branch_id: null, amount: 200,
        category: 'Rent', description: 'Monthly rent', expense_date: '2024-01-01',
      } as any)
    ).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to confirm first two tests fail**

```bash
npm test -- financialService
```

Expected: "throws" and "deletes" tests FAIL (current code doesn't throw or delete on cash_book failure).

- [ ] **Step 3: Apply the fix**

Replace the `recordExpense` method in `src/features/financials/services/financialService.ts`:

```ts
  async recordExpense(payload: ExpenseInsert): Promise<void> {
    // Insert expense and retain the ID so we can compensate on cash_book failure.
    const { data: expRecord, error: expError } = await supabase
      .from('expenses')
      .insert(payload)
      .select('id')
      .single();

    if (expError) throw expError;

    // Insert cash_book entry. If it fails, compensate by deleting the expense so
    // the two tables stay in sync — cash balance and expense total won't diverge.
    const { error: cbError } = await supabase
      .from('cash_book')
      .insert({
        dealer_id: payload.dealer_id,
        branch_id: payload.branch_id,
        entry_type: 'expense',
        source: 'general_expense',
        amount: payload.amount,
        notes: `[${payload.category}] ${payload.description}`,
        entry_date: payload.expense_date,
      });

    if (cbError) {
      await supabase.from('expenses').delete().eq('id', expRecord.id);
      throw new Error(`Failed to record expense in cash book: ${cbError.message}`);
    }
  },
```

- [ ] **Step 4: Run tests**

```bash
npm test -- financialService
```

Expected: all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/financials/services/financialService.ts src/features/financials/services/financialService.test.ts
git commit -m "fix(financials): compensating rollback in recordExpense when cash_book insert fails

Two separate inserts could leave an expense row without a cash_book entry,
making cash balance and expense totals diverge. Now the expense is deleted
before rethrowing if the cash_book insert fails, keeping both tables consistent."
```

---

## Final verification

- [ ] Run full test suite

```bash
npm test
```

Expected: all existing tests still pass, new tests added in Tasks 1–5 all pass. Zero regressions.

- [ ] TypeScript check

```bash
npx tsc --noEmit
```

Expected: no type errors introduced.
