import React, { useState } from 'react';
import { Package2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { InventoryItem } from '../types';
import StockAdjustmentModal from './StockAdjustmentModal';

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

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => {
          const lowStock = (item.quantity_in_stock || 0) <= (item.min_stock_alert || 0);
          const expiryLabel = formatExpiryDate(item.expiry_date);
          const productArt = getProductArt(item.product.type);

          return (
            <div
              key={item.id}
              onClick={() => navigate(`/inventory/${item.id}`, { state: { from: '/inventory' } })}
              className="cursor-pointer overflow-hidden rounded-[22px] border border-slate-200/80 bg-white py-3 pl-2.5 pr-4.5 shadow-[0_10px_26px_rgba(148,163,184,0.12)] transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_16px_34px_rgba(148,163,184,0.16)]"
            >
              <div className="flex items-center gap-2">
                <div className="flex h-[3.25rem] w-[3.25rem] shrink-0 items-center justify-center overflow-hidden rounded-[18px] bg-slate-50 text-slate-500">
                  {productArt ? (
                    <img
                      src={productArt}
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
                  <div className="mt-1 space-y-0.5 text-[0.78rem] font-medium text-slate-500">
                    <div className="truncate">{item.batch_number ? `Batch: ${item.batch_number}` : 'Batch: -'}</div>
                    <div className="truncate">{expiryLabel ? `Exp: ${expiryLabel}` : 'Exp: -'}</div>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-end text-right">
                  <div className="text-[0.72rem] font-semibold text-slate-500">Stock</div>
                  <div
                    className={`mt-0.5 text-[1.05rem] font-bold tracking-[-0.02em] ${
                      lowStock ? 'text-rose-500' : 'text-slate-900'
                    }`}
                  >
                    {item.quantity_in_stock || 0}
                  </div>
                  <div
                    className={`mt-1 text-[0.82rem] font-semibold ${
                      lowStock ? 'text-rose-500' : 'text-emerald-600'
                    }`}
                  >
                    {lowStock ? 'Low' : 'Good'}
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
};

export default InventoryList;
