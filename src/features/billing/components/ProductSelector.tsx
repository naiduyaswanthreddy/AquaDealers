import React, { useMemo, useState } from 'react';
import { ChevronRight, Package2, Pill, Plus, Minus, User, Wheat, Pencil, Trash2, Info, SlidersHorizontal, Search } from 'lucide-react';
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
    farmerTotalDue,
    farmerCreditLimit,
    gstEnabled,
    discountAmount,
    setGstEnabled,
    setDiscount,
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
  const [desktopTab, setDesktopTab] = useState<ProductTypeFilter>('feed');
  
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
    const discount = discountAmount || 0;
    const tax = gstEnabled ? (subtotal - discount) * 0.18 : 0;
    const finalTotal = subtotal - discount + tax;
    return { subtotal, count, finalTotal, tax, discount };
  }, [items, discountAmount, gstEnabled]);

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

  const desktopInventory = useMemo(() => filterInventory(desktopTab), [inventory, search, desktopTab]);
  const desktopCatalog = useMemo(() => filterCatalog(desktopTab), [products, search, desktopTab]);

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

  const renderProductList = (items: InventoryItem[], catalog: Product[], isDesktop = false) => {
    if (items.length > 0) {
      return (
        <div className="space-y-2">
          {items.map((item) => (
            isDesktop ? (
              <div key={item.id} className="flex items-center justify-between p-3 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors">
                 <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-yellow-50 flex items-center justify-center shrink-0">
                      <ProductIcon type={item.product.type} className="w-6 h-6 text-yellow-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900 truncate">{item.product.name}</div>
                      <div className="text-xs text-slate-500 flex gap-2">
                         <span>{formatCurrency(item.selling_price || item.product.default_price || 0)} / {item.product.unit || 'Bag'}</span>
                         <span className="text-blue-600 font-medium">Available: {item.quantity_in_stock} {item.product.unit || 'Bags'}</span>
                      </div>
                    </div>
                 </div>
                 <button onClick={() => handleAdd(item)} disabled={item.quantity_in_stock <= 0} className="px-4 py-2 text-sm font-bold text-blue-600 border border-slate-200 rounded-lg hover:bg-blue-50 hover:border-blue-200 transition-colors flex items-center gap-1">
                    Add <Plus className="w-4 h-4" />
                 </button>
              </div>
            ) : <ProductCard key={item.id} item={item} />
          ))}
        </div>
      );
    }

    if (items.length === 0 && catalog.length > 0) {
      return <div className="space-y-2">{catalog.map((product) => <CatalogCard key={product.id} product={product} />)}</div>;
    }

    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm font-semibold text-slate-500 flex flex-col items-center justify-center">
        <Package2 className="mb-3 h-6 w-6 text-slate-400" />
        {t('common.noResults', 'No results found')}
      </div>
    );
  };

  const quickCards = [
    { key: 'feed' as const, label: 'Feed', count: typeCounts.feed },
    { key: 'medicine' as const, label: 'Medicine', count: typeCounts.medicine },
  ];

  return (
    <>
      {/* MOBILE LAYOUT */}
      <div className="billing-step-content lg:!hidden pb-[6.5rem]">
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

        <section className="billing-total-card lg:hidden">
          <div className="text-sm font-black text-slate-600">{totals.count} {totals.count === 1 ? 'item' : 'items'} selected</div>
          <div className="text-right">
            <div className="text-sm font-bold text-slate-600">Total Amount</div>
            <div className="text-2xl font-black text-slate-950">{formatCurrency(totals.subtotal)}</div>
          </div>
        </section>
      </div>

      <footer className="billing-bottom-bar lg:!hidden">
        <div>
          <div className="text-2xl font-black leading-tight">{formatCurrency(totals.subtotal)}</div>
          <div className="text-sm font-black">{totals.count} {totals.count === 1 ? 'item' : 'items'}</div>
        </div>
        <button type="button" disabled={items.length === 0} onClick={onNext} style={{ backgroundColor: 'white', color: '#0b5cff' }} className="billing-bottom-bar__primary">
          Continue to Payment
          <ChevronRight className="h-6 w-6" />
        </button>
      </footer>

      {/* DESKTOP LAYOUT */}
      <div className="hidden lg:grid lg:grid-cols-[minmax(0,1fr)_600px] lg:gap-8 lg:h-full lg:overflow-hidden lg:items-start lg:bg-transparent lg:px-8 lg:pb-8">
        
        {/* LEFT COLUMN */}
        <div className="flex flex-col gap-6 h-full overflow-hidden">
          <section className="flex bg-white rounded-2xl border border-slate-200 p-4 items-center justify-between shrink-0 shadow-sm">
             <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 font-bold flex items-center justify-center text-lg shrink-0 overflow-hidden">
                   {selectedFarmer?.image_url ? (
                     <img src={selectedFarmer.image_url} alt={farmerName || 'Customer'} className="w-full h-full object-cover" />
                   ) : (
                     farmerName ? farmerName.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase() : <User />
                   )}
                </div>
                <div className="min-w-0">
                   <div className="text-lg font-bold text-slate-900 truncate">{farmerName || 'Walk-in Customer'}</div>
                   {selectedFarmer?.village && <div className="text-sm text-slate-500 truncate">{selectedFarmer.village}</div>}
                </div>
             </div>
             <button onClick={() => setShowFarmerModal(true)} className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-bold text-primary hover:bg-slate-50 transition-colors shrink-0">
               <Pencil className="w-4 h-4" /> Change
             </button>
          </section>

          <section className="flex flex-col flex-1 min-h-0 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
             <div className="flex p-1.5 mx-4 mt-4 mb-1 bg-slate-100 rounded-xl shrink-0 gap-1.5">
               <button onClick={() => setDesktopTab('feed')} className={`flex items-center justify-center gap-2 flex-1 py-2 text-sm font-bold rounded-lg transition-all ${desktopTab === 'feed' ? '!bg-blue-600 !text-white shadow-md' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}>
                 <Wheat className="w-4 h-4" /> Feed ({typeCounts.feed})
               </button>
               <button onClick={() => setDesktopTab('medicine')} className={`flex items-center justify-center gap-2 flex-1 py-2 text-sm font-bold rounded-lg transition-all ${desktopTab === 'medicine' ? '!bg-blue-600 !text-white shadow-md' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}>
                 <Pill className="w-4 h-4" /> Medicine ({typeCounts.medicine})
               </button>
             </div>
             
             <div className="px-4 pb-4 pt-1 border-b border-slate-100 flex gap-2 bg-white shrink-0">
               <div className="relative flex-1">
                 <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                 <input type="text" placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm placeholder:text-slate-400" />
               </div>
               <button className="w-11 h-11 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 shadow-sm shrink-0">
                 <SlidersHorizontal className="w-5 h-5" />
               </button>
             </div>

             <div className="overflow-y-auto flex-1 p-4 scrollbar-thin bg-white">
               {renderProductList(desktopInventory, desktopCatalog, true)}
             </div>
          </section>
          
        </div>

        {/* RIGHT COLUMN */}
        <div className="flex flex-col gap-6 h-full overflow-hidden pb-6">
          <section className="flex flex-col flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
               <h2 className="font-bold text-slate-900 text-lg">Selected Items ({items.length})</h2>
               {items.length > 0 && (
                 <button onClick={clearItems} className="text-sm font-bold text-red-600 hover:text-red-700">Clear All</button>
               )}
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 scrollbar-thin">
               {items.length > 0 ? (
                 <div className="space-y-4">
                   <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem_5.5rem_4.5rem_2rem] gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-2">
                     <span>Item</span>
                     <span className="text-right">Rate</span>
                     <span className="text-center">Disc.</span>
                     <span className="text-center">Qty</span>
                     <span className="text-right">Amount</span>
                     <span></span>
                   </div>
                   {items.map(item => {
                     const unitPrice = Number((item.base_unit_price * (1 - item.discount_percentage / 100)).toFixed(2));
                     return (
                       <div key={item.inventory_id} className="grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem_5.5rem_4.5rem_2rem] gap-2 items-center group px-2 py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 rounded-lg">
                         <div className="flex items-center gap-3 min-w-0">
                           <div className="min-w-0">
                             <div className="text-sm font-bold text-slate-900 truncate">{item.product_name}</div>
                             <div className="text-xs text-slate-500 truncate">{formatCurrency(item.base_unit_price)} / {item.unit || 'Bag'}</div>
                           </div>
                         </div>
                         <div className="flex justify-end">
                           <input 
                             type="number"
                             value={item.base_unit_price || ''}
                             onChange={(e) => updateItemPrice(item.inventory_id, Number(e.target.value) || 0)}
                             className="w-full px-1.5 py-1 text-right border border-slate-200 rounded text-sm font-bold focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-white text-slate-900"
                             placeholder="0"
                             step="0.01"
                           />
                         </div>
                         <div className="flex justify-center">
                           <div className="relative inline-block w-14">
                             <input 
                               type="number" 
                               value={item.discount_percentage || ''} 
                               onChange={(e) => updateItemDiscount(item.inventory_id, Number(e.target.value) || 0)}
                               className="w-full px-1.5 py-1 text-right border border-slate-200 rounded text-xs font-bold focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-white text-slate-900"
                               placeholder="0"
                             />
                             <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none">%</span>
                           </div>
                         </div>
                         <div className="flex items-center justify-between bg-white border border-slate-200 rounded-lg p-1 w-[5.5rem] justify-self-center">
                           <button onClick={() => updateQuantity(item.inventory_id, item.quantity - 1)} className="w-5 h-5 flex items-center justify-center text-primary hover:bg-slate-50 rounded"><Minus className="w-3 h-3" /></button>
                           <span className="text-xs font-bold text-slate-900">{item.quantity}</span>
                           <button onClick={() => updateQuantity(item.inventory_id, item.quantity + 1)} className="w-5 h-5 flex items-center justify-center text-primary hover:bg-slate-50 rounded"><Plus className="w-3 h-3" /></button>
                         </div>
                         <div className="text-sm font-bold text-slate-900 text-right">{formatCurrency(unitPrice * item.quantity)}</div>
                         <div className="flex items-center justify-end">
                           <button onClick={() => removeItem(item.inventory_id)} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-all"><Trash2 className="w-4 h-4" /></button>
                         </div>
                       </div>
                     );
                   })}
                 </div>
               ) : (
                 <div className="h-full flex flex-col items-center justify-center text-sm font-medium text-slate-400 min-h-[200px]">
                   <Package2 className="w-12 h-12 text-slate-200 mb-3" />
                   No items selected
                 </div>
               )}
            </div>
            
            <div className="p-6 border-t border-slate-100 bg-white shrink-0 space-y-4">
               <div className="flex items-center justify-between text-sm">
                 <span className="text-slate-500 font-medium">Subtotal ({totals.count} Items)</span>
                 <span className="font-bold text-slate-900">{formatCurrency(totals.subtotal)}</span>
               </div>
               
               <div className="flex items-center justify-between pt-1 mb-2">
                 <span className="text-base font-bold text-slate-900">Total Amount</span>
                 <span className="text-2xl font-black text-slate-900">{formatCurrency(totals.finalTotal)}</span>
               </div>
               
               <div className="bg-[#0b5cff] text-white border border-blue-600 rounded-xl p-5 flex flex-col gap-4 shadow-sm">
                 <div className="flex justify-between items-end">
                   <div>
                     <div className="text-blue-100 text-sm font-medium mb-1">Total Amount</div>
                     <div className="text-3xl font-black text-white">{formatCurrency(totals.finalTotal)}</div>
                     <div className="text-blue-100 text-[11px] font-medium mt-1">{totals.count} Items • {totals.count} Bags</div>
                   </div>
                   <button onClick={onNext} disabled={items.length === 0} style={{ backgroundColor: 'white', color: '#0b5cff' }} className="hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed font-bold px-6 py-3 shadow-sm rounded-xl text-sm flex items-center justify-center gap-2 transition-colors shrink-0 h-[48px]">
                     Continue to Payment
                     <ChevronRight className="w-5 h-5" strokeWidth={3} />
                   </button>
                 </div>
               </div>
            </div>
          </section>
        </div>
      </div>

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
        className="max-w-lg lg:hidden"
      >
        <div className="space-y-3">
          <SearchBar value={search} onChange={setSearch} placeholder={t('billing.searchProducts', 'Search products')} showVoicePlaceholder />
          {renderProductList(sheetInventory, sheetCatalog, false)}
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
    </>
  );
};

export default ProductSelector;
