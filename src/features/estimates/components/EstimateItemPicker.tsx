// src/features/estimates/components/EstimateItemPicker.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Search, X, Plus, Minus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useBranchStore } from '@/stores/branchStore';
import { useFarmerProductDiscounts } from '@/features/farmers/hooks/useFarmers';
import { useEstimateCartStore } from '../stores/estimateCartStore';
import type { EstimateCartItem } from '../types';
import { formatCurrency } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProductSearchResult {
  inventory_id: string;
  product_id: string;
  product_name: string;
  product_type: string;
  unit: string;
  hsn_code: string | null;
  mrp: number;
  selling_price: number;
  default_discount_percentage: number; // sourced from inventory.medicine_discount_percentage
  gst_rate: number;
  available_quantity: number;
}

interface FarmerSearchResult {
  id: string;
  name: string;
  village: string | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const EstimateItemPicker: React.FC = () => {
  const { user } = useAuthStore();
  const { activeBranch } = useBranchStore();
  const {
    farmerId, farmerName, items, gstEnabled,
    setFarmer, clearFarmer, addItem, removeItem, updateQuantity,
    setGstEnabled,
  } = useEstimateCartStore();

  const farmerInputRef  = useRef<HTMLInputElement>(null);
  const productInputRef = useRef<HTMLInputElement>(null);

  const [farmerQuery, setFarmerQuery]     = useState('');
  const [farmerResults, setFarmerResults] = useState<FarmerSearchResult[]>([]);
  const [farmerLoading, setFarmerLoading] = useState(false);
  const [showFarmerList, setShowFarmerList] = useState(false);

  const [productQuery, setProductQuery]     = useState('');
  const [productResults, setProductResults] = useState<ProductSearchResult[]>([]);
  const [productLoading, setProductLoading] = useState(false);

  // farmer-product discounts via React Query (same as billing ProductSelector)
  const { data: farmerDiscounts = [] } = useFarmerProductDiscounts(farmerId || '');

  // ── Farmer search ──────────────────────────────────────────────────────────

  const searchFarmers = useCallback(async (q: string) => {
    if (!user?.id || q.trim().length < 1) { setFarmerResults([]); return; }
    setFarmerLoading(true);
    const { data } = await supabase
      .from('farmers')
      .select('id, name, village')
      .eq('dealer_id', user.id)
      .eq('is_active', true)
      .ilike('name', `%${q}%`)
      .limit(10);
    setFarmerResults((data as FarmerSearchResult[]) || []);
    setFarmerLoading(false);
  }, [user?.id]);

  useEffect(() => {
    const t = setTimeout(() => searchFarmers(farmerQuery), 300);
    return () => clearTimeout(t);
  }, [farmerQuery, searchFarmers]);

  const handleSelectFarmer = (f: FarmerSearchResult) => {
    setFarmer(f.id, f.name);
    setFarmerQuery('');
    setFarmerResults([]);
    setShowFarmerList(false);
  };

  // ── Product search ─────────────────────────────────────────────────────────

  const searchProducts = useCallback(async (q: string) => {
    if (!user?.id || q.trim().length < 1) { setProductResults([]); return; }
    setProductLoading(true);

    let query = supabase
      .from('inventory')
      .select(`
        id,
        product_id,
        selling_price,
        mrp,
        medicine_discount_percentage,
        quantity_in_stock,
        products!inner(id, name, type, unit, hsn_code, gst_rate, is_active)
      `)
      .eq('dealer_id', user.id)
      .or(`name.ilike.%${q}%`, { referencedTable: 'products' })
      .limit(20);

    if (activeBranch?.id) query = query.eq('branch_id', activeBranch.id);

    const { data } = await query;
    const rows = (data || []) as any[];
    setProductResults(
      rows
        .filter((row) => row.products?.is_active !== false)
        .map((row) => ({
          inventory_id: row.id,
          product_id: row.products.id,
          product_name: row.products.name,
          product_type: row.products.type,
          unit: row.products.unit,
          hsn_code: row.products.hsn_code,
          mrp: row.mrp || 0,
          selling_price: row.selling_price || 0,
          default_discount_percentage: row.medicine_discount_percentage || 0,
          gst_rate: row.products.gst_rate || 0,
          available_quantity: row.quantity_in_stock,
        }))
    );
    setProductLoading(false);
  }, [user?.id, activeBranch?.id]);

  useEffect(() => {
    const t = setTimeout(() => searchProducts(productQuery), 300);
    return () => clearTimeout(t);
  }, [productQuery, searchProducts]);

  const handleAddProduct = (p: ProductSearchResult) => {
    // farmer-specific > product default (same precedence as billing ProductSelector)
    const farmerEntry = farmerDiscounts.find(d => d.product_id === p.product_id);
    const farmerPct = farmerEntry ? Number(farmerEntry.discount_percentage) : undefined;
    const discountPct = farmerPct ?? p.default_discount_percentage;
    const discountSource: EstimateCartItem['discount_source'] =
      farmerPct !== undefined
        ? 'farmer_product'
        : p.default_discount_percentage > 0 ? 'product_default' : 'manual';

    const unit_price = Number(
      (p.selling_price * (1 - discountPct / 100)).toFixed(2)
    );

    const item: EstimateCartItem = {
      product_id: p.product_id,
      product_name: p.product_name,
      product_type: p.product_type,
      unit: p.unit,
      hsn_code: p.hsn_code,
      quantity: 1,
      base_unit_price: p.selling_price,
      unit_price,
      discount_percentage: discountPct,
      gst_rate: p.gst_rate,
      mrp: p.mrp,
      default_discount_percentage: p.default_discount_percentage,
      farmer_discount_percentage: farmerPct ?? null,
      discount_source: discountSource,
    };

    addItem(item);
    setProductQuery('');
    setProductResults([]);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">
      {/* Farmer picker */}
      <div className="relative">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Farmer <span className="text-red-500">*</span>
        </label>
        {farmerId ? (
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <span className="flex-1 font-medium text-gray-900">{farmerName}</span>
            <button
              type="button"
              onClick={() => clearFarmer()}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              ref={farmerInputRef}
              type="text"
              placeholder="Search farmer..."
              value={farmerQuery}
              onChange={e => { setFarmerQuery(e.target.value); setShowFarmerList(true); }}
              onFocus={() => setShowFarmerList(true)}
              onBlur={() => setTimeout(() => setShowFarmerList(false), 150)}
              className="w-full rounded-lg border border-gray-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {showFarmerList && farmerResults.length > 0 && (() => {
              const rect = farmerInputRef.current?.getBoundingClientRect();
              if (!rect) return null;
              return ReactDOM.createPortal(
                <div
                  style={{ position: 'fixed', top: rect.bottom + 4, left: rect.left, width: rect.width, zIndex: 9999 }}
                  className="rounded-lg border bg-white shadow-lg max-h-56 overflow-y-auto"
                >
                  {farmerResults.map(f => (
                    <button
                      key={f.id}
                      type="button"
                      onMouseDown={() => handleSelectFarmer(f)}
                      className="flex w-full flex-col px-3 py-2 text-left hover:bg-gray-50"
                    >
                      <span className="font-medium text-sm text-gray-900">{f.name}</span>
                      {f.village && <span className="text-xs text-gray-500">{f.village}</span>}
                    </button>
                  ))}
                </div>,
                document.body
              );
            })()}
          </div>
        )}
      </div>

      {/* Product search (only show once farmer selected) */}
      {farmerId && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Add Items</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              ref={productInputRef}
              type="text"
              placeholder="Search product..."
              value={productQuery}
              onChange={e => setProductQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          {productResults.length > 0 && (() => {
            const rect = productInputRef.current?.getBoundingClientRect();
            if (!rect) return null;
            return ReactDOM.createPortal(
              <div
                style={{ position: 'fixed', top: rect.bottom + 4, left: rect.left, width: rect.width, zIndex: 9999 }}
                className="rounded-lg border bg-white shadow-lg max-h-64 overflow-y-auto"
              >
                {productResults.map(p => (
                  <button
                    key={p.product_id}
                    type="button"
                    onMouseDown={() => handleAddProduct(p)}
                    className="flex w-full items-center justify-between px-3 py-2 hover:bg-gray-50 text-left"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{p.product_name}</p>
                      <p className="text-xs text-gray-500">{p.unit} · Stock: {p.available_quantity}</p>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">
                      {formatCurrency(p.selling_price)}
                    </span>
                  </button>
                ))}
              </div>,
              document.body
            );
          })()}
        </div>
      )}

      {/* Cart item list */}
      {items.length > 0 && (
        <div className="flex flex-col gap-2">
          {items.map(item => (
            <div
              key={item.product_id}
              className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{item.product_name}</p>
                <p className="text-xs text-gray-500">
                  {formatCurrency(item.unit_price)}/{item.unit}
                  {item.discount_percentage > 0 && (
                    <span className="ml-1 text-emerald-600">({item.discount_percentage}% off)</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => updateQuantity(item.product_id, Math.max(1, item.quantity - 1))}
                  className="rounded-md p-1 hover:bg-gray-200"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={e => updateQuantity(item.product_id, Math.max(1, Number(e.target.value)))}
                  className="w-12 text-center text-sm border border-gray-200 rounded px-1 py-0.5"
                />
                <button
                  type="button"
                  onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                  className="rounded-md p-1 hover:bg-gray-200"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
              <span className="text-sm font-semibold w-20 text-right text-gray-900">
                {formatCurrency(item.unit_price * item.quantity)}
              </span>
              <button
                type="button"
                onClick={() => removeItem(item.product_id)}
                className="text-gray-400 hover:text-red-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* GST toggle */}
      {items.length > 0 && (
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={gstEnabled}
            onChange={e => setGstEnabled(e.target.checked)}
            className="h-4 w-4 rounded accent-primary"
          />
          <span className="text-sm text-gray-700">Include GST</span>
        </label>
      )}
    </div>
  );
};
