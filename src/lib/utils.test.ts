import { describe, it, expect } from 'vitest';
import { formatCurrency, getDaysOverdue, estimateHarvestDate } from './utils';

describe('Utility Functions', () => {
  it('formats currency correctly for INR', () => {
    expect(formatCurrency(100000)).toBe('₹1,00,000.00');
    expect(formatCurrency(0)).toBe('₹0.00');
  });

  it('calculates overdue days correctly', () => {
    const today = new Date();
    
    const tenDaysAgo = new Date(today);
    tenDaysAgo.setDate(today.getDate() - 10);
    
    // Test date format strings too
    expect(getDaysOverdue(tenDaysAgo.toISOString())).toBeGreaterThanOrEqual(9);
  });

  it('estimates harvest date as exactly 120 days from stocking', () => {
    const stockingDate = new Date('2024-01-01');
    const estimated = estimateHarvestDate(stockingDate);
    
    const diffTime = Math.abs(estimated.getTime() - stockingDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    expect(diffDays).toBe(120);
  });
});
