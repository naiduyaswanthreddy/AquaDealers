import { describe, expect, it } from 'vitest';
import { buildAgingRows, buildCashBookRows, buildGSTSummaries, getMonthlyReportPeriod } from './reportBuilders';

describe('reportBuilders', () => {
  it('builds the monthly period boundaries', () => {
    const period = getMonthlyReportPeriod(4, 2026);

    expect(period.startDate).toBe('2026-04-01');
    expect(period.endDate).toBe('2026-04-30');
    expect(period.label).toBe('April 2026');
  });

  it('builds cash book rows with a running balance', () => {
    const rows = buildCashBookRows(
      [
        { id: '1', dealer_id: 'd', branch_id: null, entry_type: 'income', source: 'sale', reference_id: 'ref-1', amount: 1000, notes: 'Sale', entry_date: '2026-04-01', created_at: '2026-04-01' },
        { id: '2', dealer_id: 'd', branch_id: null, entry_type: 'expense', source: 'expense', reference_id: null, amount: 300, notes: 'Fuel', entry_date: '2026-04-02', created_at: '2026-04-02' },
      ] as any,
      500
    );

    expect(rows).toHaveLength(2);
    expect(rows[0].balance).toBe(1500);
    expect(rows[1].balance).toBe(1200);
  });

  it('builds GST summaries from output and input totals', () => {
    const gst = buildGSTSummaries(1800, 1200, 10000, 8000);

    expect(gst.netGSTPayable).toBe(600);
    expect(gst.outputRows[0]).toEqual({ label: 'Taxable Sales', value: 10000 });
    expect(gst.inputRows[0]).toEqual({ label: 'Taxable Purchases', value: 8000 });
  });

  it('derives aging buckets for open balances', () => {
    const rows = buildAgingRows([
      { id: '1', name: 'Farmer A', pendingAmount: 500, baseDate: '2025-12-01', reference: 'BILL-1' },
    ] as any);

    expect(rows[0].name).toBe('Farmer A');
    expect(rows[0].pendingAmount).toBe(500);
    expect(rows[0].agingBucket).toMatch(/days/);
  });
});
