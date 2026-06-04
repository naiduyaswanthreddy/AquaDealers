import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useTopSoldProducts } from '../hooks/useDashboardData';
import { Skeleton } from '@/components/ui';
import { Package } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export const TopSoldProducts: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: topProducts, isLoading } = useTopSoldProducts();

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex justify-between items-center mb-6">
          <Skeleton className="h-6 w-32 rounded-md" />
          <Skeleton className="h-4 w-16 rounded-md" />
        </div>
        <div className="space-y-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-24 rounded-md" />
                <Skeleton className="h-3 w-16 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-bold text-slate-800">Top Sold Products</h3>
        <button 
          type="button" 
          onClick={() => navigate('/inventory')}
          className="text-sm font-semibold text-blue-600 hover:text-blue-700 focus:outline-none"
        >
          View All
        </button>
      </div>
      
      {!topProducts || topProducts.length === 0 ? (
        <div className="text-center py-6 text-sm text-slate-500">
          No sales data available for the last 30 days.
        </div>
      ) : (
        <div className="space-y-5">
          {topProducts.map((product, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-12 w-12 bg-slate-100 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden">
                <Package className="h-6 w-6 text-slate-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[0.95rem] font-bold text-slate-800 truncate">{product.name}</p>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {product.quantity.toLocaleString()} {product.unit}s
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TopSoldProducts;
