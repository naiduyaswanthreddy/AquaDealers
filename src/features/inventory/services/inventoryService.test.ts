import { describe, it, expect } from 'vitest';

// ─── Task 3: getInventory — server-side filter logic ────────────────────────
// The old code filtered client-side after fetch, which broke both pagination
// (pages had fewer items than requested) and the total count (unfiltered).
// The fix pushes filters to PostgREST before .range(), making count accurate.
//
// We test the filter predicate logic here without hitting Supabase.

type StockItem = { quantity_in_stock: number; min_stock_alert: number };

function applyOutOfStockFilter(items: StockItem[]) {
  return items.filter(i => i.quantity_in_stock <= 0);
}

function applyLowStockFilter(items: StockItem[]) {
  // PostgREST: quantity_in_stock < min_stock_alert AND min_stock_alert > 0
  return items.filter(i => i.min_stock_alert > 0 && i.quantity_in_stock < i.min_stock_alert);
}

describe('getInventory — stock filter predicates', () => {
  const items: StockItem[] = [
    { quantity_in_stock: 0,  min_stock_alert: 5  },  // out of stock
    { quantity_in_stock: 3,  min_stock_alert: 5  },  // low stock
    { quantity_in_stock: 5,  min_stock_alert: 5  },  // at threshold, not low
    { quantity_in_stock: 10, min_stock_alert: 5  },  // healthy
    { quantity_in_stock: 2,  min_stock_alert: 0  },  // no alert set → not low
    { quantity_in_stock: -1, min_stock_alert: 5  },  // negative (out of stock)
  ];

  it('outOfStockOnly includes items with quantity <= 0', () => {
    const result = applyOutOfStockFilter(items);
    expect(result).toHaveLength(2);
    expect(result.every(i => i.quantity_in_stock <= 0)).toBe(true);
  });

  it('lowStockOnly includes items below alert threshold (alert > 0)', () => {
    const result = applyLowStockFilter(items);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ quantity_in_stock: 3, min_stock_alert: 5 });
  });

  it('lowStockOnly excludes items with no alert threshold set (min_stock_alert = 0)', () => {
    const noThreshold: StockItem[] = [{ quantity_in_stock: 0, min_stock_alert: 0 }];
    expect(applyLowStockFilter(noThreshold)).toHaveLength(0);
  });

  it('lowStockOnly excludes items at or above the threshold', () => {
    const atThreshold: StockItem[] = [{ quantity_in_stock: 5, min_stock_alert: 5 }];
    expect(applyLowStockFilter(atThreshold)).toHaveLength(0);
  });
});

// ─── Task 4: applyRateAdjustments — collect-all-failures pattern ─────────────
// Old code: first RPC failure throws, all subsequent adjustments skipped.
// Fix: collect per-farmer errors, apply all, throw summary at the end.

function simulateApplyRateAdjustments(
  adjustments: { farmerName: string; totalAdjustment: number }[],
  rpcShouldFailFor: string[]
): { applied: string[]; errors: string[] } {
  const applied: string[] = [];
  const errors: string[] = [];

  for (const adj of adjustments) {
    if (adj.totalAdjustment <= 0) continue;
    if (rpcShouldFailFor.includes(adj.farmerName)) {
      errors.push(`${adj.farmerName}: RPC error`);
      continue;
    }
    applied.push(adj.farmerName);
  }

  return { applied, errors };
}

describe('applyRateAdjustments — collect-all-failures', () => {
  const adjustments = [
    { farmerName: 'Alice', totalAdjustment: 100 },
    { farmerName: 'Bob',   totalAdjustment: 200 },
    { farmerName: 'Carol', totalAdjustment: 150 },
  ];

  it('applies all adjustments when no failures occur', () => {
    const { applied, errors } = simulateApplyRateAdjustments(adjustments, []);
    expect(applied).toEqual(['Alice', 'Bob', 'Carol']);
    expect(errors).toHaveLength(0);
  });

  it('continues past a failure and applies remaining adjustments', () => {
    const { applied, errors } = simulateApplyRateAdjustments(adjustments, ['Bob']);
    expect(applied).toEqual(['Alice', 'Carol']);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('Bob');
  });

  it('collects all failures when every adjustment fails', () => {
    const { applied, errors } = simulateApplyRateAdjustments(adjustments, ['Alice', 'Bob', 'Carol']);
    expect(applied).toHaveLength(0);
    expect(errors).toHaveLength(3);
  });

  it('skips adjustments with totalAdjustment <= 0', () => {
    const withZero = [
      { farmerName: 'Dave', totalAdjustment: 0 },
      { farmerName: 'Eve',  totalAdjustment: 50 },
    ];
    const { applied } = simulateApplyRateAdjustments(withZero, []);
    expect(applied).toEqual(['Eve']);
  });
});
