import React, { useMemo, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { formatCurrency } from '@/lib/utils';
import { useBranchStore } from '@/stores/branchStore';
import {
  AlertTriangle,
  Boxes,
  CircleDollarSign,
  PackagePlus,
  Plus,
  SearchSlash,
  ShieldAlert,
  FileText,
  TrendingUp,
  Package,
  PackageX,
  IndianRupee,
  ChevronDown,
  Filter,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageShell } from '@/components/layout/PageShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, EmptyState, SearchBar, Select, Skeleton } from '@/components/ui';
import { ListLoadMore } from '@/components/ui/ListLoadMore';
import { useInventory } from '../hooks/useInventory';
import InventoryList from '../components/InventoryList';
import { AddProductModal } from '../components/AddProductModal';
import { useLoadMoreList } from '@/lib/useLoadMoreList';
import { inventoryService } from '../services/inventoryService';
import { InventoryItem } from '../types';

const formatCompactCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 1,
  }).format(value);

const InventoryPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: inventory = [], isLoading, error } = useInventory();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [searchParams] = useSearchParams();
  const [showLowStockOnly, setShowLowStockOnly] = useState(searchParams.get('filter') === 'low-stock');
  const [showOutOfStockOnly, setShowOutOfStockOnly] = useState(searchParams.get('filter') === 'out-of-stock');
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);

  const productTypes = useMemo(
    () => Array.from(new Set(inventory.map((item) => item.product.type))).sort(),
    [inventory]
  );

  const summary = useMemo(() => {
    const totalSkus = inventory.length;
    const lowStockCount = inventory.filter(
      (item) => (item.quantity_in_stock || 0) <= (item.min_stock_alert || 0)
    ).length;
    const outOfStockCount = inventory.filter((item) => (item.quantity_in_stock || 0) <= 0).length;
    const estimatedStockValue = inventory.reduce((sum, item) => {
      const price = Number(item.selling_price || item.product.default_price || 0);
      return sum + price * Number(item.quantity_in_stock || 0);
    }, 0);

    return {
      totalSkus,
      lowStockCount,
      outOfStockCount,
      estimatedStockValue,
    };
  }, [inventory]);

  const { user } = useAuthStore();
  const { activeBranch, isAllBranches } = useBranchStore();
  const branchId = isAllBranches ? null : activeBranch?.id;

  const fetchInventoryPage = React.useCallback(async ({ page, limit }: { page: number; limit: number }) => {
    if (!user?.id) throw new Error('No user id');
    return inventoryService.getInventory(user.id, branchId, {
      page,
      limit,
      searchQuery,
      productType: selectedType,
      lowStockOnly: showLowStockOnly && !showOutOfStockOnly,
      outOfStockOnly: showOutOfStockOnly,
    });
  }, [user?.id, branchId, searchQuery, selectedType, showLowStockOnly, showOutOfStockOnly]);

  const pagedInventory = useLoadMoreList<InventoryItem>({
    initialLimit: 9,
    step: 9,
    fetchFn: fetchInventoryPage,
    dependencies: [fetchInventoryPage],
  });

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedType('all');
    setShowLowStockOnly(false);
    setShowOutOfStockOnly(false);
  };

  const summaryCards: Array<{
    label: string;
    value: React.ReactNode;
    icon: React.ReactNode;
    colorClass: string;
    interactive: boolean;
    active?: boolean;
    onClick?: () => void;
  }> = [
    {
      label: 'Total Products',
      value: summary.totalSkus,
      icon: <Package className="h-6 w-6" />,
      colorClass: 'bg-blue-50 text-blue-600 border-blue-100',
      onClick: () => {
        setShowLowStockOnly(false);
        setShowOutOfStockOnly(false);
      },
      interactive: true,
      active: !showLowStockOnly && !showOutOfStockOnly,
    },
    {
      label: t('inventory.lowStock', 'Low stock'),
      value: summary.lowStockCount,
      icon: <AlertTriangle className="h-6 w-6" />,
      colorClass: 'bg-amber-50 text-amber-500 border-amber-100',
      onClick: () => {
        setShowLowStockOnly(true);
        setShowOutOfStockOnly(false);
      },
      interactive: true,
      active: showLowStockOnly && !showOutOfStockOnly,
    },
    {
      label: 'Out of Stock',
      value: summary.outOfStockCount,
      icon: <PackageX className="h-6 w-6" />,
      colorClass: 'bg-rose-50 text-rose-500 border-rose-100',
      onClick: () => {
        setShowOutOfStockOnly(true);
        setShowLowStockOnly(false);
      },
      interactive: true,
      active: showOutOfStockOnly,
    },
    {
      label: 'Stock Value',
      value: formatCurrency(summary.estimatedStockValue),
      icon: <IndianRupee className="h-6 w-6" />,
      colorClass: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      interactive: false,
    },
  ];

  if (error) {
    return (
      <PageShell width="full">
        <div className="rounded-[30px] border border-rose-200 bg-[linear-gradient(180deg,#fff1f2_0%,#ffffff_100%)] p-6 text-center shadow-[0_18px_40px_rgba(244,63,94,0.08)]">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-rose-600">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-xl font-black tracking-[-0.03em] text-rose-700">
            {t('common.error', 'Something went wrong.')}
          </h2>
          <p className="mt-2 text-sm font-medium text-rose-500">
            We could not load inventory right now. Please try again.
          </p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell width="full">
      <PageHeader
        title="Stock Control"
        action={
          <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:w-auto sm:flex-row">

            <button
              onClick={() => setIsAddProductModalOpen(true)}
              className="flex items-center justify-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 min-h-10 text-xs sm:text-sm font-semibold text-white bg-white/15 border border-white/20 rounded-[14px] hover:bg-white/25 transition-colors sm:text-left sm:min-w-[110px]"
            >
              <PackagePlus className="h-4 w-4 sm:h-[18px] sm:w-[18px] shrink-0" />
              <span className="leading-tight">New<br className="hidden sm:block" />Product</span>
            </button>
            <button
              onClick={() => navigate('/purchases/new')}
              className="flex items-center justify-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 min-h-10 text-xs sm:text-sm font-semibold text-white bg-white/15 border border-white/20 rounded-[14px] hover:bg-white/25 transition-colors sm:text-left sm:min-w-[110px]"
            >
              <Plus className="h-4 w-4 sm:h-[18px] sm:w-[18px] shrink-0" />
              <span className="leading-tight whitespace-nowrap whitespace-normal sm:whitespace-nowrap">Add Stock</span>
            </button>
          </div>
        }
      />

      {(isLoading || pagedInventory.isLoading) && !inventory.length && !pagedInventory.visibleItems.length ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-28 rounded-[26px]" />
            ))}
          </div>
          <Skeleton className="h-40 rounded-[30px]" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-72 rounded-[28px]" />
            ))}
          </div>
        </>
      ) : !inventory.length && !pagedInventory.totalCount && !pagedInventory.isLoading ? (
        <EmptyState
          icon={Boxes}
          title={t('inventory.noItems', 'No stock items')}
          description={t(
            'inventory.noItemsDesc',
            'Add or purchase products to start managing inventory.'
          )}
          action={
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                variant="outline"
                onClick={() => setIsAddProductModalOpen(true)}
                leftIcon={<PackagePlus className="h-4.5 w-4.5" />}
              >
                {t('inventory.newProduct', 'New Product')}
              </Button>
              <Button onClick={() => navigate('/purchases/new')} leftIcon={<Plus className="h-4.5 w-4.5" />}>
                {t('inventory.addStock', 'Add Stock')}
              </Button>
            </div>
          }
        />
      ) : (
        <>
          <div className="col-span-full pt-4">
            <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {summaryCards.map((card) => {
                return (
                  <div
                    key={card.label}
                    role={card.interactive ? 'button' : undefined}
                    tabIndex={card.interactive ? 0 : undefined}
                    onClick={card.interactive ? card.onClick : undefined}
                    onKeyDown={
                      card.interactive
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              card.onClick?.();
                            }
                          }
                        : undefined
                    }
                    aria-pressed={card.interactive ? card.active : undefined}
                    className={`group relative overflow-hidden rounded-[16px] border bg-white p-3 sm:p-5 text-left transition-all duration-200 flex flex-col sm:flex-row items-start gap-2 sm:gap-4 ${
                      card.interactive ? 'cursor-pointer' : 'cursor-default'
                    } ${
                      card.active
                        ? 'border-blue-300 ring-1 ring-blue-300 shadow-[0_4px_12px_rgba(59,130,246,0.12)]'
                        : 'border-slate-200 hover:border-slate-300 hover:shadow-sm shadow-sm'
                    }`}
                  >
                    <div className={`flex shrink-0 items-center justify-center h-10 w-10 sm:h-14 sm:w-14 rounded-2xl border ${card.colorClass}`}>
                      {React.cloneElement(card.icon as React.ReactElement, { className: 'h-5 w-5 sm:h-6 sm:w-6' })}
                    </div>
                    <div className="flex flex-col justify-start gap-0.5 sm:gap-1 mt-1 sm:mt-0">
                      <div className="text-[0.65rem] sm:text-[0.7rem] font-bold uppercase tracking-[0.1em] text-slate-500 truncate w-full">
                        {card.label}
                      </div>
                      <div className="text-xl sm:text-2xl font-black tracking-[-0.03em] text-slate-900 leading-none mt-0.5">
                        {card.value}
                      </div>
                    </div>
                  </div>
                );
              })}
            </section>
          </div>

          <section className="mt-4 rounded-[16px] border border-slate-200 bg-white p-4 shadow-sm flex flex-col gap-4">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <div className="w-full md:w-[400px]">
                <SearchBar
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Search products by name, brand, category..."
                  showVoicePlaceholder
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4">
              <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 sm:flex-wrap sm:gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedType('all')}
                  className={selectedType === 'all' ? 'stock-filter-capsule stock-filter-capsule--active' : 'stock-filter-capsule'}
                >
                  {t('common.all', 'All')}
                </button>

                {productTypes.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSelectedType(type)}
                    className={selectedType === type ? 'stock-filter-capsule stock-filter-capsule--active' : 'stock-filter-capsule'}
                  >
                    {type}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => {
                    setShowLowStockOnly((value) => !value);
                    setShowOutOfStockOnly(false);
                  }}
                  className={showLowStockOnly ? 'stock-filter-capsule stock-filter-capsule--warning-active gap-1.5' : 'stock-filter-capsule stock-filter-capsule--warning gap-1.5'}
                >
                  <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2.5} />
                  {t('inventory.lowStock', 'Low stock')}
                </button>
              </div>

              <div className="flex items-center gap-4 ml-auto">
                <div className="text-sm font-bold text-slate-700">
                  {pagedInventory.totalCount} products
                </div>
              </div>
            </div>
          </section>

          {pagedInventory.isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-4 text-sm text-slate-500 font-medium animate-pulse">Loading stock...</p>
            </div>
          ) : !pagedInventory.totalCount ? (
            <EmptyState
              icon={SearchSlash}
              title={t('common.noResults', 'No results found')}
              description="No products match your current search or filters."
              action={
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <>
              <InventoryList items={pagedInventory.visibleItems} />
              <ListLoadMore
                shown={pagedInventory.visibleCount}
                total={pagedInventory.totalCount}
                onLoadMore={pagedInventory.loadMore}
                label={t('common.loadMore', 'Load more')}
              />
            </>
          )}
        </>
      )}

      <AddProductModal
        isOpen={isAddProductModalOpen}
        onClose={() => setIsAddProductModalOpen(false)}
        onSuccess={() => setIsAddProductModalOpen(false)}
      />
    </PageShell>
  );
};

export default InventoryPage;
