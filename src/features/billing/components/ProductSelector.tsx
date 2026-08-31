import React, { useMemo, useState, useEffect, useRef } from 'react';
import { ChevronRight, Package2, Pill, Plus, Minus, User, Wheat, Pencil, Trash2, Info, SlidersHorizontal, Search, MoreVertical, Receipt } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Modal, Button, SearchBar, Input, DatePicker } from '@/components/ui';
import { useInventory, useProducts } from '@/features/inventory/hooks/useInventory';
import { InventoryItem } from '@/features/inventory/types';
import { InventoryLot } from '@/types/database';
import { Product } from '@/types/database';
import { formatCurrency, formatQuantity } from '@/lib/utils';
import { useCartStore } from '../stores/cartStore';
import { FarmerSelector } from './FarmerSelector';
import { QuickAddFarmerModal } from './QuickAddFarmerModal';
import { QuickAddWalkInModal } from './QuickAddWalkInModal';
import { FarmerActionModal } from './FarmerActionModal';
import { useFarmers, useFarmerProductDiscounts } from '@/features/farmers/hooks/useFarmers';
import { useAuthStore } from '@/stores/authStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { Banknote, QrCode, CreditCard } from 'lucide-react';

const getLotsWithStock = (item: InventoryItem) => {
  return (item.inventory_lots || []).filter((lot: any) => lot.remaining_quantity > 0)
    .sort((a: any, b: any) => {
      // FIFO: sort by expiry first if available, else by selected purchase date.
      if (a.expiry_date && b.expiry_date) {
        return new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime();
      }
      const aPurchaseDate = a.stock_purchases?.purchase_date || a.received_at;
      const bPurchaseDate = b.stock_purchases?.purchase_date || b.received_at;
      return new Date(aPurchaseDate).getTime() - new Date(bPurchaseDate).getTime();
    });
};

const getBadgeForLot = (lot: any, allLots: any[]) => {
  if (!allLots || allLots.length < 2) return null;
  const index = allLots.findIndex((l: any) => l.id === lot.id);
  // allLots is sorted FIFO (oldest first)
  if (index === allLots.length - 1) return 'New';
  if (index === 0) return allLots.length > 2 ? 'Very Old' : 'Old';
  return 'Old';
};

interface ProductSelectorProps {
  onNext: () => void;
  onSuccess?: (data: {
    billId: string;
    billNumber: string;
    total: number;
    amountPaid: number;
    balanceDue: number;
    farmerName: string | null;
    billDate: string;
    isOffline?: boolean;
  }) => void;
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

const RateInput = ({
  item,
  unitPrice,
  onDiscount,
  onPrice,
}: {
  item: any;
  unitPrice: number;
  onDiscount: (invId: string, lotId: string | null | undefined, disc: number) => void;
  onPrice: (invId: string, lotId: string | null | undefined, price: number) => void;
}) => {
  const [val, setVal] = React.useState(unitPrice.toFixed(2));
  const isFocused = React.useRef(false);

  // Only sync from store when input is NOT focused (avoid clobbering user's typing)
  React.useEffect(() => {
    if (!isFocused.current) {
      setVal(unitPrice.toFixed(2));
    }
  }, [unitPrice]);

  const commit = (raw: string) => {
    const newRate = parseFloat(raw);
    if (isNaN(newRate) || newRate < 0) {
      setVal(unitPrice.toFixed(2)); // revert to current
      return;
    }
    const mrp = item.mrp || item.base_unit_price;
    if (mrp > 0) {
      const newDiscount = Math.min(100, Math.max(0, Number(((1 - newRate / mrp) * 100).toFixed(2))));
      onDiscount(item.inventory_id, item.lot_id, newDiscount);
    } else {
      onPrice(item.inventory_id, item.lot_id, newRate);
    }
  };

  return (
    <input
      type="number"
      value={val}
      onFocus={() => { isFocused.current = true; }}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => {
        isFocused.current = false;
        commit(val);
      }}
      onKeyDown={(e) => { if (e.key === 'Enter') commit(val); }}
      className="w-full px-1.5 py-1 text-right border border-slate-200 rounded text-sm font-bold focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-white text-slate-900 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      placeholder="0"
      step="0.01"
    />
  );
};

const QuantityInput = ({ 
  item, 
  onChange 
}: { 
  item: any; 
  onChange: (invId: string, lotId: string | null | undefined, qty: number) => void;
}) => {
  const [val, setVal] = React.useState(item.quantity.toString());

  React.useEffect(() => {
    setVal(item.quantity.toString());
  }, [item.quantity]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const num = parseInt(rawVal, 10);
    
    if (!isNaN(num) && num > item.max_quantity) {
      toast.error(`Only ${formatQuantity(item.max_quantity, item.unit)} available in stock`);
      setVal(item.max_quantity.toString());
      onChange(item.inventory_id, item.lot_id, item.max_quantity);
      return;
    }

    setVal(rawVal);
    if (!isNaN(num) && num > 0) {
      onChange(item.inventory_id, item.lot_id, num);
    }
  };

  const handleBlur = () => {
    const num = parseInt(val, 10);
    if (isNaN(num) || num <= 0) {
      setVal('1');
      onChange(item.inventory_id, item.lot_id, 1);
    }
  };

  return (
    <input 
      type="number"
      value={val}
      onChange={handleChange}
      onBlur={handleBlur}
      className="w-full px-1.5 py-1 text-center border border-slate-200 rounded text-sm font-bold focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-white text-slate-900 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      placeholder="1"
    />
  );
};

const AmountInput = ({
  item,
  onDiscount,
  onPrice,
}: {
  item: any;
  onDiscount: (invId: string, lotId: string | null | undefined, disc: number) => void;
  onPrice: (invId: string, lotId: string | null | undefined, price: number) => void;
}) => {
  const amount = getLineTotal(item);
  const [value, setValue] = React.useState(amount.toFixed(2));

  React.useEffect(() => setValue(amount.toFixed(2)), [amount]);

  const commit = () => {
    const nextAmount = Number(value);
    if (!Number.isFinite(nextAmount) || nextAmount < 0 || item.quantity <= 0) {
      setValue(amount.toFixed(2));
      return;
    }
    const nextRate = nextAmount / item.quantity;
    const mrp = Number(item.mrp || item.base_unit_price || 0);
    if (mrp > 0) {
      onDiscount(item.inventory_id, item.lot_id, Math.min(100, Math.max(0, Number(((1 - nextRate / mrp) * 100).toFixed(2)))));
    } else {
      onPrice(item.inventory_id, item.lot_id, nextRate);
    }
  };

  return <input type="number" min="0" step="0.01" value={value} onChange={(event) => setValue(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === 'Enter') commit(); }} className="w-full rounded border border-slate-200 bg-white px-1.5 py-1 text-right text-[0.8rem] font-black text-slate-950 focus:border-primary focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" aria-label={`Amount for ${item.product_name}`} />;
};

export const ProductSelector: React.FC<ProductSelectorProps> = ({ onNext, onSuccess }) => {
  const { t } = useTranslation();
  const { data: inventory = [] } = useInventory();
  const { data: products = [] } = useProducts();
  const { data: farmers } = useFarmers();
  const { user: dealer } = useAuthStore();
  const hasFarmerDiscountFeature = useSubscriptionStore((state) => state.hasFeature('farmer_product_discounts'));
  const {
    items,
    farmerName,
    farmerId,
    farmerTotalDue,
    farmerCreditLimit,
    gstEnabled,
    discountAmount,
    billDate,
    setGstEnabled,
    setDiscount,
    setBillDate,
    addItem,
    updateQuantity,
    removeItem,
    clearItems,
    updateItemPrice,
    updateItemDiscount,
    paymentType,
    amountPaid,
    upiRef,
    chequeNumber,
    notes,
    setFarmer,
    setPaymentType,
    setAmountPaid,
    setUpiRef,
    setChequeNumber,
    setNotes,
    settlementDiscountAmount,
    setSettlementDiscount,
  } = useCartStore();
  const [search, setSearch] = useState('');
  const [showFarmerModal, setShowFarmerModal] = useState(false);
  const [showQuickAddFarmer, setShowQuickAddFarmer] = useState(false);
  const [showWalkInDetails, setShowWalkInDetails] = useState(false);
  const [desktopFarmerSearch, setDesktopFarmerSearch] = useState('');
  const [isDesktopFarmerFocused, setIsDesktopFarmerFocused] = useState(false);
  const desktopFarmerInputRef = useRef<HTMLInputElement>(null);
  const itemsScrollRef = useRef<HTMLDivElement>(null);
  const [hasMoreBelow, setHasMoreBelow] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const checkItemsScroll = () => {
    const el = itemsScrollRef.current;
    if (!el) return;
    setHasMoreBelow(el.scrollHeight - el.scrollTop - el.clientHeight > 16);
  };
  const [sheetType, setSheetType] = useState<ProductTypeFilter | null>(null);
  const [desktopTab, setDesktopTab] = useState<ProductTypeFilter>('feed');
  const [farmerActionMode, setFarmerActionMode] = useState<'payment' | 'return' | null>(null);

  const { data: farmerDiscounts = [] } = useFarmerProductDiscounts(farmerId || '');
  const selectedFarmer = useMemo(() => farmers?.find(f => f.id === farmerId), [farmers, farmerId]);
  const desktopFarmerMatches = useMemo(() => {
    const query = desktopFarmerSearch.trim().toLowerCase();
    if (!query) return [];
    return (farmers || []).filter((farmer) =>
      farmer.name.toLowerCase().includes(query) || farmer.phone?.includes(desktopFarmerSearch) || farmer.village?.toLowerCase().includes(query)
    ).slice(0, 6);
  }, [desktopFarmerSearch, farmers]);

  useEffect(() => {
    if (!isDesktopFarmerFocused) setDesktopFarmerSearch(farmerName || '');
  }, [farmerName, isDesktopFarmerFocused]);

  useEffect(() => {
    const focusFarmerSearch = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingInField = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if (window.innerWidth < 1024 || isTypingInField || event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) return;
      desktopFarmerInputRef.current?.focus();
      setIsDesktopFarmerFocused(true);
      setDesktopFarmerSearch((current) => current === farmerName ? event.key : current + event.key);
      event.preventDefault();
    };
    window.addEventListener('keydown', focusFarmerSearch);
    return () => window.removeEventListener('keydown', focusFarmerSearch);
  }, [farmerName]);
  
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [visibleCount, setVisibleCount] = useState(24);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    setVisibleCount(24);
  }, [search, desktopTab, sheetType]);



  const [isEditingList, setIsEditingList] = useState(false);
  const [editingCartItem, setEditingCartItem] = useState<{ inventory_id: string; lot_id?: string | null } | null>(null);
  const [editLotId, setEditLotId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<string>('');
  const [editDiscount, setEditDiscount] = useState<string>('');
  const [editSellingPrice, setEditSellingPrice] = useState<string>('');

  const handleEditItem = (item: any) => {
    setEditingCartItem({ inventory_id: item.inventory_id, lot_id: item.lot_id });
    setEditLotId(item.lot_id || null);
    // Show: MRP (reference), the actual Selling Price the farmer pays, and the
    // discount derived from MRP → selling. Selling = base × (1 − disc). For feed
    // base already IS the selling price (disc 0); for medicine base is MRP.
    const mrp = item.mrp || item.base_unit_price;
    const effectiveDisc = item.discount_percentage || 0;
    const sellingPrice = Number((item.base_unit_price * (1 - effectiveDisc / 100)).toFixed(2));
    const displayDiscount = mrp > 0 && sellingPrice < mrp
      ? Number((((mrp - sellingPrice) / mrp) * 100).toFixed(2))
      : 0;

    setEditPrice(mrp.toString());
    setEditDiscount(displayDiscount.toString());
    setEditSellingPrice(sellingPrice.toString());
  };

  const handleSaveEdit = () => {
    if (!editingCartItem) return;
    const sellingPrice = Number(editSellingPrice) || 0;
    const mrpVal = Number(editPrice) || 0;
    const discVal = Number(editDiscount) || 0;

    const cartItem = items.find(
      (i) => i.inventory_id === editingCartItem.inventory_id && (i.lot_id ?? null) === (editLotId ?? null)
    );
    const isMedicine = cartItem ? normalizeType(cartItem.product_type) === 'medicine' : false;

    const applyPricing = (invId: string, lotId: string | null | undefined) => {
      if (isMedicine) {
        // Medicine keeps the MRP + discount model (RATE = MRP, DISC = %).
        updateItemPrice(invId, lotId, mrpVal);       // clears discount to 0…
        updateItemDiscount(invId, lotId, discVal);   // …then sets the real discount
      } else {
        // Feed / non-medicine: RATE = the selling price the farmer pays, no
        // per-line discount (updateItemPrice clears it to 0).
        updateItemPrice(invId, lotId, sellingPrice);
      }
    };

    if (editLotId !== editingCartItem.lot_id) {
      const invItem = inventory.find((i) => i.id === editingCartItem.inventory_id);
      const targetLot = invItem?.inventory_lots?.find((l: any) => l.id === editLotId);
      if (invItem && targetLot) {
        useCartStore.getState().switchItemLot(editingCartItem.inventory_id, editingCartItem.lot_id, {
          lot_id: targetLot.id,
          batch_number: targetLot.batch_number,
          expiry_date: targetLot.expiry_date,
          mrp: targetLot.mrp || 0,
          base_unit_price: targetLot.mrp || invItem.mrp || invItem.product.default_price || invItem.selling_price || 0,
          unit_price: targetLot.selling_price || invItem.selling_price || invItem.product.default_price || 0,
          max_quantity: targetLot.remaining_quantity,
        });
        applyPricing(editingCartItem.inventory_id, targetLot.id);
      }
    } else {
      applyPricing(editingCartItem.inventory_id, editingCartItem.lot_id);
    }

    setEditingCartItem(null);
  };

  const handleMrpChange = (val: string) => {
    setEditPrice(val);
    const mrp = Number(val) || 0;
    const disc = Number(editDiscount) || 0;
    setEditSellingPrice((mrp * (1 - disc / 100)).toFixed(2));
  };

  const handleDiscountChange = (val: string) => {
    setEditDiscount(val);
    const mrp = Number(editPrice) || 0;
    const disc = Number(val) || 0;
    setEditSellingPrice((mrp * (1 - disc / 100)).toFixed(2));
  };

  const handleSellingPriceChange = (val: string) => {
    setEditSellingPrice(val);
    const mrp = Number(editPrice) || 0;
    const sp = Number(val) || 0;
    if (mrp > 0) {
      setEditDiscount((((mrp - sp) / mrp) * 100).toFixed(2));
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'F12') {
        e.preventDefault();
        if (items.length > 0) {
          onNext();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items.length, onNext]);

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + getLineTotal(item), 0);
    const count = items.reduce((sum, item) => sum + item.quantity, 0);
    const discount = discountAmount || 0;
    const tax = gstEnabled ? (subtotal - discount) * 0.18 : 0;
    const finalTotal = subtotal - discount + tax;
    return { subtotal, count, finalTotal, tax, discount };
  }, [items, discountAmount, gstEnabled]);

  const effectiveTotal = Math.max(0, totals.finalTotal - (settlementDiscountAmount || 0));
  const balanceDue = Math.max(0, effectiveTotal - amountPaid);
  const totalDue = (selectedFarmer?.total_due || 0) + balanceDue;

  const typeCounts = useMemo(() => {
    const feed = inventory.filter((item) => normalizeType(item.product.type) === 'feed').length;
    const medicine = inventory.filter((item) => normalizeType(item.product.type) === 'medicine').length;
    return { feed, medicine };
  }, [inventory]);

  useEffect(() => {
    checkItemsScroll();
    if (items.length === 0) setConfirmClear(false);
  }, [items]);

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

  const [justAdded, setJustAdded] = useState<string | null>(null);

  const handleAdd = (item: InventoryItem) => {
    if (item.quantity_in_stock <= 0) {
      toast.error(t('billing.outOfStock', 'This product is out of stock.'));
      return;
    }

    const cartItemsForProduct = items.filter((cartItem) => cartItem.inventory_id === item.id);
    const cartQuantity = cartItemsForProduct.reduce((sum, c) => sum + c.quantity, 0);

    if (cartQuantity >= item.quantity_in_stock) {
      toast.error(t('billing.maxStockReached', 'You have reached the available stock.'));
      return;
    }

    setJustAdded(item.id);
    setTimeout(() => setJustAdded(null), 300);

    const lots = getLotsWithStock(item);
    let targetLot = lots.length > 0 ? lots[lots.length - 1] : null;

    if (lots.length > 0) {
      // Find the oldest lot that still has available capacity
      // lots is newest first, so iterate from end to start (oldest to newest)
      for (let i = lots.length - 1; i >= 0; i--) {
        const l = lots[i];
        const inCartQty = cartItemsForProduct.find((c) => c.lot_id === l.id)?.quantity || 0;
        if (inCartQty < l.remaining_quantity) {
          targetLot = l;
          break;
        }
      }
    }

    const maxQty = item.quantity_in_stock;

    const isMedicine = normalizeType(item.product.type) === 'medicine';
    const mrpPrice = targetLot?.mrp || item.mrp || item.product.default_price || item.selling_price || 0;
    const sellingPrice = targetLot?.selling_price || item.selling_price || item.product.default_price || 0;
    // Pricing model:
    //  - feed / non-medicine: RATE = the selling price the farmer actually pays.
    //    base_unit_price = selling price, no per-line discount (DISC shows "-").
    //  - medicine: RATE = MRP, and a discount % (product/farmer) brings it down.
    //    This keeps the dynamic farmer-discount flow working.
    let finalDiscount = isMedicine ? Number(item.medicine_discount_percentage || 0) : 0;
    let defaultDiscountPercentage = finalDiscount;
    let farmerDiscountPercentage = null;
    let discountSource = finalDiscount > 0 ? 'product_default' : 'none';
    let discountLabel = '';

    if (normalizeType(item.product.type) === 'medicine' && hasFarmerDiscountFeature && dealer?.farmer_product_discounts_enabled && selectedFarmer) {
      const specificDiscount = farmerDiscounts.find(d => d.product_id === item.product_id);
      if (specificDiscount) {
        finalDiscount = Number(specificDiscount.discount_percentage || 0);
        farmerDiscountPercentage = finalDiscount;
        discountSource = 'farmer_product';
        discountLabel = `Special rate for ${farmerName}`;
      } else if (selectedFarmer.default_medicine_discount_percentage) {
        finalDiscount = Number(selectedFarmer.default_medicine_discount_percentage);
        farmerDiscountPercentage = finalDiscount;
        discountSource = 'farmer_default';
        discountLabel = `Default rate for ${farmerName}`;
      }
    }

    addItem({
      inventory_id: item.id,
      lot_id: null,
      batch_number: null,
      product_id: item.product_id,
      product_name: item.product.name,
      hsn_code: item.product.hsn_code,
      product_type: item.product.type,
      quantity: 1,
      base_unit_price: isMedicine ? mrpPrice : (sellingPrice || mrpPrice),
      unit_price: sellingPrice || mrpPrice,
      gst_rate: item.product.gst_rate,
      discount_percentage: finalDiscount,
      default_discount_percentage: defaultDiscountPercentage,
      farmer_discount_percentage: farmerDiscountPercentage,
      discount_source: discountSource as any,
      discount_label: discountLabel,
      mrp: targetLot?.mrp || item.mrp || 0,
      expiry_date: targetLot?.expiry_date || item.expiry_date || null,
      max_quantity: maxQty,
      unit: item.product.unit,
    });
    setSearch('');
  };

  const ProductCard = ({ item }: { item: InventoryItem }) => {
    const lots = getLotsWithStock(item);
    const newestLot = lots.length > 0 ? lots[0] : null;
    const badge = newestLot ? getBadgeForLot(newestLot, lots) : null;
    
    const price = newestLot ? (newestLot.selling_price || newestLot.mrp) : (item.selling_price || item.product.default_price || 0);
    const outOfStock = item.quantity_in_stock <= 0;
    
    // Sum all quantities of this product in cart
    const cartQty = items.filter((cartItem) => cartItem.inventory_id === item.id).reduce((sum, c) => sum + c.quantity, 0);

    return (
      <div className="billing-picker-row">
        <ProductIcon type={item.product.type} />
        <div className="min-w-0 flex-1 flex flex-col justify-center">
          <div className="flex items-center gap-2">
            <div className="truncate text-sm font-black text-slate-950">{item.product.name}</div>
            {badge && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide text-white shrink-0 ${badge === 'New' ? 'bg-emerald-500' : badge === 'Very Old' ? 'bg-rose-500' : 'bg-amber-500'}`}>
                {badge}
              </span>
            )}
          </div>
          <div className="mt-0.5 truncate text-xs font-semibold text-slate-500">
            {item.product.company || 'No company'} · {formatCurrency(price || 0)}/{item.product.unit}
          </div>
        </div>
        {cartQty > 0 ? (
          <div className="billing-qty-control bg-blue-50 border border-blue-100 rounded-lg px-3 py-1.5">
            <span className="text-xs font-bold text-blue-700">In Cart ({cartQty})</span>
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

  const GridCard = ({ item }: { item: InventoryItem }) => {
    const lots = getLotsWithStock(item);
    const newestLot = lots.length > 0 ? lots[0] : null;
    const badge = newestLot ? getBadgeForLot(newestLot, lots) : null;
    
    // Grid card should show newest lot's price usually, or base price
    const price = newestLot ? (newestLot.selling_price || newestLot.mrp) : (item.selling_price || item.product.default_price || 0);
    const outOfStock = item.quantity_in_stock <= 0;
    
    // Sum all quantities of this product in cart
    const cartQty = items.filter((cartItem) => cartItem.inventory_id === item.id).reduce((sum, c) => sum + c.quantity, 0);
    
    const discount = normalizeType(item.product.type) === 'medicine' ? (item.medicine_discount_percentage || 0) : 0;
    const fallbackImage = normalizeType(item.product.type) === 'medicine' ? '/medicine_.svg' : '/feed_.svg';

    return (
      <div 
        className="bg-white border border-slate-100 rounded-3xl overflow-hidden flex flex-col relative shadow-sm transition-all hover:shadow-md cursor-pointer select-none"
        onClick={() => {
          if (!outOfStock && cartQty === 0) handleAdd(item);
        }}
      >
        <div className="h-28 lg:h-24 bg-slate-50 relative flex items-center justify-center p-3 lg:p-3">
          {item.image_url ? (
            <img 
              src={item.image_url} 
              alt={item.product.name} 
              className="h-full object-contain filter drop-shadow-sm transition-transform duration-300 hover:scale-105" 
            />
          ) : normalizeType(item.product.type) === 'medicine' ? (
            <img 
              src="/medicine_.svg" 
              alt={item.product.name} 
              className="h-full object-contain filter drop-shadow-sm transition-transform duration-300 hover:scale-105" 
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-amber-600/30">
              <Wheat className="w-16 h-16" strokeWidth={1.5} />
            </div>
          )}
          
          {badge && (
            <div className="absolute top-3 left-3 flex flex-col gap-1 items-start">
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide shadow-sm text-white ${badge === 'New' ? 'bg-emerald-500' : badge === 'Very Old' ? 'bg-rose-500' : 'bg-amber-500'}`}>
                {badge}
              </span>
            </div>
          )}

          <div className="absolute top-3 right-3 flex flex-col gap-1 items-end">
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide bg-white text-slate-500 border border-slate-200 shadow-sm">
              {item.product.unit}
            </span>
          </div>
        </div>
        
        <div className="p-2.5 lg:p-2.5 flex flex-col">
          <div className="flex items-start justify-between gap-2 mb-1.5 lg:mb-1.5">
            <div className="min-w-0">
              <div className="font-extrabold text-slate-800 text-[13px] leading-tight line-clamp-2">{item.product.name}</div>
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1 lg:mt-0.5 truncate">
                {item.product.company || 'Generic'}
              </div>
            </div>
            <div className="flex flex-col items-end shrink-0">
              <span className={`text-[11px] font-black px-1.5 py-0.5 rounded ${outOfStock ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-700'}`}>
                {outOfStock ? 'Out' : item.quantity_in_stock}
              </span>
              <span className="text-[8px] font-bold text-slate-400 mt-0.5">STOCK</span>
            </div>
          </div>
          
          <div className="pt-1.5 lg:pt-1.5 border-t border-slate-100/80 flex items-end justify-between mb-2 lg:mb-2">
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Price</span>
              <span className="font-extrabold text-slate-800 text-base leading-none">{formatCurrency(price || 0)}</span>
              {discount > 0 ? (
                <span className="text-[9px] font-bold text-emerald-500 mt-1 lg:mt-0.5">{discount}% off</span>
              ) : (
                <span className="h-[13.5px] mt-1 block" />
              )}
            </div>
          </div>

          <div className="mt-0">
            {cartQty > 0 ? (
              <div key={cartQty} className="flex items-center bg-blue-50 border border-blue-100 rounded-xl overflow-hidden h-9 lg:h-8 w-full animate-pop-in" onClick={(e) => e.stopPropagation()}>
                <span className="text-xs font-bold text-blue-700 flex-1 text-center">In Cart ({cartQty})</span>
              </div>
            ) : (
              <button 
                type="button" 
                onClick={(e) => {
                  e.stopPropagation();
                  handleAdd(item);
                }}
                disabled={outOfStock}
                className={`w-full h-9 lg:h-8 rounded-xl text-xs font-bold flex items-center justify-center hover:opacity-90 disabled:opacity-30 transition-all shadow-sm ${justAdded === item.id ? 'bg-blue-600 text-white scale-105' : 'bg-[#0b5cff] text-white scale-100'}`}
              >
                Add to Bill
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderProductList = (inventoryList: InventoryItem[], catalog: Product[], isDesktop = false, listType?: 'feed' | 'medicine') => {
    if (inventoryList.length > 0) {
      const displayedInventory = inventoryList.slice(0, visibleCount);
      const hasMore = inventoryList.length > visibleCount;

      const LoadMoreBtn = () => hasMore ? (
        <div className="flex justify-center mt-6 col-span-full pb-6">
          <button 
            onClick={() => setVisibleCount(v => v + 24)}
            className="px-6 py-2.5 bg-white border border-slate-200 shadow-sm rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Load More Products
          </button>
        </div>
      ) : null;

      if (!isDesktop) {
        return (
          <div className="grid grid-cols-2 gap-3 pb-24 md:pb-0 bg-[#eff4f9] p-3 rounded-2xl">
             {displayedInventory.map(item => <GridCard key={item.id} item={item} />)}
             <LoadMoreBtn />
          </div>
        );
      }
      return (
        <div className={isDesktop && viewMode === 'grid' ? "grid grid-cols-3 gap-3 pb-24 md:pb-0" : "space-y-2 pb-24 md:pb-0"}>
          {displayedInventory.map((item) => {
            if (isDesktop) {
              if (viewMode === 'grid') {
                return <GridCard key={item.id} item={item} />;
              }

              const lots = getLotsWithStock(item);
              const newestLot = lots.length > 0 ? lots[0] : null;
              const badge = newestLot ? getBadgeForLot(newestLot, lots) : null;
              const price = newestLot ? (newestLot.selling_price || newestLot.mrp) : (item.selling_price || item.product.default_price || 0);
              const cartQty = items.filter((cartItem: any) => cartItem.inventory_id === item.id).reduce((sum: number, c: any) => sum + c.quantity, 0);

              return (
                <div key={item.id} className="flex items-center justify-between p-3 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors">
                   <div className="flex items-center gap-4 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-yellow-50 flex items-center justify-center shrink-0">
                        <ProductIcon type={item.product.type} className="w-6 h-6 text-yellow-600" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-bold text-slate-900 truncate">{item.product.name}</div>
                          {badge && (
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide text-white shrink-0 ${badge === 'New' ? 'bg-emerald-500' : badge === 'Very Old' ? 'bg-rose-500' : 'bg-amber-500'}`}>
                              {badge}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 flex gap-2">
                           <span>{formatCurrency(price || 0)} / {item.product.unit || 'Bag'}</span>
                           <span className="text-blue-600 font-medium">Available: {formatQuantity(item.quantity_in_stock, item.product.unit || 'Bags')}</span>
                        </div>
                      </div>
                   </div>
                   {cartQty > 0 ? (
                     <div key={cartQty} className="px-4 py-2 text-sm font-bold text-blue-700 border rounded-lg bg-blue-50 border-blue-100 animate-pop-in">
                        In Cart ({cartQty})
                     </div>
                   ) : (
                     <button onClick={() => handleAdd(item)} disabled={item.quantity_in_stock <= 0} className="px-4 py-2 text-sm font-bold text-blue-600 border border-slate-200 rounded-lg hover:bg-blue-50 hover:border-blue-200 transition-colors flex items-center gap-1 disabled:opacity-50">
                        Add <Plus className="w-4 h-4" />
                     </button>
                   )}
                </div>
              );
            }
            return null; // ProductCard is unused now since we use GridCard on mobile
          })}
          <LoadMoreBtn />
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
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className="billing-customer-card__icon overflow-hidden shrink-0">
              {selectedFarmer?.image_url ? (
                <img src={selectedFarmer.image_url} alt={farmerName || 'Customer'} className="h-full w-full object-cover" />
              ) : (
                <User className="h-5 w-5" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[1.05rem] font-black text-slate-950 tracking-tight leading-tight">{farmerName || 'Walk-in Customer'}</div>
              {selectedFarmer?.village && (
                <div className="truncate text-xs font-semibold text-slate-500 mt-0.5">{selectedFarmer.village}</div>
              )}
            </div>
          </div>
          <button type="button" onClick={() => setShowFarmerModal(true)} className="billing-soft-button shrink-0">
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
                <div className="billing-selected-list__head !grid-cols-[1fr_5rem_4.5rem] sm:!grid-cols-[1fr_6rem_5.5rem]">
                  <span>Item</span>
                  <span className="text-center">{isEditingList ? 'Action' : 'Qty'}</span>
                  <span className="text-right">Amount</span>
                </div>
                {items.map((item) => {
                  const unitPrice = Number((item.base_unit_price * (1 - item.discount_percentage / 100)).toFixed(2));
                  return (
                    <div key={item.inventory_id} className="billing-selected-list__row !grid-cols-[1fr_5rem_4.5rem] sm:!grid-cols-[1fr_6rem_5.5rem]">
                      <div className="min-w-0">
                        <div className="truncate text-[0.8rem] sm:text-sm font-black text-slate-950 cursor-pointer hover:text-primary" onClick={() => handleEditItem(item)}>{item.product_name}</div>
                        <div className="truncate text-[0.65rem] sm:text-xs font-semibold text-slate-600 mt-0.5 flex items-center gap-1">
                          <span>{formatQuantity(item.quantity, item.unit)} × {formatCurrency(unitPrice)}</span>
                          {item.product_type === 'medicine' && (
                            <span className="flex items-center text-[10px] ml-1 bg-slate-100/50 px-1.5 py-0.5 rounded">
                              <span className={item.discount_percentage === (item.default_discount_percentage || 0) ? "text-emerald-700 font-black" : "text-slate-500 font-bold"}>
                                {item.default_discount_percentage || 0}%
                              </span>
                              {item.farmer_discount_percentage != null && item.farmer_discount_percentage !== (item.default_discount_percentage || 0) && (
                                <>
                                  <span className="text-slate-300 mx-0.5">,</span>
                                  <span className={item.discount_percentage === item.farmer_discount_percentage ? "text-emerald-700 font-black" : "text-slate-500 font-bold"}>
                                    {item.farmer_discount_percentage}%
                                  </span>
                                </>
                              )}
                              {item.discount_percentage !== (item.default_discount_percentage || 0) && item.discount_percentage !== item.farmer_discount_percentage && (
                                <>
                                  <span className="text-slate-300 mx-0.5">,</span>
                                  <span className="text-emerald-700 font-black">{item.discount_percentage}%</span>
                                </>
                              )}
                            </span>
                          )}
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
                          <div className="billing-qty-control billing-qty-control--sm scale-[0.85] sm:scale-100 origin-center">
                            <button
                              type="button"
                              onClick={() => item.quantity === 1 ? removeItem(item.inventory_id, item.lot_id) : updateQuantity(item.inventory_id, item.lot_id, item.quantity - 1)}
                              aria-label="Decrease quantity"
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <input
                              type="number"
                              min={1}
                              max={item.max_quantity}
                              value={item.quantity}
                              onChange={e => {
                                const v = Math.min(Math.max(1, Number(e.target.value) || 1), item.max_quantity);
                                updateQuantity(item.inventory_id, item.lot_id, v);
                              }}
                              aria-label="Quantity"
                            />
                            <button
                              type="button"
                              disabled={item.quantity >= item.max_quantity}
                              onClick={() => updateQuantity(item.inventory_id, item.lot_id, item.quantity + 1)}
                              aria-label="Increase quantity"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="text-right text-[0.8rem] sm:text-sm font-black text-slate-950 justify-self-end">
                        {isEditingList ? <AmountInput item={item} onDiscount={updateItemDiscount} onPrice={updateItemPrice} /> : formatCurrency(getLineTotal(item))}
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
      <section className="hidden lg:flex lg:shrink-0 lg:items-center lg:gap-3 lg:border-b lg:border-slate-200 lg:bg-surface lg:px-8 lg:py-3">
        <div className="relative min-w-0 max-w-2xl flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            ref={desktopFarmerInputRef}
            value={desktopFarmerSearch}
            onFocus={() => setIsDesktopFarmerFocused(true)}
            onChange={(event) => setDesktopFarmerSearch(event.target.value)}
            placeholder="Search farmer by name, phone, or village"
            className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
          {isDesktopFarmerFocused && desktopFarmerMatches.length > 0 ? (
            <div className="absolute left-0 top-full z-30 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
              {desktopFarmerMatches.map((farmer) => (
                <button key={farmer.id} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { setFarmer(farmer.id, farmer.name, farmer.total_due, farmer.credit_limit); setDesktopFarmerSearch(farmer.name); setIsDesktopFarmerFocused(false); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-slate-50">
                  <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-slate-900 break-words">{farmer.name}</span><span className="block truncate text-xs text-slate-500">{farmer.village || farmer.phone || 'Farmer'}</span></span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <button type="button" onClick={() => setShowWalkInDetails(true)} className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
          <User className="h-4 w-4" /> Walk-in Customer
        </button>
        <button type="button" onClick={() => setShowQuickAddFarmer(true)} className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white transition hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Add New Farmer
        </button>
        <button type="button" onClick={() => setFarmerActionMode('payment')} className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-bold text-emerald-900 transition hover:bg-emerald-100">
          <Receipt className="h-4 w-4" /> Payments
        </button>
        <button type="button" onClick={() => setFarmerActionMode('return')} className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 text-sm font-bold text-amber-900 transition hover:bg-amber-100">
          <Receipt className="h-4 w-4" /> Returns
        </button>
      </section>

      <div className="hidden lg:flex lg:flex-row lg:flex-1 lg:min-h-0 lg:overflow-hidden lg:bg-surface">

        {/* LEFT COLUMN */}
        <div className="flex flex-col flex-1 min-w-0 overflow-y-auto overscroll-contain lg:min-h-0 lg:border-r lg:border-slate-200">
          <section className="flex flex-col">
             <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-slate-200">
               <div className="flex p-1.5 mx-4 mt-3 mb-1 bg-slate-100 rounded-xl shrink-0 gap-1.5">
                 <button onClick={() => setDesktopTab('feed')} className={`flex items-center justify-center gap-2 flex-1 py-2 text-sm font-bold rounded-lg transition-all ${desktopTab === 'feed' ? '!bg-primary/15 !text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}>
                   <Wheat className="w-4 h-4" /> Feed ({typeCounts.feed})
                 </button>
                 <button onClick={() => setDesktopTab('medicine')} className={`flex items-center justify-center gap-2 flex-1 py-2 text-sm font-bold rounded-lg transition-all ${desktopTab === 'medicine' ? '!bg-primary/15 !text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}>
                   <Pill className="w-4 h-4" /> Medicine ({typeCounts.medicine})
                 </button>
               </div>
             
               <div className="px-4 pb-4 pt-1 flex gap-2 shrink-0">
                 <div className="relative flex-1 group">
                   <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" />
                   <input
                     ref={searchInputRef}
                     type="text"
                     placeholder="Search products..."
                     value={search}
                     onChange={(e) => setSearch(e.target.value)}
                     className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm placeholder:text-slate-400 transition-all"
                   />
                 </div>
                 <button 
                   onClick={() => setViewMode(v => v === 'list' ? 'grid' : 'list')}
                   className={`w-11 h-11 flex items-center justify-center border rounded-xl shadow-sm shrink-0 transition-colors ${viewMode === 'grid' ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                   title="Toggle View Mode"
                 >
                   <SlidersHorizontal className="w-5 h-5" />
                 </button>
               </div>
             </div>

             <div className="p-4 bg-slate-100/60">
               {renderProductList(desktopInventory, desktopCatalog, true, desktopTab)}
             </div>
          </section>
          
        </div>

        {/* RIGHT COLUMN */}
        <div className="flex flex-col lg:w-[820px] lg:shrink-0 lg:min-h-0">
          <section className="bg-white flex flex-col flex-1 min-h-0">
            <div className="flex items-center justify-between px-5 py-2.5 border-b border-slate-100 shrink-0">
               <h2 className="font-bold text-slate-900 text-lg">Selected Items ({items.length})</h2>
               {items.length > 0 && (
                 confirmClear ? (
                   <div className="flex items-center gap-2">
                     <span className="text-xs font-bold text-slate-500">Clear all items?</span>
                     <button onClick={() => { clearItems(); setConfirmClear(false); }} className="text-xs font-black text-red-600 hover:text-red-700 px-2 py-1 rounded bg-red-50 hover:bg-red-100 transition-colors">Yes, clear</button>
                     <button onClick={() => setConfirmClear(false)} className="text-xs font-bold text-slate-500 hover:text-slate-700 px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 transition-colors">Cancel</button>
                   </div>
                 ) : (
                   <button onClick={() => setConfirmClear(true)} className="text-sm font-bold text-red-600 hover:text-red-700">Clear All</button>
                 )
               )}
            </div>

            <div className="relative flex-1 min-h-0 overflow-hidden">
              <div ref={itemsScrollRef} onScroll={checkItemsScroll} className="h-full overflow-y-auto overscroll-contain px-5 pb-5 pt-1">
               {items.length > 0 ? (
                  <div className="space-y-0.5">
                     <div className="sticky top-0 z-10 grid grid-cols-none gap-2 text-[11px] font-black text-slate-600 uppercase tracking-wider px-3 py-2 bg-slate-100 rounded-lg mb-0.5 shadow-sm" style={{ gridTemplateColumns: '1.5rem minmax(0,1fr) 4.25rem 6rem 4.75rem 3.5rem 5.25rem 1.5rem' }}>
                     <span>#</span>
                     <span>Item</span>
                     <span className="text-right">MRP</span>
                     <span className="text-center">Disc.</span>
                     <span className="text-right">Rate</span>
                     <span className="text-center">Qty</span>
                     <span className="text-right">Amount</span>
                     <span></span>
                   </div>
                   {items.map((item, index) => {
                     const unitPrice = Number((item.base_unit_price * (1 - item.discount_percentage / 100)).toFixed(2));
                     return (
                        <div key={item.inventory_id} className="grid grid-cols-none gap-2 items-center group px-2 py-2 border-b border-dashed border-slate-200 last:border-0 hover:bg-slate-50 rounded-lg" style={{ gridTemplateColumns: '1.5rem minmax(0,1fr) 4.25rem 6rem 4.75rem 3.5rem 5.25rem 1.5rem' }}>
                         <div className="text-[10px] font-bold text-slate-400 tabular-nums">{index + 1}</div>
                         <div className="flex items-center gap-3 min-w-0">
                           <div className="min-w-0">
                             <div className="text-sm font-bold text-slate-900 truncate">{item.product_name}</div>
                             <div className="text-xs text-slate-500 truncate">{item.unit || 'Bag'}</div>
                           </div>
                         </div>
                         <div className="text-right text-sm font-bold text-slate-600">
                           {formatCurrency(item.mrp || 0)}
                         </div>
                         <div className="flex justify-center items-center group/edit cursor-pointer" onClick={() => handleEditItem(item)}>
                            {item.product_type === 'medicine' ? (
                              <div className="flex items-center text-[11px] bg-slate-50 border border-slate-200 rounded px-1.5 py-1 hover:border-primary transition-colors">
                                <span className={item.discount_percentage === (item.default_discount_percentage || 0) ? "text-emerald-700 font-black" : "text-slate-500 font-bold"}>
                                  {item.default_discount_percentage || 0}%
                                </span>
                                {item.farmer_discount_percentage != null && item.farmer_discount_percentage !== (item.default_discount_percentage || 0) && (
                                  <>
                                    <span className="text-slate-300 mx-0.5">,</span>
                                    <span className={item.discount_percentage === item.farmer_discount_percentage ? "text-emerald-700 font-black" : "text-slate-500 font-bold"}>
                                      {item.farmer_discount_percentage}%
                                    </span>
                                  </>
                                )}
                                {item.discount_percentage !== (item.default_discount_percentage || 0) && item.discount_percentage !== item.farmer_discount_percentage && (
                                  <>
                                    <span className="text-slate-300 mx-0.5">,</span>
                                    <span className="text-emerald-700 font-black">{item.discount_percentage}%</span>
                                  </>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </div>
                          <div className="flex justify-end">
                             <RateInput
                               item={item}
                               unitPrice={unitPrice}
                               onDiscount={updateItemDiscount}
                               onPrice={updateItemPrice}
                             />
                           </div>
                          <div className="flex justify-center">
                            <QuantityInput 
                              item={item} 
                              onChange={updateQuantity} 
                            />
                          </div>
                          <div className="flex justify-end">
                            <AmountInput item={item} onDiscount={updateItemDiscount} onPrice={updateItemPrice} />
                          </div>
                         <div className="flex items-center justify-end">
                            <button onClick={() => removeItem(item.inventory_id, item.lot_id)} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-all"><Trash2 className="w-4 h-4" /></button>
                         </div>
                       </div>
                     );
                   })}
                   {/* Items subtotal row */}
                   <div className="grid grid-cols-none gap-2 items-center px-2 pt-2 border-t border-slate-200 mt-1" style={{ gridTemplateColumns: '1.5rem minmax(0,1fr) 4.25rem 6rem 4.75rem 3.5rem 5.25rem 1.5rem' }}>
                     <span /><span /><span /><span /><span />
                     <span className="text-right text-[10px] font-black uppercase tracking-wider text-slate-500">Subtotal</span>
                     <span className="text-right text-sm font-black text-slate-800 tabular-nums">{formatCurrency(totals.subtotal)}</span>
                     <span />
                   </div>
                 </div>
               ) : (
                 <div className="h-full flex flex-col items-center justify-center min-h-[250px] p-6 text-center animate-fade-in relative overflow-hidden rounded-2xl border-2 border-dashed border-slate-200/60 bg-slate-50/50">
                   {/* Background Glow */}
                   <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
                   
                   <div className="relative mb-5 p-4 bg-white rounded-full shadow-sm ring-1 ring-slate-900/5">
                     <div className="absolute inset-0 bg-blue-50 rounded-full animate-ping opacity-20" style={{ animationDuration: '3s' }} />
                     <Receipt className="w-10 h-10 text-blue-500 relative z-10" strokeWidth={1.5} />
                   </div>
                   
                   <h3 className="text-sm font-bold text-slate-800 mb-1.5 relative z-10">Your cart is empty</h3>
                   <p className="text-xs font-semibold text-slate-500 max-w-[200px] leading-relaxed relative z-10">
                     Select your first item from the catalog to start building this invoice.
                   </p>
                 </div>
               )}
              </div>
              {hasMoreBelow && (
                <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-white via-white/50 to-transparent flex items-end justify-center pb-0.5">
                  <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-white shadow-sm border border-slate-200 px-2.5 py-1 rounded-full">
                    ↓ more items below
                  </span>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-white shrink-0 space-y-3">
               {/* Mobile/Tablet Subtotal & Total Headers */}
               <div className="lg:hidden">
                 <div className="flex items-center justify-between text-sm mb-2">
                   <span className="text-slate-500 font-medium">Subtotal ({totals.count} Items)</span>
                   <span className="font-bold text-slate-900">{formatCurrency(totals.subtotal)}</span>
                 </div>
                 <div className="flex items-center justify-between pt-1">
                   <span className="text-base font-bold text-slate-900">Total Amount</span>
                   <span className="text-2xl font-black text-slate-900">{formatCurrency(totals.finalTotal)}</span>
                 </div>
               </div>

               {/* Desktop and Mobile Payment Fields (Zero-Step POS) */}
               <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 space-y-2.5">
                 <div>
                   <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Payment Method</label>
                   <div className="grid grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1">
                     <button onClick={() => setPaymentType('cash')} className={`flex flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 text-xs font-bold transition-all ${paymentType === 'cash' ? 'bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-100' : 'text-slate-500 hover:text-slate-700'}`}>
                       <Banknote className="w-3.5 h-3.5" /> Cash
                     </button>
                     <button onClick={() => setPaymentType('upi')} className={`flex flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 text-xs font-bold transition-all ${paymentType === 'upi' ? 'bg-white text-blue-700 shadow-sm ring-1 ring-blue-100' : 'text-slate-500 hover:text-slate-700'}`}>
                       <QrCode className="w-3.5 h-3.5" /> UPI
                     </button>
                     <button onClick={() => setPaymentType('other')} className={`flex flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 text-xs font-bold transition-all ${paymentType === 'other' ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-indigo-100' : 'text-slate-500 hover:text-slate-700'}`}>
                       <CreditCard className="w-3.5 h-3.5" /> Bank
                     </button>
                     <button onClick={() => setPaymentType('credit')} className={`flex flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 text-xs font-bold transition-all ${paymentType === 'credit' ? 'bg-white text-rose-700 shadow-sm ring-1 ring-rose-100' : 'text-slate-500 hover:text-slate-700'}`}>
                       <Receipt className="w-3.5 h-3.5" /> Credit
                     </button>
                   </div>
                 </div>

                 <div className={`grid gap-2.5 ${paymentType === 'credit' ? 'grid-cols-1' : 'grid-cols-2'}`}>
                   <div>
                     <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Amount Received</label>
                     <Input
                       type="number"
                       value={amountPaid || ''}
                       onChange={(e) => setAmountPaid(Math.min(Number(e.target.value) || 0, effectiveTotal))}
                       placeholder="0"
                       leftIcon={<span className="text-sm font-black text-slate-400">₹</span>}
                       className="min-h-9 border-slate-200 bg-white text-right text-base font-black text-slate-800 shadow-sm focus:border-emerald-400 focus:ring-emerald-200"
                     />
                   </div>
                   {paymentType !== 'credit' && (
                     <div>
                       <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Settlement Disc.</label>
                       <Input
                         type="number"
                         min={0}
                         max={totals.finalTotal}
                         value={settlementDiscountAmount || ''}
                         onChange={(e) => {
                           const v = Math.min(Math.max(0, Number(e.target.value) || 0), totals.finalTotal);
                           setSettlementDiscount(v);
                           setAmountPaid(Math.min(amountPaid, Math.max(0, totals.finalTotal - v)));
                         }}
                         placeholder="0"
                         leftIcon={<span className="text-sm font-black text-slate-400">₹</span>}
                         className="min-h-9 border-slate-200 bg-white text-right text-base font-black text-slate-800 shadow-sm focus:border-emerald-400 focus:ring-emerald-200"
                       />
                     </div>
                   )}
                 </div>

                 {paymentType === 'upi' && (
                   <Input label="UPI Reference" value={upiRef} onChange={(e) => setUpiRef(e.target.value)} placeholder="Transaction ID (optional)" />
                 )}
                 {paymentType === 'other' && (
                   <Input label="Cheque / Transfer Ref" value={chequeNumber} onChange={(e) => setChequeNumber(e.target.value)} placeholder="Cheque or Ref number" />
                 )}

                 <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5">
                   <div className="flex-1">
                     <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Balance Due</div>
                     <div className={`text-sm font-black tabular-nums ${balanceDue > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatCurrency(balanceDue)}</div>
                   </div>
                   {settlementDiscountAmount > 0 && (
                     <div className="flex-1 border-l border-slate-100 pl-2.5">
                       <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Effective Total</div>
                       <div className="text-sm font-black tabular-nums text-emerald-600">{formatCurrency(effectiveTotal)}</div>
                     </div>
                   )}
                 </div>
               </div>
               
               <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-[#0a46c2] text-white border border-blue-600/50 rounded-xl px-4 py-2.5 flex flex-col gap-2 shadow-lg">
                 {/* Mesh Gradient Pattern (Premium Effect) */}
                 <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.1)_0%,transparent_50%),radial-gradient(circle_at_70%_80%,rgba(0,255,255,0.1)_0%,transparent_50%)] mix-blend-overlay" />
                 <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
                 <div className="absolute bottom-0 left-0 w-32 h-32 bg-cyan-400/20 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none" />
                 
                 <div className="relative z-10 flex justify-between items-end">
                   <div>
                     <div className="text-blue-100/80 text-xs font-bold mb-1 tracking-wide uppercase">{settlementDiscountAmount > 0 ? 'Effective Total' : 'Total Amount'}</div>
                     <div className="flex items-baseline gap-2">
                       {settlementDiscountAmount > 0 && (
                         <span className="text-base font-bold text-blue-300 line-through tabular-nums">{formatCurrency(totals.finalTotal)}</span>
                       )}
                       <span className="text-2xl font-black text-white tracking-tight drop-shadow-sm">{formatCurrency(effectiveTotal)}</span>
                     </div>
                     <div className="text-blue-100 text-xs font-bold mt-0.5 opacity-90">{totals.count} Items • {totals.count} Bags</div>
                   </div>
                   
                   {/* Mobile Button: Continue to Payment */}
                   <button onClick={onNext} disabled={items.length === 0} className="lg:hidden group relative overflow-hidden bg-white text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-black px-5 py-2 shadow-[0_4px_15px_rgba(0,0,0,0.1)] rounded-lg text-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.02] hover:shadow-[0_8px_20px_rgba(255,255,255,0.2)] shrink-0 h-[38px]">
                     <div className="absolute inset-0 -translate-x-[150%] bg-gradient-to-r from-transparent via-blue-600/10 to-transparent skew-x-[-20deg] transition-all duration-700 ease-in-out group-hover:translate-x-[150%]" />
                     <span className="relative z-10 flex items-center gap-2">
                       Next
                       <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" strokeWidth={3} />
                     </span>
                   </button>

                   {/* Desktop Button: Review & Sign */}
                   <button onClick={onNext} disabled={items.length === 0} className="hidden lg:flex group relative overflow-hidden bg-white text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-black px-5 py-2 shadow-[0_4px_15px_rgba(0,0,0,0.1)] rounded-lg text-sm items-center justify-center gap-2 transition-all hover:scale-[1.02] hover:shadow-[0_8px_20px_rgba(255,255,255,0.2)] shrink-0 h-[38px]">
                     <div className="absolute inset-0 -translate-x-[150%] bg-gradient-to-r from-transparent via-blue-600/10 to-transparent skew-x-[-20deg] transition-all duration-700 ease-in-out group-hover:translate-x-[150%]" />
                     <span className="relative z-10 flex items-center gap-2">
                       Review & Sign
                       <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" strokeWidth={3} />
                     </span>
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
        contentClassName="px-2 py-3 sm:px-4"
      >
        <FarmerSelector onSelect={() => setShowFarmerModal(false)} />
      </Modal>

      <QuickAddWalkInModal
        isOpen={showWalkInDetails}
        onClose={() => setShowWalkInDetails(false)}
        onSuccess={(farmer) => {
          setFarmer(farmer.id, farmer.name, farmer.total_due, farmer.credit_limit);
          setDesktopFarmerSearch(farmer.name);
          setShowWalkInDetails(false);
        }}
      />

      <QuickAddFarmerModal
        isOpen={showQuickAddFarmer}
        onClose={() => setShowQuickAddFarmer(false)}
        initialName={desktopFarmerSearch}
        onSuccess={(farmer) => {
          setFarmer(farmer.id, farmer.name, farmer.total_due, farmer.credit_limit);
          setDesktopFarmerSearch(farmer.name);
          setShowQuickAddFarmer(false);
        }}
      />

      <FarmerActionModal
        isOpen={!!farmerActionMode}
        mode={farmerActionMode || 'payment'}
        onClose={() => setFarmerActionMode(null)}
      />

      <Modal
        isOpen={!!sheetType}
        onClose={() => setSheetType(null)}
        title={sheetType === 'medicine' ? 'Select medicine' : 'Select feed'}
        className="max-w-lg lg:hidden"
      >
        <div className="flex flex-col h-[70vh] -mx-5 sm:-mx-6 -mb-5">
          <div className="shrink-0 bg-white pb-3 border-b border-slate-100/50 mb-3 px-4 sm:px-5">
            <SearchBar value={search} onChange={setSearch} placeholder={t('billing.searchProducts', 'Search products')} showVoicePlaceholder />
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-3">
            {renderProductList(sheetInventory, sheetCatalog, false, sheetType || undefined)}
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!editingCartItem}
        onClose={() => setEditingCartItem(null)}
        title="Edit Item"
        footer={
          <div className="flex gap-3 px-5 py-4 sm:px-6">
            <Button variant="outline" className="flex-1" onClick={() => setEditingCartItem(null)}>Cancel</Button>
            <Button className="flex-1" onClick={handleSaveEdit}>Save</Button>
          </div>
        }
      >
        <div className="p-4 space-y-4">
          {(() => {
            if (!editingCartItem) return null;
            const invItem = inventory.find(i => i.id === editingCartItem.inventory_id);
            if (!invItem) return null;
            const lots = getLotsWithStock(invItem);
            if (lots.length <= 1) return null; // hide if only 1 batch or no batches
            
            return (
              <div className="space-y-2 mb-4">
                <label className="text-sm font-bold text-slate-700">Select Batch</label>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {lots.map(lot => {
                    const badge = getBadgeForLot(lot, lots);
                    const isSelected = editLotId === lot.id;
                    return (
                      <div 
                        key={lot.id} 
                        onClick={() => {
                          setEditLotId(lot.id);
                          const mrp = lot.mrp || 0;
                          const sp = lot.selling_price || lot.final_unit_price || 0;
                          const disc = mrp > 0 ? ((mrp - sp) / mrp) * 100 : 0;
                          setEditPrice(mrp.toString());
                          setEditSellingPrice(sp.toString());
                          setEditDiscount(disc.toFixed(2));
                        }}
                        className={`p-3 border rounded-xl cursor-pointer transition-colors ${isSelected ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-slate-200 hover:bg-slate-50'}`}
                      >
                         <div className="flex items-center justify-between mb-1">
                           <div className="flex items-center gap-2">
                             <span className="font-bold text-sm text-slate-800">{lot.batch_number || 'No Batch #'}</span>
                             {badge && (
                               <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide text-white ${badge === 'New' ? 'bg-emerald-500' : badge === 'Very Old' ? 'bg-rose-500' : 'bg-amber-500'}`}>
                                 {badge}
                               </span>
                             )}
                           </div>
                            <span className="text-xs font-semibold text-blue-600">{formatQuantity(lot.remaining_quantity, invItem.product.unit)} available</span>
                         </div>
                         <div className="flex items-center justify-between text-xs text-slate-500">
                           <span>MRP: {formatCurrency(lot.mrp || 0)}</span>
                           <span className="font-bold text-slate-700">Selling: {formatCurrency(lot.selling_price || lot.final_unit_price || 0)}</span>
                           {lot.expiry_date && <span>Exp: {lot.expiry_date.slice(0, 7)}</span>}
                         </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
          
          {(() => {
            if (!editingCartItem) return null;
            const invItem = inventory.find(i => i.id === editingCartItem.inventory_id);
            if (!invItem || normalizeType(invItem.product.type) !== 'medicine') return null;
            
            const cartItem = items.find(i => i.inventory_id === editingCartItem.inventory_id && i.lot_id === editLotId);
            const defaultDisc = cartItem?.default_discount_percentage || 0;
            const farmerDisc = cartItem?.farmer_discount_percentage;
            
            if (farmerDisc != null && farmerDisc !== defaultDisc) {
              return (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4 space-y-2">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Discount Options</div>
                  <div className="flex flex-col gap-2">
                    <button 
                      className={`flex justify-between items-center px-3 py-2 border rounded-lg transition-colors ${Number(editDiscount) === defaultDisc ? 'border-primary bg-primary/5 text-primary shadow-sm' : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'}`}
                      onClick={() => handleDiscountChange(defaultDisc.toString())}
                    >
                      <span className="text-sm font-semibold">Default Discount</span>
                      <span className="font-black">{defaultDisc}%</span>
                    </button>
                    <button 
                      className={`flex justify-between items-center px-3 py-2 border rounded-lg transition-colors ${Number(editDiscount) === farmerDisc ? 'border-primary bg-primary/5 text-primary shadow-sm' : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'}`}
                      onClick={() => handleDiscountChange(farmerDisc.toString())}
                    >
                      <span className="text-sm font-semibold">Previous/Farmer Discount</span>
                      <span className="font-black">{farmerDisc}%</span>
                    </button>
                  </div>
                </div>
              );
            }
            return null;
          })()}
          
          <Input
            label="MRP"
            type="number"
            value={editPrice}
            onChange={(e) => handleMrpChange(e.target.value)}
            placeholder="Enter MRP"
            min={0}
            step="0.01"
          />
          <Input
            label="Discount (%)"
            type="number"
            value={editDiscount}
            onChange={(e) => handleDiscountChange(e.target.value)}
            placeholder="Enter discount percentage"
            min={0}
            max={100}
            step="0.01"
          />
          <Input
            label="Selling Price"
            type="number"
            value={editSellingPrice}
            onChange={(e) => handleSellingPriceChange(e.target.value)}
            placeholder="Enter selling price"
            min={0}
            step="0.01"
          />
        </div>
      </Modal>
    </>
  );
};

export default ProductSelector;
