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
  discountAmount: number;
  notes: string;
  estimateDate: string;

  // actions
  setFarmer: (id: string, name: string) => void;
  clearFarmer: () => void;
  addItem: (item: EstimateCartItem) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  updateItemDiscount: (productId: string, discountPercentage: number) => void;
  setGstEnabled: (v: boolean) => void;
  setDiscountAmount: (v: number) => void;
  setNotes: (v: string) => void;
  setEstimateDate: (v: string) => void;
  clearCart: () => void;
}

const defaultState = (): Omit<EstimateCartState, keyof {
  [K in keyof EstimateCartState as EstimateCartState[K] extends Function ? K : never]: never
}> => ({
  farmerId: null,
  farmerName: null,
  items: [],
  gstEnabled: true,
  discountAmount: 0,
  notes: '',
  estimateDate: getLocalDateString(),
});

export const useEstimateCartStore = create<EstimateCartState>()(
  persist(
    (set, get) => ({
      farmerId: null,
      farmerName: null,
      items: [],
      gstEnabled: true,
      discountAmount: 0,
      notes: '',
      estimateDate: getLocalDateString(),

      setFarmer: (id, name) => set({ farmerId: id, farmerName: name }),
      clearFarmer: () => set({ farmerId: null, farmerName: null, items: [] }),

      addItem: (item) => {
        const items = get().items;
        const existing = items.findIndex(i => i.product_id === item.product_id);
        if (existing >= 0) {
          // increment quantity if already in cart
          set({
            items: items.map((i, idx) =>
              idx === existing
                ? { ...i, quantity: i.quantity + item.quantity }
                : i
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

      setGstEnabled: (v) => set({ gstEnabled: v }),
      setDiscountAmount: (v) => set({ discountAmount: v }),
      setNotes: (v) => set({ notes: v }),
      setEstimateDate: (v) => set({ estimateDate: v }),

      clearCart: () =>
        set({
          farmerId: null,
          farmerName: null,
          items: [],
          gstEnabled: true,
          discountAmount: 0,
          notes: '',
          estimateDate: getLocalDateString(),
        }),
    }),
    {
      name: 'aqua-estimate-cart',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
