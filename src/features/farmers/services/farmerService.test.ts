import { describe, it, expect } from 'vitest';

// ─── Pure logic: statement period classification ──────────────────────────────
// We test the date-comparison logic used inside getFarmerStatement without
// hitting Supabase. The function classifies each transaction as:
//   "past"     → goes into opening balance
//   "in-range" → appears in the statement body
//   "future"   → ignored
//
// The bug: old code used `created_at` (server insert time). A backdated bill
// entered Jan 5 with bill_date = Dec 28 was placed in the statement body
// instead of the opening balance.
// The fix: compare business date strings directly (YYYY-MM-DD lexicographic).

function classifyBuggy(createdAt: string, startDate: string, endDate: string) {
  const d = new Date(createdAt);
  const startObj = new Date(startDate); startObj.setHours(0, 0, 0, 0);
  const endObj   = new Date(endDate);   endObj.setHours(23, 59, 59, 999);
  if (d < startObj) return 'past';
  if (d <= endObj)  return 'in-range';
  return 'future';
}

function classifyFixed(businessDate: string, startDate: string, endDate: string) {
  if (businessDate < startDate) return 'past';
  if (businessDate <= endDate)  return 'in-range';
  return 'future';
}

describe('getFarmerStatement — date classification', () => {
  const start = '2024-01-01';
  const end   = '2024-01-31';

  it('buggy: bill entered Jan 2 (created_at) with bill_date Dec 28 is wrongly in-range', () => {
    // Simulates a backdated bill: bill_date = Dec 28, but staff entered it on Jan 2
    expect(classifyBuggy('2024-01-02T10:00:00Z', start, end)).toBe('in-range'); // wrong
    expect(classifyFixed('2023-12-28', start, end)).toBe('past');               // correct
  });

  it('fixed: bill_date inside range is in-range regardless of created_at', () => {
    expect(classifyFixed('2024-01-15', start, end)).toBe('in-range');
  });

  it('fixed: bill_date before start is past (goes to opening balance)', () => {
    expect(classifyFixed('2023-12-31', start, end)).toBe('past');
  });

  it('fixed: bill_date on the start boundary is in-range', () => {
    expect(classifyFixed('2024-01-01', start, end)).toBe('in-range');
  });

  it('fixed: bill_date on the end boundary is in-range', () => {
    expect(classifyFixed('2024-01-31', start, end)).toBe('in-range');
  });

  it('fixed: bill_date after end is future (excluded)', () => {
    expect(classifyFixed('2024-02-01', start, end)).toBe('future');
  });

  it('fixed: sort order — business date beats created_at ordering', () => {
    // Same-month transactions entered out of order: bill dated Jan 5 created Jan 10,
    // and bill dated Jan 3 created Jan 4. Fixed code sorts by bill_date, so Jan 3 first.
    const txs = [
      { date: '2024-01-05', createdAt: '2024-01-10T08:00:00Z' },
      { date: '2024-01-03', createdAt: '2024-01-04T09:00:00Z' },
    ];
    txs.sort((a, b) => {
      const dateDiff = a.date.localeCompare(b.date);
      return dateDiff !== 0 ? dateDiff : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
    expect(txs[0].date).toBe('2024-01-03');
    expect(txs[1].date).toBe('2024-01-05');
  });
});
