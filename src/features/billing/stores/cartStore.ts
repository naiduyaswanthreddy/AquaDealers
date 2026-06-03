import { create } from 'zustand';
import { CartItem } from '../types';

interface CartState {
  items: CartItem[];
  farmerId: string | null;
  farmerName: string | null;
  farmerTotalDue: number;
  farmerCreditLimit: number;
  gstEnabled: boolean;
  discountAmount: number;
  amountPaid: number;
  paymentType: string;

  setFarmer: (id: string | null, name: string | null, totalDue?: number, creditLimit?: number) => void;
  addItem: (item: CartItem) => void;
  updateQuantity: (inventoryId: string, quantity: number) => void;
  updateItemDiscount: (inventoryId: string, discountPercentage: number) => void;
  updateItemPrice: (inventoryId: string, price: number) => void;
  updateItemGstRate: (inventoryId: string, rate: number) => void;
  removeItem: (inventoryId: string) => void;
  setGstEnabled: (enabled: boolean) => void;
  setDiscount: (amount: number) => void;
  setAmountPaid: (amount: number) => void;
  setPaymentType: (type: string) => void;
  clearItems: () => void;
  clearCart: () => void;
}

export const useCartStore = create<CartState>((set) => ({
  items: [],
  farmerId: null,
  farmerName: null,
  farmerTotalDue: 0,
  farmerCreditLimit: 0,
  gstEnabled: true,
  discountAmount: 0,
  amountPaid: 0,
  paymentType: 'cash',

  setFarmer: (id, name, totalDue = 0, creditLimit = 0) =>
    set({ farmerId: id, farmerName: name, farmerTotalDue: totalDue, farmerCreditLimit: creditLimit }),

  addItem: (item) =>
    set((state) => {
      const existing = state.items.find((i) => i.inventory_id === item.inventory_id);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.inventory_id === item.inventory_id
              ? { ...i, quantity: Math.min(i.quantity + item.quantity, i.max_quantity) }
              : i
          ),
        };
      }
      return { items: [...state.items, item] };
    }),

  updateQuantity: (inventoryId, quantity) =>
    set((state) => ({
      items: state.items.map((i) =>
        i.inventory_id === inventoryId ? { ...i, quantity: Math.min(Math.max(1, quantity), i.max_quantity) } : i
      ),
    })),

  updateItemDiscount: (inventoryId, discountPercentage) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.inventory_id === inventoryId
          ? { ...item, discount_percentage: Math.min(Math.max(0, discountPercentage), 100) }
          : item
      ),
    })),

  updateItemPrice: (inventoryId, price) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.inventory_id === inventoryId
          ? { ...item, base_unit_price: price, unit_price: price }
          : item
      ),
    })),

  updateItemGstRate: (inventoryId, rate) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.inventory_id === inventoryId
          ? { ...item, gst_rate: Math.min(Math.max(0, rate), 100) }
          : item
      ),
    })),

  removeItem: (inventoryId) =>
    set((state) => ({
      items: state.items.filter((i) => i.inventory_id !== inventoryId),
    })),

  setGstEnabled: (enabled) => set({ gstEnabled: enabled }),
  setDiscount: (amount) => set({ discountAmount: amount }),
  setAmountPaid: (amount) => set({ amountPaid: amount }),
  setPaymentType: (type) => set({ paymentType: type }),
  clearItems: () =>
    set({
      items: [],
      discountAmount: 0,
      amountPaid: 0,
      paymentType: 'cash',
    }),

  clearCart: () =>
    set({
      items: [],
      farmerId: null,
      farmerName: null,
      farmerTotalDue: 0,
      farmerCreditLimit: 0,
      gstEnabled: true,
      discountAmount: 0,
      amountPaid: 0,
      paymentType: 'cash',
    }),
}));
