import { describe, expect, it } from 'vitest';
import { getStaffFeatureMode, STAFF_DEFAULT_PERMISSIONS } from './staffAccess';

describe('new inventory action permission defaults', () => {
  it('gives brand-new staff (no permissions object at all) the documented defaults', () => {
    expect(getStaffFeatureMode('inventoryAddStock', undefined, true)).toBe('hidden');
    expect(getStaffFeatureMode('inventoryEditPrice', undefined, true)).toBe('visible');
    expect(getStaffFeatureMode('inventoryViewCostPrice', undefined, true)).toBe('hidden');
    expect(getStaffFeatureMode('inventoryAdjustStock', undefined, true)).toBe('visible');
    expect(getStaffFeatureMode('inventoryDeleteProduct', undefined, true)).toBe('hidden');
  });

  it('STAFF_DEFAULT_PERMISSIONS has a value for every one of the 5 new keys', () => {
    expect(STAFF_DEFAULT_PERMISSIONS.inventoryAddStock).toBeDefined();
    expect(STAFF_DEFAULT_PERMISSIONS.inventoryEditPrice).toBeDefined();
    expect(STAFF_DEFAULT_PERMISSIONS.inventoryViewCostPrice).toBeDefined();
    expect(STAFF_DEFAULT_PERMISSIONS.inventoryAdjustStock).toBeDefined();
    expect(STAFF_DEFAULT_PERMISSIONS.inventoryDeleteProduct).toBeDefined();
  });

  it('a dealer (isStaffMode=false) always gets visible regardless of the key', () => {
    expect(getStaffFeatureMode('inventoryViewCostPrice', undefined, false)).toBe('visible');
  });
});
