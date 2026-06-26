import { InventoryItem } from '../types';

export const isMedicineProduct = (type?: string | null) => {
  const normalized = (type || '').toLowerCase();
  return normalized.includes('medicine') || normalized.includes('medic');
};

export const getInventoryBasePrice = (item: InventoryItem) =>
  Number(item.mrp || item.selling_price || item.product.default_price || 0);

export const getInventoryDiscountPercentage = (item: InventoryItem) =>
  Math.min(
    Math.max(
      Number(item.medicine_discount_percentage ?? item.product.medicine_discount_percentage ?? 0),
      0
    ),
    100
  );

export const getInventoryDisplayPrice = (item: InventoryItem) => {
  const basePrice = getInventoryBasePrice(item);
  if (!isMedicineProduct(item.product.type)) return basePrice;

  const discount = getInventoryDiscountPercentage(item);
  return Number((basePrice * (1 - discount / 100)).toFixed(2));
};
