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
  updateQuantity: (inventoryId: string, lotId: string | null | undefined, quantity: number) => void;
  updateItemDiscount: (inventoryId: string, lotId: string | null | undefined, discountPercentage: number) => void;
  updateItemPrice: (inventoryId: string, lotId: string | null | undefined, price: number) => void;
  updateItemGstRate: (inventoryId: string, lotId: string | null | undefined, rate: number) => void;
  removeItem: (inventoryId: string, lotId?: string | null) => void;
  switchItemLot: (inventoryId: string, oldLotId: string | null | undefined, newLotData: { lot_id: string, batch_number: string | null, expiry_date: string | null, mrp: number, unit_price: number, base_unit_price: number, max_quantity: number }) => void;
  setGstEnabled: (enabled: boolean) => void;
  setDiscount: (amount: number) => void;
  setAmountPaid: (amount: number) => void;
  setPaymentType: (type: string) => void;
  clearItems: () => void;
  clearCart: () => void;
}

const getItemKey = (inventoryId: string, lotId?: string | null) => lotId ? `${inventoryId}_${lotId}` : inventoryId;
const getCartItemKey = (item: CartItem) => getItemKey(item.inventory_id, item.lot_id);

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
      const itemKey = getCartItemKey(item);
      const existing = state.items.find((i) => getCartItemKey(i) === itemKey);
      if (existing) {
        return {
          items: state.items.map((i) =>
            getCartItemKey(i) === itemKey
              ? { ...i, quantity: Math.min(i.quantity + item.quantity, i.max_quantity) }
              : i
          ),
        };
      }
      return { items: [...state.items, item] };
    }),

  updateQuantity: (inventoryId, lotId, quantity) =>
    set((state) => {
      const targetKey = getItemKey(inventoryId, lotId);
      return {
        items: state.items.map((i) =>
          getCartItemKey(i) === targetKey ? { ...i, quantity: Math.min(Math.max(1, quantity), i.max_quantity) } : i
        ),
      };
    }),

  updateItemDiscount: (inventoryId, lotId, discountPercentage) =>
    set((state) => {
      const targetKey = getItemKey(inventoryId, lotId);
      return {
        items: state.items.map((item) =>
          getCartItemKey(item) === targetKey
            ? {
                ...item,
                discount_percentage: Math.min(Math.max(0, discountPercentage), 100),
                farmer_discount_percentage: Math.min(Math.max(0, discountPercentage), 100),
                discount_source: 'manual',
                discount_label: `Manual ${Math.min(Math.max(0, discountPercentage), 100)}%`,
              }
            : item
        ),
      };
    }),

  updateItemPrice: (inventoryId, lotId, price) =>
    set((state) => {
      const targetKey = getItemKey(inventoryId, lotId);
      return {
        items: state.items.map((item) =>
          getCartItemKey(item) === targetKey
            ? { ...item, base_unit_price: price, unit_price: price }
            : item
        ),
      };
    }),

  updateItemGstRate: (inventoryId, lotId, rate) =>
    set((state) => {
      const targetKey = getItemKey(inventoryId, lotId);
      return {
        items: state.items.map((item) =>
          getCartItemKey(item) === targetKey
            ? { ...item, gst_rate: Math.min(Math.max(0, rate), 100) }
            : item
        ),
      };
    }),

  removeItem: (inventoryId, lotId) =>
    set((state) => {
      const targetKey = getItemKey(inventoryId, lotId);
      return {
        items: state.items.filter((i) => getCartItemKey(i) !== targetKey),
      };
    }),

  switchItemLot: (inventoryId, oldLotId, newLotData) =>
    set((state) => {
      const targetKey = getItemKey(inventoryId, oldLotId);
      // Check if the new lot is already in the cart to merge quantities
      const newTargetKey = getItemKey(inventoryId, newLotData.lot_id);
      
      const existingNewLotItem = state.items.find(i => getCartItemKey(i) === newTargetKey && targetKey !== newTargetKey);
      
      if (existingNewLotItem) {
        // If the lot we're switching to is already in the cart, merge quantities and remove old item
        const oldItem = state.items.find(i => getCartItemKey(i) === targetKey);
        const qtyToAdd = oldItem ? oldItem.quantity : 0;
        
        return {
          items: state.items.map(i => {
            if (getCartItemKey(i) === newTargetKey) {
              return { ...i, quantity: Math.min(i.quantity + qtyToAdd, i.max_quantity) };
            }
            return i;
          }).filter(i => getCartItemKey(i) !== targetKey)
        };
      }
      
      // Otherwise just mutate the current item to use new lot data
      return {
        items: state.items.map((item) =>
          getCartItemKey(item) === targetKey
            ? { 
                ...item, 
                lot_id: newLotData.lot_id,
                batch_number: newLotData.batch_number,
                expiry_date: newLotData.expiry_date,
                mrp: newLotData.mrp,
                base_unit_price: newLotData.base_unit_price,
                unit_price: newLotData.unit_price,
                max_quantity: newLotData.max_quantity,
                quantity: Math.min(item.quantity, newLotData.max_quantity)
              }
            : item
        ),
      };
    }),

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
