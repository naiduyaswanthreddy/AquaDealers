import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Search, X, Plus, Minus, User, Package } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useBranchStore } from '@/stores/branchStore';
import { useFarmerProductDiscounts } from '@/features/farmers/hooks/useFarmers';
import { useEstimateCartStore } from '../stores/estimateCartStore';
import type { EstimateCartItem } from '../types';
import { formatCurrency } from '@/lib/utils';

interface ProductSearchResult {
  inventory_id: string;
  product_id: string;
  product_name: string;
  product_type: string;
  unit: string;
  hsn_code: string | null;
  mrp: number;
  selling_price: number;
  default_discount_percentage: number;
  gst_rate: number;
  available_quantity: number;
}

interface FarmerSearchResult {
  id: string;
  name: string;
  village: string | null;
}

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

    addItem({
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
    });
    setProductQuery('');
    setProductResults([]);
  };

  const farmerInitial = farmerName?.[0]?.toUpperCase() ?? '?';

  return (
    <div className="flex flex-col gap-5">

      {/* ── Farmer picker ─────────────────────────────────────────── */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-[#5d7486] mb-2">
          Farmer <span className="text-red-500 normal-case tracking-normal">*</span>
        </label>

        {farmerId ? (
          <div
            className="flex items-center gap-3 rounded-2xl border border-[#0052cc]/20 bg-[#e7f5ff] px-4 py-3"
            style={{ boxShadow: 'inset 0 0 0 1px rgba(0,82,204,0.08)' }}
          >
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#0052cc,#3385ff)' }}
            >
              {farmerInitial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[#173042] text-sm leading-tight">{farmerName}</p>
              <p className="text-[0.7rem] text-[#5d7486] mt-0.5">Selected farmer</p>
            </div>
            <button
              type="button"
              onClick={() => clearFarmer()}
              className="flex h-7 w-7 items-center justify-center rounded-full text-[#5d7486] hover:bg-[#0052cc]/10 hover:text-[#0052cc] transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center">
              <User className="h-4 w-4 text-[#8ba0af]" />
            </div>
            <input
              ref={farmerInputRef}
              type="text"
              placeholder="Search by farmer name…"
              value={farmerQuery}
              onChange={e => { setFarmerQuery(e.target.value); setShowFarmerList(true); }}
              onFocus={() => setShowFarmerList(true)}
              onBlur={() => setTimeout(() => setShowFarmerList(false), 150)}
              className="w-full rounded-2xl border border-[#d9e5ee] bg-white pl-10 pr-4 py-3 text-sm text-[#173042] placeholder:text-[#8ba0af] focus:outline-none focus:border-[#0052cc] focus:ring-2 focus:ring-[#0052cc]/15 transition-all"
            />
            {farmerLoading && (
              <div className="absolute inset-y-0 right-3.5 flex items-center">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#0052cc] border-t-transparent" />
              </div>
            )}
            {showFarmerList && farmerResults.length > 0 && (() => {
              const rect = farmerInputRef.current?.getBoundingClientRect();
              if (!rect) return null;
              return ReactDOM.createPortal(
                <div
                  style={{ position: 'fixed', top: rect.bottom + 6, left: rect.left, width: rect.width, zIndex: 9999, boxShadow: '0 12px 28px rgba(20,54,84,0.12)', borderRadius: '1rem', overflow: 'hidden', border: '1px solid #d9e5ee', background: '#fff' }}
                >
                  {farmerResults.map((f, i) => (
                    <button
                      key={f.id}
                      type="button"
                      onMouseDown={() => handleSelectFarmer(f)}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[#e7f5ff] transition-colors ${i > 0 ? 'border-t border-[#f0f7ff]' : ''}`}
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e7f5ff] text-xs font-bold text-[#0052cc] flex-shrink-0">
                        {f.name[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-[#173042]">{f.name}</p>
                        {f.village && <p className="text-xs text-[#8ba0af]">{f.village}</p>}
                      </div>
                    </button>
                  ))}
                </div>,
                document.body
              );
            })()}
          </div>
        )}
      </div>

      {/* ── Product search ─────────────────────────────────────────── */}
      {farmerId && (
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-[#5d7486] mb-2">
            Add Items
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center">
              <Search className="h-4 w-4 text-[#8ba0af]" />
            </div>
            <input
              ref={productInputRef}
              type="text"
              placeholder="Search product…"
              value={productQuery}
              onChange={e => setProductQuery(e.target.value)}
              className="w-full rounded-2xl border border-[#d9e5ee] bg-white pl-10 pr-4 py-3 text-sm text-[#173042] placeholder:text-[#8ba0af] focus:outline-none focus:border-[#0052cc] focus:ring-2 focus:ring-[#0052cc]/15 transition-all"
            />
            {productLoading && (
              <div className="absolute inset-y-0 right-3.5 flex items-center">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#0052cc] border-t-transparent" />
              </div>
            )}
          </div>

          {productResults.length > 0 && (() => {
            const rect = productInputRef.current?.getBoundingClientRect();
            if (!rect) return null;
            return ReactDOM.createPortal(
              <div
                style={{ position: 'fixed', top: rect.bottom + 6, left: rect.left, width: rect.width, zIndex: 9999, boxShadow: '0 12px 28px rgba(20,54,84,0.12)', borderRadius: '1rem', overflow: 'hidden', border: '1px solid #d9e5ee', background: '#fff', maxHeight: '17rem', overflowY: 'auto' }}
              >
                {productResults.map((p, i) => {
                  const farmerEntry = farmerDiscounts.find(d => d.product_id === p.product_id);
                  const effectiveDiscount = farmerEntry ? Number(farmerEntry.discount_percentage) : p.default_discount_percentage;
                  return (
                    <button
                      key={p.product_id}
                      type="button"
                      onMouseDown={() => handleAddProduct(p)}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[#e7f5ff] transition-colors ${i > 0 ? 'border-t border-[#f0f7ff]' : ''}`}
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#f0f7ff] flex-shrink-0">
                        <Package className="h-4 w-4 text-[#0052cc]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-[#173042] truncate">{p.product_name}</p>
                        <p className="text-xs text-[#8ba0af]">{p.unit} · Stock: {p.available_quantity}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-[#173042]">{formatCurrency(p.selling_price)}</p>
                        {effectiveDiscount > 0 && (
                          <span className="inline-block text-[0.65rem] font-semibold text-emerald-700 bg-emerald-50 rounded-full px-1.5 py-0.5 mt-0.5">
                            {effectiveDiscount}% off
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>,
              document.body
            );
          })()}
        </div>
      )}

      {/* ── Cart items ─────────────────────────────────────────────── */}
      {items.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <p className="text-xs font-bold uppercase tracking-widest text-[#5d7486]">
            {items.length} item{items.length > 1 ? 's' : ''} added
          </p>
          {items.map(item => (
            <div
              key={item.product_id}
              className="flex items-center gap-3 rounded-2xl bg-white border border-[#d9e5ee] px-4 py-3 overflow-hidden relative"
              style={{ boxShadow: '0 2px 8px rgba(20,54,84,0.05)' }}
            >
              {/* left accent stripe */}
              <div className="absolute left-0 inset-y-0 w-1 rounded-l-2xl bg-[#0052cc]" />

              <div className="flex-1 min-w-0 pl-1">
                <p className="text-sm font-semibold text-[#173042] truncate">{item.product_name}</p>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <span className="text-xs text-[#5d7486]">{formatCurrency(item.unit_price)}/{item.unit}</span>
                  {item.discount_percentage > 0 && (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-1.5 py-0.5 text-[0.65rem] font-semibold text-emerald-700 border border-emerald-100">
                      {item.discount_percentage}% off
                    </span>
                  )}
                </div>
              </div>

              {/* qty controls */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => updateQuantity(item.product_id, Math.max(1, item.quantity - 1))}
                  className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#e7f5ff] text-[#0052cc] hover:bg-[#0052cc] hover:text-white transition-colors"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={e => updateQuantity(item.product_id, Math.max(1, Number(e.target.value)))}
                  className="w-10 text-center text-sm font-semibold text-[#173042] border border-[#d9e5ee] rounded-xl px-1 py-1 focus:outline-none focus:border-[#0052cc]"
                />
                <button
                  type="button"
                  onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                  className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#e7f5ff] text-[#0052cc] hover:bg-[#0052cc] hover:text-white transition-colors"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>

              <span className="text-sm font-bold text-[#173042] w-16 text-right flex-shrink-0">
                {formatCurrency(item.unit_price * item.quantity)}
              </span>

              <button
                type="button"
                onClick={() => removeItem(item.product_id)}
                className="flex h-7 w-7 items-center justify-center rounded-xl text-[#8ba0af] hover:bg-red-50 hover:text-red-500 transition-colors flex-shrink-0"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── GST toggle ─────────────────────────────────────────────── */}
      {items.length > 0 && (
        <label className="flex items-center gap-3 cursor-pointer select-none rounded-2xl border border-[#d9e5ee] bg-white px-4 py-3" style={{ boxShadow: '0 2px 8px rgba(20,54,84,0.04)' }}>
          <div className="relative flex-shrink-0">
            <input
              type="checkbox"
              checked={gstEnabled}
              onChange={e => setGstEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-10 h-5 rounded-full border-2 border-[#d9e5ee] bg-[#f0f7ff] peer-checked:bg-[#0052cc] peer-checked:border-[#0052cc] transition-colors" />
            <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#173042]">Include GST</p>
            <p className="text-xs text-[#8ba0af]">Adds applicable tax to item prices</p>
          </div>
        </label>
      )}
    </div>
  );
};
