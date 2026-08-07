import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { CartItem } from '../types';
import { getLocalDateString } from '@/lib/utils';

const MAX_BILLING_DRAFTS = 5;

type DraftFields = {
  items: CartItem[];
  farmerId: string | null;
  farmerName: string | null;
  farmerTotalDue: number;
  farmerCreditLimit: number;
  gstEnabled: boolean;
  discountAmount: number;
  settlementDiscountAmount: number;
  amountPaid: number;
  paymentType: string;
  upiRef: string;
  chequeNumber: string;
  notes: string;
  billDate: string;
  isEstimate: boolean;
};

export interface BillingDraft extends DraftFields {
  id: string;
  label: string;
  step: 'items' | 'payment' | 'review';
  isDirty: boolean;
}

interface CartState extends DraftFields {
  drafts: BillingDraft[];
  activeDraftId: string;
  nextDraftNumber: number;
  setActiveDraft: (draftId: string) => void;
  createDraft: () => boolean;
  closeDraft: (draftId: string) => void;
  completeActiveDraft: () => void;
  setActiveDraftStep: (step: BillingDraft['step']) => void;
  setFarmer: (id: string | null, name: string | null, totalDue?: number, creditLimit?: number) => void;
  addItem: (item: CartItem) => void;
  updateQuantity: (inventoryId: string, lotId: string | null | undefined, quantity: number) => void;
  updateItemDiscount: (inventoryId: string, lotId: string | null | undefined, discountPercentage: number) => void;
  updateItemPrice: (inventoryId: string, lotId: string | null | undefined, price: number) => void;
  updateItemGstRate: (inventoryId: string, lotId: string | null | undefined, rate: number) => void;
  removeItem: (inventoryId: string, lotId?: string | null) => void;
  switchItemLot: (inventoryId: string, oldLotId: string | null | undefined, newLotData: { lot_id: string; batch_number: string | null; expiry_date: string | null; mrp: number; unit_price: number; base_unit_price: number; max_quantity: number }) => void;
  setGstEnabled: (enabled: boolean) => void;
  initializeGstEnabled: (enabled: boolean) => void;
  setDiscount: (amount: number) => void;
  setSettlementDiscount: (amount: number) => void;
  setAmountPaid: (amount: number) => void;
  setPaymentType: (type: string) => void;
  setUpiRef: (ref: string) => void;
  setChequeNumber: (cheque: string) => void;
  setNotes: (notes: string) => void;
  setBillDate: (date: string) => void;
  initializeBillDate: (date: string) => void;
  setIsEstimate: (v: boolean) => void;
  clearItems: () => void;
  clearCart: () => void;
}

const getItemKey = (inventoryId: string, lotId?: string | null) => lotId ? `${inventoryId}_${lotId}` : inventoryId;
const getCartItemKey = (item: CartItem) => getItemKey(item.inventory_id, item.lot_id);

const emptyDraftFields = (): DraftFields => ({
  items: [],
  farmerId: null,
  farmerName: null,
  farmerTotalDue: 0,
  farmerCreditLimit: 0,
  gstEnabled: true,
  discountAmount: 0,
  settlementDiscountAmount: 0,
  amountPaid: 0,
  paymentType: 'cash',
  upiRef: '',
  chequeNumber: '',
  notes: '',
  billDate: getLocalDateString(),
  isEstimate: false,
});

const createDraft = (number: number): BillingDraft => ({
  id: crypto.randomUUID(),
  label: `Invoice ${number}`,
  step: 'items',
  isDirty: false,
  ...emptyDraftFields(),
});

const toActiveFields = (draft: BillingDraft): DraftFields => ({
  items: draft.items,
  farmerId: draft.farmerId,
  farmerName: draft.farmerName,
  farmerTotalDue: draft.farmerTotalDue,
  farmerCreditLimit: draft.farmerCreditLimit,
  gstEnabled: draft.gstEnabled,
  discountAmount: draft.discountAmount,
  settlementDiscountAmount: draft.settlementDiscountAmount,
  amountPaid: draft.amountPaid,
  paymentType: draft.paymentType,
  upiRef: draft.upiRef,
  chequeNumber: draft.chequeNumber,
  notes: draft.notes,
  billDate: draft.billDate,
  isEstimate: draft.isEstimate,
});

const initialDraft = createDraft(1);
const initialState = {
  drafts: [initialDraft],
  activeDraftId: initialDraft.id,
  nextDraftNumber: 2,
  ...toActiveFields(initialDraft),
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => {
      const updateActiveDraft = (updater: (draft: BillingDraft) => BillingDraft, dirtyMode: 'mark' | 'preserve' | 'reset' = 'mark') => {
        set((state) => {
          const current = state.drafts.find((draft) => draft.id === state.activeDraftId);
          if (!current) return state;
          const updated = {
            ...updater(current),
            isDirty: dirtyMode === 'mark' ? true : dirtyMode === 'reset' ? false : current.isDirty,
          };
          return {
            drafts: state.drafts.map((draft) => draft.id === updated.id ? updated : draft),
            ...toActiveFields(updated),
          };
        });
      };

      return {
        ...initialState,
        setActiveDraft: (draftId) => set((state) => {
          const draft = state.drafts.find((candidate) => candidate.id === draftId);
          return draft ? { activeDraftId: draftId, ...toActiveFields(draft) } : state;
        }),
        createDraft: () => {
          if (get().drafts.length >= MAX_BILLING_DRAFTS) return false;
          set((state) => {
            const draft = createDraft(state.nextDraftNumber);
            return {
              drafts: [...state.drafts, draft],
              activeDraftId: draft.id,
              nextDraftNumber: state.nextDraftNumber + 1,
              ...toActiveFields(draft),
            };
          });
          return true;
        },
        closeDraft: (draftId) => set((state) => {
          const index = state.drafts.findIndex((draft) => draft.id === draftId);
          if (index < 0) return state;
          if (state.drafts.length === 1) {
            const replacement = createDraft(state.nextDraftNumber);
            return {
              drafts: [replacement],
              activeDraftId: replacement.id,
              nextDraftNumber: state.nextDraftNumber + 1,
              ...toActiveFields(replacement),
            };
          }
          const drafts = state.drafts.filter((draft) => draft.id !== draftId);
          const activeDraft = draftId === state.activeDraftId
            ? drafts[Math.min(index, drafts.length - 1)]
            : drafts.find((draft) => draft.id === state.activeDraftId)!;
          return { drafts, activeDraftId: activeDraft.id, ...toActiveFields(activeDraft) };
        }),
        completeActiveDraft: () => set((state) => {
          const index = state.drafts.findIndex((draft) => draft.id === state.activeDraftId);
          const remaining = state.drafts.filter((draft) => draft.id !== state.activeDraftId);
          const nextDraft = remaining[index] || remaining[index - 1];
          if (nextDraft) {
            return { drafts: remaining, activeDraftId: nextDraft.id, ...toActiveFields(nextDraft) };
          }
          const replacement = createDraft(state.nextDraftNumber);
          return {
            drafts: [replacement],
            activeDraftId: replacement.id,
            nextDraftNumber: state.nextDraftNumber + 1,
            ...toActiveFields(replacement),
          };
        }),
        setActiveDraftStep: (step) => updateActiveDraft((draft) => ({ ...draft, step }), 'preserve'),
        setFarmer: (id, name, totalDue = 0, creditLimit = 0) =>
          updateActiveDraft((draft) => ({ ...draft, farmerId: id, farmerName: name, farmerTotalDue: totalDue, farmerCreditLimit: creditLimit })),
        addItem: (item) => updateActiveDraft((draft) => {
          const itemKey = getCartItemKey(item);
          const existing = draft.items.find((candidate) => getCartItemKey(candidate) === itemKey);
          return {
            ...draft,
            items: existing
              ? draft.items.map((candidate) => getCartItemKey(candidate) === itemKey ? { ...candidate, quantity: Math.min(candidate.quantity + item.quantity, candidate.max_quantity) } : candidate)
              : [...draft.items, item],
          };
        }),
        updateQuantity: (inventoryId, lotId, quantity) => updateActiveDraft((draft) => {
          const targetKey = getItemKey(inventoryId, lotId);
          return { ...draft, items: draft.items.map((item) => getCartItemKey(item) === targetKey ? { ...item, quantity: Math.min(Math.max(1, quantity), item.max_quantity) } : item) };
        }),
        updateItemDiscount: (inventoryId, lotId, discountPercentage) => updateActiveDraft((draft) => {
          const targetKey = getItemKey(inventoryId, lotId);
          const discount = Math.min(Math.max(0, discountPercentage), 100);
          return { ...draft, items: draft.items.map((item) => getCartItemKey(item) === targetKey ? { ...item, discount_percentage: discount, farmer_discount_percentage: discount, discount_source: 'manual', discount_label: `Manual ${discount}%` } : item) };
        }),
        updateItemPrice: (inventoryId, lotId, price) => updateActiveDraft((draft) => {
          const targetKey = getItemKey(inventoryId, lotId);
          return { ...draft, items: draft.items.map((item) => getCartItemKey(item) === targetKey ? { ...item, base_unit_price: price, unit_price: price, discount_percentage: 0, farmer_discount_percentage: 0, discount_source: undefined, discount_label: undefined } : item) };
        }),
        updateItemGstRate: (inventoryId, lotId, rate) => updateActiveDraft((draft) => {
          const targetKey = getItemKey(inventoryId, lotId);
          return { ...draft, items: draft.items.map((item) => getCartItemKey(item) === targetKey ? { ...item, gst_rate: Math.min(Math.max(0, rate), 100) } : item) };
        }),
        removeItem: (inventoryId, lotId) => updateActiveDraft((draft) => ({ ...draft, items: draft.items.filter((item) => getCartItemKey(item) !== getItemKey(inventoryId, lotId)) })),
        switchItemLot: (inventoryId, oldLotId, newLotData) => updateActiveDraft((draft) => {
          const targetKey = getItemKey(inventoryId, oldLotId);
          const newTargetKey = getItemKey(inventoryId, newLotData.lot_id);
          const existing = draft.items.find((item) => getCartItemKey(item) === newTargetKey && targetKey !== newTargetKey);
          if (existing) {
            const oldItem = draft.items.find((item) => getCartItemKey(item) === targetKey);
            return { ...draft, items: draft.items.map((item) => getCartItemKey(item) === newTargetKey ? { ...item, quantity: Math.min(item.quantity + (oldItem?.quantity || 0), item.max_quantity) } : item).filter((item) => getCartItemKey(item) !== targetKey) };
          }
          return { ...draft, items: draft.items.map((item) => getCartItemKey(item) === targetKey ? { ...item, ...newLotData, quantity: Math.min(item.quantity, newLotData.max_quantity) } : item) };
        }),
        setGstEnabled: (gstEnabled) => updateActiveDraft((draft) => ({ ...draft, gstEnabled })),
        initializeGstEnabled: (gstEnabled) => updateActiveDraft((draft) => ({ ...draft, gstEnabled }), 'preserve'),
        setDiscount: (discountAmount) => updateActiveDraft((draft) => ({ ...draft, discountAmount })),
        setSettlementDiscount: (settlementDiscountAmount) => updateActiveDraft((draft) => ({ ...draft, settlementDiscountAmount })),
        setAmountPaid: (amountPaid) => updateActiveDraft((draft) => ({ ...draft, amountPaid })),
        setPaymentType: (paymentType) => updateActiveDraft((draft) => ({ ...draft, paymentType })),
        setUpiRef: (upiRef) => updateActiveDraft((draft) => ({ ...draft, upiRef })),
        setChequeNumber: (chequeNumber) => updateActiveDraft((draft) => ({ ...draft, chequeNumber })),
        setNotes: (notes) => updateActiveDraft((draft) => ({ ...draft, notes })),
        setBillDate: (billDate) => updateActiveDraft((draft) => ({ ...draft, billDate })),
        setIsEstimate: (v) => set((s) => {
          const updatedDrafts = s.drafts.map((d) =>
            d.id === s.activeDraftId ? { ...d, isEstimate: v, isDirty: true } : d
          );
          return { ...s, drafts: updatedDrafts, isEstimate: v };
        }),
        initializeBillDate: (billDate) => updateActiveDraft((draft) => ({ ...draft, billDate }), 'preserve'),
        clearItems: () => updateActiveDraft((draft) => ({ ...draft, items: [], farmerId: null, farmerName: null, farmerTotalDue: 0, farmerCreditLimit: 0, discountAmount: 0, settlementDiscountAmount: 0, amountPaid: 0, paymentType: 'cash', upiRef: '', chequeNumber: '', notes: '' })),
        clearCart: () => updateActiveDraft((draft) => ({ ...draft, ...emptyDraftFields(), step: 'items' }), 'reset'),
      };
    },
    {
      name: 'aqua-cart',
      version: 2,
      storage: createJSONStorage(() => sessionStorage),
      migrate: (persistedState: any) => {
        if (Array.isArray(persistedState?.drafts) && persistedState.activeDraftId) return persistedState;
        const legacyDraft: BillingDraft = {
          id: crypto.randomUUID(),
          label: 'Invoice 1',
          step: 'items',
          isDirty: Boolean(persistedState?.items?.length || persistedState?.farmerId || persistedState?.amountPaid || persistedState?.notes),
          ...emptyDraftFields(),
          ...persistedState,
        };
        return { drafts: [legacyDraft], activeDraftId: legacyDraft.id, nextDraftNumber: 2, ...toActiveFields(legacyDraft) };
      },
      partialize: (state) => ({
        drafts: state.drafts,
        activeDraftId: state.activeDraftId,
        nextDraftNumber: state.nextDraftNumber,
        ...toActiveFields(state.drafts.find((draft) => draft.id === state.activeDraftId) || state.drafts[0]),
      }),
    }
  )
);
