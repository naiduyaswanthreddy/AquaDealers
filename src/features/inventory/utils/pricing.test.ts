import { describe, expect, it } from 'vitest';
import type { InventoryItem } from '../types';
import type { InventoryLot } from '@/types/database';
import {
  getInventoryBasePrice,
  getInventoryDiscountPercentage,
  getInventoryDisplayPrice,
  getLotsWithStock,
  getNextSellingLot,
} from './pricing';

const baseLot = (overrides: Partial<InventoryLot>): InventoryLot =>
  ({
    id: 'lot',
    remaining_quantity: 10,
    quantity_received: 10,
    ...overrides,
  }) as InventoryLot;

const baseItem = (overrides: Partial<InventoryItem>): InventoryItem =>
  ({
    id: 'inv-1',
    mrp: null,
    selling_price: null,
    medicine_discount_percentage: 0,
    inventory_lots: [],
    product: { default_price: 0, medicine_discount_percentage: 0 } as any,
    ...overrides,
  }) as InventoryItem;

describe('getLotsWithStock / getNextSellingLot (FIFO order)', () => {
  it('drops lots with zero or negative remaining quantity', () => {
    const item = baseItem({
      inventory_lots: [
        baseLot({ id: 'depleted', remaining_quantity: 0 }),
        baseLot({ id: 'live', remaining_quantity: 5 }),
      ],
    });
    expect(getLotsWithStock(item).map((l) => l.id)).toEqual(['live']);
  });

  it('picks the nearest-expiry lot first when every lot has an expiry date', () => {
    const item = baseItem({
      inventory_lots: [
        baseLot({ id: 'far', expiry_date: '2027-01-01' }),
        baseLot({ id: 'near', expiry_date: '2026-06-01' }),
      ],
    });
    expect(getNextSellingLot(item)?.id).toBe('near');
  });

  it('falls back to received/purchase date when expiry is missing on either lot', () => {
    const item = baseItem({
      inventory_lots: [
        baseLot({ id: 'newer', received_at: '2026-06-10', expiry_date: '2027-01-01' }),
        baseLot({ id: 'older', received_at: '2026-06-01' }), // no expiry_date at all
      ],
    });
    // Since not *both* lots carry an expiry_date, sort must use the date fallback,
    // not expiry — the older-received lot wins regardless of the other's expiry.
    expect(getNextSellingLot(item)?.id).toBe('older');
  });

  it('prefers stock_purchases.purchase_date over received_at when both are present', () => {
    const item = baseItem({
      inventory_lots: [
        baseLot({ id: 'a', received_at: '2026-06-01', stock_purchases: { purchase_date: '2026-06-20' } as any }),
        baseLot({ id: 'b', received_at: '2026-06-15', stock_purchases: { purchase_date: '2026-06-05' } as any }),
      ],
    });
    expect(getNextSellingLot(item)?.id).toBe('b');
  });

  it('returns null when there are no lots at all', () => {
    expect(getNextSellingLot(baseItem({ inventory_lots: [] }))).toBeNull();
  });

  it('returns null when inventory_lots is undefined', () => {
    expect(getNextSellingLot(baseItem({ inventory_lots: undefined }))).toBeNull();
  });
});

describe('getInventoryBasePrice / getInventoryDisplayPrice', () => {
  it('charges the FIFO lot price, not the item-level default, once a lot exists', () => {
    const item = baseItem({
      mrp: 2330,
      selling_price: 2330,
      inventory_lots: [baseLot({ mrp: 2790, selling_price: 2375.44 })],
    });
    expect(getInventoryDisplayPrice(item)).toBe(2375.44);
    expect(getInventoryBasePrice(item)).toBe(2790);
  });

  it('falls back to the lot mrp when the lot has no selling_price', () => {
    const item = baseItem({
      inventory_lots: [baseLot({ mrp: 1000, selling_price: null })],
    });
    expect(getInventoryDisplayPrice(item)).toBe(1000);
  });

  it('falls back to the lot selling_price when the lot has no mrp (base price)', () => {
    const item = baseItem({
      inventory_lots: [baseLot({ mrp: null, selling_price: 700 })],
    });
    expect(getInventoryBasePrice(item)).toBe(700);
  });

  it('returns 0 when a lot exists but has neither price field set', () => {
    const item = baseItem({
      inventory_lots: [baseLot({ mrp: null, selling_price: null })],
    });
    expect(getInventoryDisplayPrice(item)).toBe(0);
    expect(getInventoryBasePrice(item)).toBe(0);
  });

  it('uses the item-level default with discount applied when there is no lot at all', () => {
    const item = baseItem({
      mrp: 1000,
      medicine_discount_percentage: 20,
      inventory_lots: [],
    });
    expect(getInventoryBasePrice(item)).toBe(1000);
    expect(getInventoryDisplayPrice(item)).toBe(800); // 1000 * (1 - 20%)
  });

  it('falls back through mrp -> selling_price -> product default_price when no lot', () => {
    expect(getInventoryBasePrice(baseItem({ mrp: null, selling_price: 500 }))).toBe(500);
    expect(
      getInventoryBasePrice(baseItem({ mrp: null, selling_price: null, product: { default_price: 250 } as any }))
    ).toBe(250);
  });

  it('falls back to the item default once the only lot is fully depleted', () => {
    const item = baseItem({
      selling_price: 900,
      inventory_lots: [baseLot({ remaining_quantity: 0, selling_price: 1200 })],
    });
    expect(getInventoryDisplayPrice(item)).toBe(900);
  });
});

describe('getInventoryDiscountPercentage', () => {
  it('prefers the item-level discount over the product default', () => {
    const item = baseItem({
      medicine_discount_percentage: 15,
      product: { medicine_discount_percentage: 40 } as any,
    });
    expect(getInventoryDiscountPercentage(item)).toBe(15);
  });

  it('falls back to the product-level discount when the item has none', () => {
    const item = baseItem({
      medicine_discount_percentage: undefined,
      product: { medicine_discount_percentage: 40 } as any,
    });
    expect(getInventoryDiscountPercentage(item)).toBe(40);
  });

  it('clamps out-of-range values into 0-100', () => {
    expect(getInventoryDiscountPercentage(baseItem({ medicine_discount_percentage: -10 }))).toBe(0);
    expect(getInventoryDiscountPercentage(baseItem({ medicine_discount_percentage: 150 }))).toBe(100);
  });
});
