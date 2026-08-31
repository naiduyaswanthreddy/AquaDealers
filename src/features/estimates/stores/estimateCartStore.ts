// src/features/estimates/stores/estimateCartStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { getLocalDateString } from '@/lib/utils';
import type { EstimateCartItem } from '../types';

interface EstimateCartState {
  // state
  farmerId: string | null;
  farmerName: string | null;
  items: EstimateCartItem[];
  gstEnabled: boolean;
  discountType: 'amount' | 'percentage';
  discountAmount: number;
  discountPercentage: number;
  notes: string;
  estimateDate: string;
  editingEstimateId: string | null;

  // actions
  setFarmer: (id: string, name: string) => void;
  clearFarmer: () => void;
  addItem: (item: EstimateCartItem) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  updateItemDiscount: (productId: string, discountPercentage: number) => void;
  updateItemPrice: (productId: string, unitPrice: number) => void;
  setGstEnabled: (v: boolean) => void;
  setDiscountType: (v: 'amount' | 'percentage') => void;
  setDiscountAmount: (v: number) => void;
  setDiscountPercentage: (v: number) => void;
  setNotes: (v: string) => void;
  setEstimateDate: (v: string) => void;
  setEditingEstimateId: (id: string | null) => void;
  loadEstimateForEditing: (opts: {
    estimateId: string;
    farmerId: string;
    farmerName: string;
    items: EstimateCartItem[];
    discountAmount: number;
    gstEnabled: boolean;
    notes: string;
    estimateDate: string;
  }) => void;
  clearCart: () => void;
}

export const useEstimateCartStore = create<EstimateCartState>()(
  persist(
    (set, get) => ({
      farmerId: null,
      farmerName: null,
      items: [],
      gstEnabled: false,
      discountType: 'amount',
      discountAmount: 0,
      discountPercentage: 0,
      notes: '',
      estimateDate: getLocalDateString(),
      editingEstimateId: null,

      setFarmer: (id, name) => set({ farmerId: id, farmerName: name }),
      clearFarmer: () => set({ farmerId: null, farmerName: null, items: [] }),

      addItem: (item) => {
        const items = get().items;
        const existing = items.findIndex(i => i.product_id === item.product_id);
        if (existing >= 0) {
          set({
            items: items.map((i, idx) =>
              idx === existing ? { ...i, quantity: i.quantity + item.quantity } : i
            ),
          });
        } else {
          set({ items: [...items, item] });
        }
      },

      removeItem: (productId) =>
        set({ items: get().items.filter(i => i.product_id !== productId) }),

      updateQuantity: (productId, quantity) =>
        set({
          items: get().items.map(i =>
            i.product_id === productId ? { ...i, quantity } : i
          ),
        }),

      updateItemDiscount: (productId, discountPercentage) =>
        set({
          items: get().items.map(i => {
            if (i.product_id !== productId) return i;
            const unit_price = Number(
              (i.base_unit_price * (1 - discountPercentage / 100)).toFixed(2)
            );
            return { ...i, discount_percentage: discountPercentage, unit_price, discount_source: 'manual' as const };
          }),
        }),

      updateItemPrice: (productId, unitPrice) =>
        set({
          items: get().items.map(i => {
            if (i.product_id !== productId) return i;
            const base = i.base_unit_price || unitPrice;
            const discountPercentage = base > 0
              ? Number((((base - unitPrice) / base) * 100).toFixed(2))
              : 0;
            return { ...i, unit_price: unitPrice, discount_percentage: discountPercentage, discount_source: 'manual' as const };
          }),
        }),

      setGstEnabled: (v) => set({ gstEnabled: v }),
      setDiscountType: (v) => set({ discountType: v }),
      setDiscountAmount: (v) => set({ discountAmount: v }),
      setDiscountPercentage: (v) => set({ discountPercentage: v }),
      setNotes: (v) => set({ notes: v }),
      setEstimateDate: (v) => set({ estimateDate: v }),
      setEditingEstimateId: (id) => set({ editingEstimateId: id }),

      loadEstimateForEditing: (opts) =>
        set({
          editingEstimateId: opts.estimateId,
          farmerId: opts.farmerId,
          farmerName: opts.farmerName,
          items: opts.items,
          discountAmount: opts.discountAmount,
          discountType: 'amount',
          discountPercentage: 0,
          gstEnabled: opts.gstEnabled,
          notes: opts.notes,
          estimateDate: opts.estimateDate,
        }),

      clearCart: () =>
        set({
          farmerId: null,
          farmerName: null,
          items: [],
          gstEnabled: false,
          discountType: 'amount',
          discountAmount: 0,
          discountPercentage: 0,
          notes: '',
          estimateDate: getLocalDateString(),
          editingEstimateId: null,
        }),
    }),
    {
      name: 'aqua-estimate-cart',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
