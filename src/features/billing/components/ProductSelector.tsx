import React, { useMemo, useState } from 'react';
import { ChevronRight, Package2, Pill, Plus, Minus, User, Wheat, Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Modal, Button, SearchBar, Input } from '@/components/ui';
import { useInventory, useProducts } from '@/features/inventory/hooks/useInventory';
import { InventoryItem } from '@/features/inventory/types';
import { Product } from '@/types/database';
import { formatCurrency } from '@/lib/utils';
import { useCartStore } from '../stores/cartStore';
import { FarmerSelector } from './FarmerSelector';
import { useFarmers } from '@/features/farmers/hooks/useFarmers';

interface ProductSelectorProps {
  onNext: () => void;
}

type ProductTypeFilter = 'feed' | 'medicine';

const normalizeType = (type?: string | null): ProductTypeFilter => {
  const normalized = (type || '').toLowerCase();
  return normalized.includes('medicine') || normalized.includes('medic') ? 'medicine' : 'feed';
};

const getLineTotal = (item: { base_unit_price: number; discount_percentage: number; quantity: number }) => {
  const unitPrice = Number((item.base_unit_price * (1 - item.discount_percentage / 100)).toFixed(2));
  return unitPrice * item.quantity;
};

const ProductIcon: React.FC<{ type?: string | null; className?: string }> = ({ type, className }) => {
  const normalized = normalizeType(type);
  const Icon = normalized === 'medicine' ? Pill : Wheat;
  return (
    <span className={normalized === 'medicine' ? `billing-product-icon billing-product-icon--medicine ${className || ''}` : `billing-product-icon billing-product-icon--feed ${className || ''}`}>
      <Icon className="h-5 w-5" />
    </span>
  );
};

export const ProductSelector: React.FC<ProductSelectorProps> = ({ onNext }) => {
  const { t } = useTranslation();
  const { data: inventory = [] } = useInventory();
  const { data: products = [] } = useProducts();
  const { data: farmers } = useFarmers();
  const {
    items,
    farmerName,
    farmerId,
    addItem,
    updateQuantity,
    removeItem,
    clearItems,
    updateItemPrice,
    updateItemDiscount,
  } = useCartStore();
  const [search, setSearch] = useState('');
  const [showFarmerModal, setShowFarmerModal] = useState(false);
  const [sheetType, setSheetType] = useState<ProductTypeFilter | null>(null);
  
  const [isEditingList, setIsEditingList] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<string>('');
  const [editDiscount, setEditDiscount] = useState<string>('');

  const handleEditItem = (item: any) => {
    setEditingItemId(item.inventory_id);
    setEditPrice(item.base_unit_price.toString());
    setEditDiscount(item.discount_percentage.toString());
  };

  const handleSaveEdit = () => {
    if (editingItemId) {
      updateItemPrice(editingItemId, Number(editPrice) || 0);
      updateItemDiscount(editingItemId, Number(editDiscount) || 0);
      setEditingItemId(null);
    }
  };

  const selectedFarmer = useMemo(() => farmers?.find(f => f.id === farmerId), [farmers, farmerId]);

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + getLineTotal(item), 0);
    const count = items.reduce((sum, item) => sum + item.quantity, 0);
    return { subtotal, count };
  }, [items]);

  const typeCounts = useMemo(() => {
    const feed = inventory.filter((item) => normalizeType(item.product.type) === 'feed').length;
    const medicine = inventory.filter((item) => normalizeType(item.product.type) === 'medicine').length;
    return { feed, medicine };
  }, [inventory]);

  const filterInventory = (type: ProductTypeFilter) =>
    inventory.filter((item) => {
      const query = search.toLowerCase();
      const matchesSearch =
        item.product.name.toLowerCase().includes(query) ||
        item.product.company?.toLowerCase().includes(query);
      return matchesSearch && normalizeType(item.product.type) === type;
    });

  const filterCatalog = (type: ProductTypeFilter) =>
    products.filter((product) => {
      const query = search.toLowerCase();
      const matchesSearch =
        product.name.toLowerCase().includes(query) ||
        product.company?.toLowerCase().includes(query);
      return matchesSearch && normalizeType(product.type) === type;
    });

  const sheetInventory = useMemo(() => (sheetType ? filterInventory(sheetType) : []), [inventory, search, sheetType]);
  const sheetCatalog = useMemo(() => (sheetType ? filterCatalog(sheetType) : []), [products, search, sheetType]);

  const handleAdd = (item: InventoryItem) => {
    if (item.quantity_in_stock <= 0) {
      toast.error(t('billing.outOfStock', 'This product is out of stock.'));
      return;
    }

    const cartQuantity = items.find((cartItem) => cartItem.inventory_id === item.id)?.quantity ?? 0;
    if (cartQuantity >= item.quantity_in_stock) {
      toast.error(t('billing.maxStockReached', 'You have reached the available stock.'));
      return;
    }

    addItem({
      inventory_id: item.id,
      product_id: item.product_id,
      product_name: item.product.name,
      hsn_code: item.product.hsn_code,
      product_type: item.product.type,
      quantity: 1,
      base_unit_price: item.selling_price || item.product.default_price || 0,
      unit_price: item.selling_price || item.product.default_price || 0,
      gst_rate: item.product.gst_rate,
      discount_percentage: normalizeType(item.product.type) === 'medicine' ? Number(item.medicine_discount_percentage || 0) : 0,
      mrp: item.mrp || 0,
      expiry_date: item.expiry_date || null,
      max_quantity: item.quantity_in_stock,
      unit: item.product.unit,
    });
  };

  const ProductCard = ({ item }: { item: InventoryItem }) => {
    const price = item.selling_price || item.product.default_price || 0;
    const outOfStock = item.quantity_in_stock <= 0;
    const cartItem = items.find((cartItem) => cartItem.inventory_id === item.id);
    const cartQty = cartItem?.quantity ?? 0;

    return (
      <div className="billing-picker-row">
        <ProductIcon type={item.product.type} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-black text-slate-950">{item.product.name}</div>
          <div className="mt-0.5 truncate text-xs font-semibold text-slate-500">
            {item.product.company || 'No company'} · {formatCurrency(price)}/{item.product.unit}
          </div>
        </div>
        {cartQty > 0 ? (
          <div className="billing-qty-control">
            <button type="button" onClick={() => cartQty === 1 ? removeItem(item.id) : updateQuantity(item.id, cartQty - 1)} aria-label="Decrease quantity">
              <Minus className="h-5 w-5" />
            </button>
            <span>{cartQty}</span>
            <button type="button" disabled={cartQty >= item.quantity_in_stock} onClick={() => updateQuantity(item.id, cartQty + 1)} aria-label="Increase quantity">
              <Plus className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <Button 
            type="button" 
            className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-transparent px-4 font-bold shadow-sm"
            size="sm" 
            onClick={() => handleAdd(item)} 
            disabled={outOfStock}
          >
            {outOfStock ? 'Out' : 'Add'}
          </Button>
        )}
      </div>
    );
  };

  const CatalogCard = ({ product }: { product: Product }) => (
    <div className="billing-picker-row opacity-70">
      <ProductIcon type={product.type} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-black text-slate-950">{product.name}</div>
        <div className="mt-0.5 truncate text-xs font-semibold text-slate-500">
          {product.company || 'No company'} · {formatCurrency(product.default_price || 0)}
        </div>
      </div>
      <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">Not stocked</span>
    </div>
  );

  const renderProductList = () => {
    if (sheetInventory.length > 0) {
      return <div className="space-y-2">{sheetInventory.map((item) => <ProductCard key={item.id} item={item} />)}</div>;
    }

    if (inventory.length === 0 && sheetCatalog.length > 0) {
      return <div className="space-y-2">{sheetCatalog.map((product) => <CatalogCard key={product.id} product={product} />)}</div>;
    }

    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm font-semibold text-slate-500">
        <Package2 className="mx-auto mb-3 h-6 w-6 text-slate-400" />
        {t('common.noResults', 'No results found')}
      </div>
    );
  };

  const quickCards = [
    { key: 'feed' as const, label: 'Feed', count: typeCounts.feed },
    { key: 'medicine' as const, label: 'Medicine', count: typeCounts.medicine },
  ];

  return (
    <div className="billing-step-content">
      <section className="billing-customer-card">
        <div className="flex min-w-0 items-center gap-3">
          <span className="billing-customer-card__icon overflow-hidden">
            {selectedFarmer?.image_url ? (
              <img src={selectedFarmer.image_url} alt={farmerName || 'Customer'} className="h-full w-full object-cover" />
            ) : (
              <User className="h-6 w-6" />
            )}
          </span>
          <div className="min-w-0">
            <div className="truncate text-xl font-black text-slate-950 tracking-tight">{farmerName || 'Walk-in Customer'}</div>
            {selectedFarmer?.village && (
              <div className="truncate text-sm font-semibold text-slate-500">{selectedFarmer.village}</div>
            )}
          </div>
        </div>
        <button type="button" onClick={() => setShowFarmerModal(true)} className="billing-soft-button">
          Change
        </button>
      </section>

      <section className="billing-quick-section">
        <h2 className="billing-section-title">Quick Add</h2>
        <div className="billing-quick-grid">
          {quickCards.map((card) => (
            <button
              key={card.key}
              type="button"
              onClick={() => setSheetType(card.key)}
              className={card.key === 'feed' ? 'billing-quick-card billing-quick-card--feed' : 'billing-quick-card billing-quick-card--medicine'}
            >
              <ProductIcon type={card.key} />
              <div className="min-w-0 flex-1 text-left">
                <div className="text-lg font-black text-slate-950">{card.label}</div>
                <div className="text-sm font-semibold text-slate-500">{card.count} items</div>
              </div>
              <ChevronRight className="h-5 w-5 text-primary" />
            </button>
          ))}
        </div>
      </section>

      <section className="billing-items-section">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="billing-section-title mb-0">Selected Items ({items.length})</h2>
          {items.length > 0 ? (
            <button type="button" onClick={() => setIsEditingList(!isEditingList)} className="text-sm font-black text-primary">
              {isEditingList ? 'Done' : 'Edit'}
            </button>
          ) : null}
        </div>

        <div className="billing-selected-list">
          {items.length ? (
            <>
              <div className="billing-selected-list__head !grid-cols-[1fr_6rem_5.5rem]">
                <span>Item</span>
                <span className="text-center">{isEditingList ? 'Action' : 'Qty'}</span>
                <span className="text-right">Amount</span>
              </div>
              {items.map((item) => {
                const unitPrice = Number((item.base_unit_price * (1 - item.discount_percentage / 100)).toFixed(2));
                return (
                  <div key={item.inventory_id} className="billing-selected-list__row !grid-cols-[1fr_6rem_5.5rem]">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-slate-950">{item.product_name}</div>
                      <div className="truncate text-xs font-semibold text-slate-600">
                        {item.quantity} {item.unit || 'unit'} × {formatCurrency(unitPrice)}
                        {item.discount_percentage > 0 && ` (-${item.discount_percentage}%)`}
                      </div>
                    </div>
                    <div className="justify-self-center">
                      {isEditingList ? (
                        <button
                          type="button"
                          onClick={() => handleEditItem(item)}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/20"
                          aria-label="Edit item"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      ) : (
                        <div className="billing-qty-control billing-qty-control--sm">
                          <button
                            type="button"
                            onClick={() => item.quantity === 1 ? removeItem(item.inventory_id) : updateQuantity(item.inventory_id, item.quantity - 1)}
                            aria-label="Decrease quantity"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span>{item.quantity}</span>
                          <button
                            type="button"
                            disabled={item.quantity >= item.max_quantity}
                            onClick={() => updateQuantity(item.inventory_id, item.quantity + 1)}
                            aria-label="Increase quantity"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="text-right text-sm font-black text-slate-950 justify-self-end">
                      {formatCurrency(getLineTotal(item))}
                    </div>
                  </div>
                );
              })}
            </>
          ) : (
            <div className="px-4 py-8 text-center text-sm font-semibold text-slate-500">
              Select feed or medicine to start the invoice.
            </div>
          )}
        </div>
      </section>

      <section className="billing-total-card">
        <div className="text-sm font-black text-slate-600">{totals.count} {totals.count === 1 ? 'item' : 'items'} selected</div>
        <div className="text-right">
          <div className="text-sm font-bold text-slate-600">Total Amount</div>
          <div className="text-2xl font-black text-slate-950">{formatCurrency(totals.subtotal)}</div>
        </div>
      </section>

      <footer className="billing-bottom-bar">
        <div>
          <div className="text-2xl font-black leading-tight">{formatCurrency(totals.subtotal)}</div>
          <div className="text-sm font-black">{totals.count} {totals.count === 1 ? 'item' : 'items'}</div>
        </div>
        <button type="button" disabled={items.length === 0} onClick={onNext} className="billing-bottom-bar__primary billing-bottom-bar__primary--light">
          Continue to Payment
          <ChevronRight className="h-6 w-6" />
        </button>
      </footer>

      <Modal
        isOpen={showFarmerModal}
        onClose={() => setShowFarmerModal(false)}
        title={t('billing.selectCustomer', 'Select customer')}
        className="max-w-lg"
      >
        <FarmerSelector onSelect={() => setShowFarmerModal(false)} />
      </Modal>

      <Modal
        isOpen={!!sheetType}
        onClose={() => setSheetType(null)}
        title={sheetType === 'medicine' ? 'Select medicine' : 'Select feed'}
        className="max-w-lg"
      >
        <div className="space-y-3">
          <SearchBar value={search} onChange={setSearch} placeholder={t('billing.searchProducts', 'Search products')} showVoicePlaceholder />
          {renderProductList()}
        </div>
      </Modal>

      <Modal
        isOpen={!!editingItemId}
        onClose={() => setEditingItemId(null)}
        title="Edit Item"
      >
        <div className="p-4 space-y-4">
          <Input
            label="Price"
            type="number"
            value={editPrice}
            onChange={(e) => setEditPrice(e.target.value)}
            placeholder="Enter price"
            min={0}
            step="0.01"
          />
          <Input
            label="Discount (%)"
            type="number"
            value={editDiscount}
            onChange={(e) => setEditDiscount(e.target.value)}
            placeholder="Enter discount percentage"
            min={0}
            max={100}
          />
        </div>
        <div className="flex gap-3 p-4 border-t border-slate-100 bg-slate-50">
          <Button variant="outline" className="flex-1" onClick={() => setEditingItemId(null)}>Cancel</Button>
          <Button className="flex-1" onClick={handleSaveEdit}>Save</Button>
        </div>
      </Modal>
    </div>
  );
};

export default ProductSelector;
