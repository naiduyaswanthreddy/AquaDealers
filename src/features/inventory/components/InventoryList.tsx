import React, { useState } from 'react';
import { Package2, Boxes } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { InventoryItem } from '../types';
import { useFeatureGate } from '@/stores/subscriptionStore';
import StockAdjustmentModal from './StockAdjustmentModal';
import {
  getInventoryBasePrice,
  getInventoryDiscountPercentage,
  getInventoryDisplayPrice,
  isMedicineProduct,
} from '../utils/pricing';

interface InventoryListProps {
  items: InventoryItem[];
}

const InventoryList: React.FC<InventoryListProps> = ({ items }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(null);

  const getProductArt = (type?: string | null) => {
    const normalized = (type || '').toLowerCase();
    if (normalized.includes('feed')) return new URL('../../../../feed.svg', import.meta.url).href;
    if (normalized.includes('medicine') || normalized.includes('medic')) {
      return new URL('../../../../medicine_.svg', import.meta.url).href;
    }
    return null;
  };

  const formatExpiryDate = (value?: string | null) => {
    if (!value) return null;

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;

    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(parsed);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatMovementDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const parsed = new Date(dateString);
    if (Number.isNaN(parsed.getTime())) return '-';
    
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(parsed);
  };

  const hasImageAddon = useFeatureGate('product_image');
  const getPriceLabel = (item: InventoryItem) => {
    const displayPrice = getInventoryDisplayPrice(item);
    const basePrice = getInventoryBasePrice(item);
    const discount = getInventoryDiscountPercentage(item);
    const hasMedicineDiscount = isMedicineProduct(item.product.type) && discount > 0 && displayPrice !== basePrice;

    return { displayPrice, basePrice, discount, hasMedicineDiscount };
  };

  if (hasImageAddon) {
    return (
      <>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 w-full">
          {items.map((item) => {
            const lowStock = (item.quantity_in_stock || 0) <= (item.min_stock_alert || 0);
            const expiryLabel = formatExpiryDate(item.expiry_date);
            const price = getPriceLabel(item);
          
            let displayImage = item.image_url;
            if (!displayImage) {
              displayImage = getProductArt(item.product.type);
            }
            return (
              <div
                key={item.id}
                onClick={() => navigate(`/inventory/${item.id}`, { state: { from: '/inventory' } })}
                className="group flex flex-col cursor-pointer overflow-hidden rounded-[20px] sm:rounded-[24px] border border-slate-200/80 bg-white shadow-[0_4px_12px_rgba(0,0,0,0.03)] transition-all hover:-translate-y-1 hover:border-slate-300 hover:shadow-[0_12px_24px_rgba(0,0,0,0.08)]"
              >
                {/* Top Image Section */}
                <div className="h-28 sm:h-36 w-full bg-[#F8FAFC] flex items-center justify-center p-2 sm:p-3 border-b border-slate-100/80 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-100/50 mix-blend-multiply opacity-50"></div>
                  {displayImage ? (
                    <img
                      src={displayImage}
                      alt=""
                      aria-hidden="true"
                      className="h-full w-full object-contain filter drop-shadow-sm transition-transform duration-500 scale-110 group-hover:scale-125"
                    />
                  ) : (
                    <Package2 className="h-10 w-10 text-slate-300" />
                  )}
                  
                  {/* Status Badge overlaying the image */}
                  <div className="absolute top-2 right-2 sm:top-3 sm:right-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[0.65rem] font-bold uppercase tracking-wider backdrop-blur-md shadow-sm border ${
                      item.quantity_in_stock <= 0 
                        ? 'bg-rose-50/90 text-rose-600 border-rose-200' 
                        : lowStock 
                          ? 'bg-amber-50/90 text-amber-600 border-amber-200'
                          : 'bg-emerald-50/90 text-emerald-600 border-emerald-200'
                    }`}>
                      {item.quantity_in_stock <= 0 ? 'Out' : lowStock ? 'Low' : 'Good'}
                    </span>
                  </div>
                </div>

                {/* Bottom Data Section */}
                <div className="flex flex-col flex-1 p-3 sm:p-4 bg-white relative">
                  <div className="flex items-start justify-between gap-2 mb-0.5">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight line-clamp-2">
                      {item.product.name}
                    </h3>
                  </div>
                  
                  <div className="text-[0.7rem] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    {item.product.company || t('inventory.noCompany', 'Generic')}
                  </div>
                  <div className="flex flex-col gap-1.5 mb-2">
                    <div className="flex items-center gap-2">
                      {item.batch_number && (
                        <span className="inline-block px-1.5 py-0.5 bg-slate-100 rounded text-[0.6rem] font-bold text-slate-600 truncate max-w-[80px]">
                          Lot: {item.batch_number}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-auto pt-1.5 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[0.65rem] sm:text-[0.7rem] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Price</span>
                      <div className="text-base sm:text-lg font-bold text-slate-900 leading-none">
                        {formatCurrency(price.displayPrice)}
                      </div>
                      {price.hasMedicineDiscount ? (
                        <span className="mt-1 text-[0.62rem] font-bold text-emerald-600">{price.discount}% off</span>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-end text-right">
                      <span className="text-[0.65rem] sm:text-[0.7rem] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Stock</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-lg sm:text-xl font-black text-slate-900 leading-none">{item.quantity_in_stock || 0}</span>
                        <span className="text-[0.65rem] sm:text-[0.7rem] font-bold text-slate-500 uppercase">{item.product.unit}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {adjustingItem ? <StockAdjustmentModal item={adjustingItem} onClose={() => setAdjustingItem(null)} /> : null}
      </>
    );
  }

  // Fallback Legacy Layout: Horizontal Cards (Mobile) + Table (Desktop)
  return (
    <>
      {/* Mobile view: Horizontal cards */}
      <div className="grid gap-4 md:hidden">
        {items.map((item) => {
          const lowStock = (item.quantity_in_stock || 0) <= (item.min_stock_alert || 0);
          const expiryLabel = formatExpiryDate(item.expiry_date);
          const price = getPriceLabel(item);
          
          let displayImage = item.image_url;
          if (!displayImage) {
            displayImage = getProductArt(item.product.type);
          }

          return (
            <div
              key={item.id}
              onClick={() => navigate(`/inventory/${item.id}`, { state: { from: '/inventory' } })}
              className="cursor-pointer overflow-hidden rounded-[22px] border border-slate-200/80 bg-white py-3 pl-2.5 pr-4.5 shadow-[0_4px_12px_rgba(0,0,0,0.03)] transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_12px_24px_rgba(0,0,0,0.08)]"
            >
              <div className="flex items-center gap-2">
                <div className="flex h-[3.25rem] w-[3.25rem] shrink-0 items-center justify-center overflow-hidden rounded-[18px] bg-slate-50 text-slate-500">
                  {displayImage ? (
                    <img
                      src={displayImage}
                      alt=""
                      aria-hidden="true"
                      className="h-[2.75rem] w-[2.75rem] object-contain"
                    />
                  ) : (
                    <Package2 className="h-5 w-5" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-[1rem] font-bold tracking-[-0.02em] text-slate-900">
                    {item.product.name}
                  </h3>
                  <div className="mt-0.5 truncate text-[0.76rem] font-semibold text-slate-500">
                    {item.product.company || t('inventory.noCompany', 'No company')}
                  </div>
                  <div className="mt-1 space-y-0.5 text-[0.78rem] font-medium text-slate-500 hidden sm:block">
                    <div className="truncate">{item.batch_number ? `Batch: ${item.batch_number}` : 'Batch: -'}</div>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-end text-right justify-between py-1 relative">
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <div className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Price</div>
                      <div className="text-[0.95rem] font-bold text-slate-800 leading-none">
                        {formatCurrency(price.displayPrice)}
                      </div>
                      {price.hasMedicineDiscount ? (
                        <div className="mt-0.5 text-[0.62rem] font-bold text-emerald-600">{price.discount}% off</div>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Stock</div>
                    <div className="flex items-baseline gap-1 justify-end">
                      <span className={`text-[1.1rem] font-black leading-none ${
                        item.quantity_in_stock <= 0 ? 'text-rose-500' : lowStock ? 'text-amber-500' : 'text-slate-900'
                      }`}>
                        {item.quantity_in_stock || 0}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop view: Table */}
      <div className="hidden md:block overflow-x-auto rounded-[24px] border border-slate-200/80 bg-white shadow-[0_10px_26px_rgba(148,163,184,0.12)]">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <th className="px-5 py-4 font-bold text-slate-500 uppercase tracking-wider text-xs w-[35%]">Product</th>
              <th className="px-5 py-4 font-bold text-slate-500 uppercase tracking-wider text-xs w-[15%]">Company</th>
              <th className="px-5 py-4 font-bold text-slate-500 uppercase tracking-wider text-xs w-[15%]">Batch / Expiry</th>
              <th className="px-5 py-4 font-bold text-slate-500 uppercase tracking-wider text-xs text-right w-[15%] whitespace-nowrap">Selling Price</th>
              <th className="px-5 py-4 font-bold text-slate-500 uppercase tracking-wider text-xs text-center w-[10%]">Health</th>
              <th className="px-5 py-4 font-bold text-slate-500 uppercase tracking-wider text-xs text-right w-[10%]">Stock</th>
              <th className="px-5 py-4 font-bold text-slate-500 uppercase tracking-wider text-xs text-right w-[5%]"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => {
              const lowStock = (item.quantity_in_stock || 0) <= (item.min_stock_alert || 0);
              const expiryLabel = formatExpiryDate(item.expiry_date);
              const price = getPriceLabel(item);
              
              let displayImage = item.image_url;
              if (!displayImage) {
                displayImage = getProductArt(item.product.type);
              }

              return (
                <tr 
                  key={item.id}
                  onClick={() => navigate(`/inventory/${item.id}`, { state: { from: '/inventory' } })}
                  className="cursor-pointer transition-colors hover:bg-slate-50/80 group"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-slate-500">
                        {displayImage ? (
                          <img
                            src={displayImage}
                            alt=""
                            aria-hidden="true"
                            className="h-7 w-7 object-contain"
                          />
                        ) : (
                          <Package2 className="h-5 w-5" />
                        )}
                      </div>
                      <div className="font-bold text-slate-900 group-hover:text-[#0070F3] transition-colors">
                        {item.product.name}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 font-semibold text-slate-600">
                    {item.product.company || <span className="text-slate-400 italic">Generic</span>}
                  </td>
                  <td className="px-5 py-3">
                    {item.inventory_lots && item.inventory_lots.length > 0 ? (
                      <div className="flex flex-col gap-1.5">
                        {item.inventory_lots.map(lot => (
                          <div key={lot.id} className="flex items-center justify-between bg-slate-50 px-2 py-1.5 rounded border border-slate-100 min-w-[160px]">
                            <div className="flex flex-col">
                              <span className="text-[0.75rem] font-bold text-slate-700">{lot.batch_number || 'Lot'}</span>
                              <span className="text-[0.65rem] font-medium text-slate-500 mt-0.5">
                                {lot.expiry_date ? `Exp: ${formatExpiryDate(lot.expiry_date)}` : 'No Expiry'}
                              </span>
                            </div>
                            <span className="text-[0.8rem] font-black text-sky-700 ml-4">
                              {lot.remaining_quantity} <span className="text-[0.65rem] font-bold uppercase">{item.product.unit}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-slate-700">{item.batch_number || '-'}</span>
                        <span className="text-xs font-medium text-slate-500">{expiryLabel || 'No Expiry'}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="font-bold text-slate-800">{formatCurrency(price.displayPrice)}</span>
                      {price.hasMedicineDiscount ? (
                        <span className="text-xs font-semibold text-slate-500">
                          {price.discount}% off {formatCurrency(price.basePrice)}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-center">
                    {lowStock ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[0.65rem] font-bold uppercase tracking-wider bg-rose-50 text-rose-600 border border-rose-100">
                        {item.quantity_in_stock <= 0 ? 'Out of stock' : 'Low stock'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[0.65rem] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-100">
                        Good
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex flex-col items-end gap-0.5">
                      <div className="flex items-baseline gap-1">
                        <span className={`text-[1.1rem] font-black ${
                          item.quantity_in_stock <= 0 ? 'text-rose-500' : lowStock ? 'text-amber-500' : 'text-slate-900'
                        }`}>
                          {item.quantity_in_stock || 0}
                        </span>
                        <span className="text-[0.7rem] font-bold text-slate-400 uppercase">{item.product.unit}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button 
                        type="button"
                        className="inline-flex p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
                        title="Adjust Stock"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAdjustingItem(item);
                        }}
                      >
                        <Boxes className="w-5 h-5 opacity-80" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {adjustingItem ? <StockAdjustmentModal item={adjustingItem} onClose={() => setAdjustingItem(null)} /> : null}
    </>
  );
};

export default InventoryList;
