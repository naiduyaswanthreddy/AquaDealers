import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTopSoldProducts } from '../hooks/useDashboardData';
import { Skeleton } from '@/components/ui';
import { Package, TrendingUp, ArrowRight } from 'lucide-react';
import { formatQuantity } from '@/lib/utils';

const RANK_COLORS = ['#7c3aed', '#2563eb', '#0891b2', '#059669', '#d97706'];

const TopSoldProductsComponent: React.FC = () => {
  const navigate = useNavigate();
  const { data: topProducts, isLoading } = useTopSoldProducts();

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <div className="flex items-center justify-between mb-1">
          <Skeleton className="h-5 w-36 rounded-md" />
          <Skeleton className="h-4 w-16 rounded-md" />
        </div>
        <Skeleton className="h-3.5 w-48 rounded-md mb-5 mt-1" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-28 rounded-md" />
                <Skeleton className="h-3 w-16 rounded-md" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-16 rounded-xl" />
                <Skeleton className="h-8 w-8 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!topProducts || topProducts.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <h3 className="text-[1rem] font-bold text-slate-800">Top Sold Products</h3>
        <p className="text-xs text-slate-400 mt-1 mb-5">Your best selling products by quantity</p>
        <p className="text-sm text-slate-400 text-center py-4">No sales data for the last 30 days.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-[1rem] font-bold text-slate-800">Top Sold Products</h3>
        <button
          type="button"
          onClick={() => navigate('/inventory')}
          className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 focus:outline-none"
        >
          View All <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="text-xs text-slate-400 mb-4">Your best selling products by quantity</p>

      <div className="space-y-3.5">
        {(topProducts as any[]).map((product, i) => {
          const color = RANK_COLORS[i % RANK_COLORS.length];
          return (
            <div key={product.id ?? i} className="flex items-center gap-3">
              {/* Icon */}
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${color}18` }}
              >
                <Package className="h-5 w-5" style={{ color }} />
              </div>

              {/* Name + unit */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">{product.name}</p>
                <p className="text-xs text-slate-400 font-medium mt-0.5 flex items-center gap-1">
                  <Package className="h-3 w-3" />
                  {product.unit}
                </p>
              </div>

              {/* Quantity badge */}
              <div
                className="flex flex-col items-center justify-center rounded-xl px-3 py-1.5 min-w-[3.5rem] flex-shrink-0"
                style={{ backgroundColor: `${color}18` }}
              >
                <span className="text-sm font-extrabold leading-none" style={{ color }}>
                  {Number(product.quantity) >= 1000
                    ? `${(Number(product.quantity) / 1000).toFixed(1)}k`
                    : String(product.quantity)}
                </span>
                <span className="text-[0.6rem] font-semibold mt-0.5" style={{ color: `${color}aa` }}>
                  {product.unit}
                </span>
              </div>

            </div>
          );
        })}
      </div>

      {/* Motivational footer */}
      <div className="mt-5 pt-4 border-t border-slate-50 flex items-center gap-2">
        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <TrendingUp className="h-3.5 w-3.5 text-primary" />
        </div>
        <p className="text-xs text-slate-400 font-medium">Keep going! You're doing great.</p>
      </div>
    </div>
  );
};

export const TopSoldProducts = React.memo(TopSoldProductsComponent);
TopSoldProducts.displayName = 'TopSoldProducts';
export default TopSoldProducts;
