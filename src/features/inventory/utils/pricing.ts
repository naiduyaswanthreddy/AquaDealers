import { InventoryItem } from '../types';
import { InventoryLot } from '@/types/database';

export const isMedicineProduct = (type?: string | null) => {
  const normalized = (type || '').toLowerCase();
  return normalized.includes('medicine') || normalized.includes('medic');
};

// FIFO order: the lot that will actually be sold next (oldest first). This is
// what billing charges, so stock pricing must read from the same lot or the
// two pages disagree whenever a lot's price differs from the item's stored default.
export const sortLotsFifo = (lots: InventoryLot[]): InventoryLot[] =>
  lots.filter((lot) => lot.remaining_quantity > 0)
    .sort((a, b) => {
      if (a.expiry_date && b.expiry_date) {
        return new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime();
      }
      const aDate = a.stock_purchases?.purchase_date || a.received_at;
      const bDate = b.stock_purchases?.purchase_date || b.received_at;
      return new Date(aDate).getTime() - new Date(bDate).getTime();
    });

export const getLotsWithStock = (item: InventoryItem): InventoryLot[] =>
  sortLotsFifo(item.inventory_lots || []);

export const pickNextSellingLot = (lots: InventoryLot[]): InventoryLot | null => {
  const sorted = sortLotsFifo(lots);
  return sorted.length > 0 ? sorted[0] : null;
};

export const getNextSellingLot = (item: InventoryItem): InventoryLot | null =>
  pickNextSellingLot(item.inventory_lots || []);

// Given FIFO-sorted lots (oldest first, see sortLotsFifo), returns the oldest one
// that isn't already fully claimed by what's in the cart. Null if every lot is
// already at capacity in the cart.
export const pickLotWithCapacity = (
  lots: InventoryLot[],
  cartQtyForLot: (lotId: string) => number
): InventoryLot | null => {
  for (const lot of lots) {
    if (cartQtyForLot(lot.id) < lot.remaining_quantity) return lot;
  }
  return null;
};

export const getInventoryBasePrice = (item: InventoryItem) => {
  const lot = getNextSellingLot(item);
  if (lot) return Number(lot.mrp || lot.selling_price || 0);
  return Number(item.mrp || item.selling_price || item.product.default_price || 0);
};

export const getInventoryDiscountPercentage = (item: InventoryItem) =>
  Math.min(
    Math.max(
      Number(item.medicine_discount_percentage ?? item.product.medicine_discount_percentage ?? 0),
      0
    ),
    100
  );

// Mirrors the price billing actually charges (ProductSelector's card price):
// the FIFO lot's own selling_price, not the item-level default recomputed
// from the item's discount %. Falls back to the old item-level formula only
// when the item has no lots at all (e.g. legacy rows with no purchase history).
export const getInventoryDisplayPrice = (item: InventoryItem) => {
  const lot = getNextSellingLot(item);
  if (lot) return Number(lot.selling_price || lot.mrp || 0);
  const basePrice = getInventoryBasePrice(item);
  const discount = getInventoryDiscountPercentage(item);
  return Number((basePrice * (1 - discount / 100)).toFixed(2));
};
