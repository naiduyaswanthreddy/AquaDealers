import { beforeEach, describe, expect, it } from 'vitest';
import type { CartItem } from '../types';
import { useCartStore } from './cartStore';

const item: CartItem = {
  inventory_id: 'inventory-1',
  lot_id: 'lot-1',
  product_id: 'product-1',
  product_name: 'Test Feed',
  hsn_code: null,
  product_type: 'feed',
  quantity: 1,
  base_unit_price: 100,
  unit_price: 100,
  gst_rate: 0,
  discount_percentage: 0,
  max_quantity: 10,
  unit: 'bags',
};

function resetWorkspace() {
  let state = useCartStore.getState();
  while (state.drafts.length > 1) {
    state.closeDraft(state.drafts[state.drafts.length - 1].id);
    state = useCartStore.getState();
  }
  state.clearCart();
}

describe('billing draft cart store', () => {
  beforeEach(() => {
    sessionStorage.clear();
    resetWorkspace();
  });

  it('keeps customer and items isolated by invoice tab', () => {
    const firstId = useCartStore.getState().activeDraftId;
    useCartStore.getState().setFarmer('farmer-a', 'Farmer A', 100, 1000);
    useCartStore.getState().addItem(item);

    expect(useCartStore.getState().createDraft()).toBe(true);
    const secondId = useCartStore.getState().activeDraftId;
    expect(useCartStore.getState().farmerName).toBeNull();
    expect(useCartStore.getState().items).toEqual([]);

    useCartStore.getState().setFarmer('farmer-b', 'Farmer B', 0, 1000);
    useCartStore.getState().addItem({ ...item, inventory_id: 'inventory-2', product_id: 'product-2' });

    useCartStore.getState().setActiveDraft(firstId);
    expect(useCartStore.getState().farmerName).toBe('Farmer A');
    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().items[0].inventory_id).toBe('inventory-1');

    useCartStore.getState().setActiveDraft(secondId);
    expect(useCartStore.getState().farmerName).toBe('Farmer B');
    expect(useCartStore.getState().items[0].inventory_id).toBe('inventory-2');
  });

  it('removes only the completed draft and activates the next available draft', () => {
    const firstId = useCartStore.getState().activeDraftId;
    useCartStore.getState().setFarmer('farmer-a', 'Farmer A');
    useCartStore.getState().createDraft();
    const secondId = useCartStore.getState().activeDraftId;
    useCartStore.getState().setFarmer('farmer-b', 'Farmer B');

    useCartStore.getState().completeActiveDraft();

    const state = useCartStore.getState();
    expect(state.activeDraftId).toBe(firstId);
    expect(state.drafts.some((draft) => draft.id === secondId)).toBe(false);
    expect(state.farmerName).toBe('Farmer A');
  });

  it('creates a fresh invoice when the last draft is completed', () => {
    const completedId = useCartStore.getState().activeDraftId;
    useCartStore.getState().setFarmer('farmer-a', 'Farmer A');

    useCartStore.getState().completeActiveDraft();

    const state = useCartStore.getState();
    expect(state.drafts).toHaveLength(1);
    expect(state.activeDraftId).not.toBe(completedId);
    expect(state.items).toEqual([]);
    expect(state.farmerId).toBeNull();
    expect(state.drafts[0].isDirty).toBe(false);
  });
});
