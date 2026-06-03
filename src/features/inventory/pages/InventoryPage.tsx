import React, { useMemo, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useBranchStore } from '@/stores/branchStore';
import {
  AlertTriangle,
  Boxes,
  CircleDollarSign,
  PackagePlus,
  Plus,
  SearchSlash,
  ShieldAlert,
  Check,
  FileText,
  TrendingUp,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
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
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
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
      lowStockOnly: showLowStockOnly,
    });
  }, [user?.id, branchId, searchQuery, selectedType, showLowStockOnly]);

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
  };

  const summaryCards: Array<{
    label: string;
    value: React.ReactNode;
    interactive: boolean;
    active?: boolean;
    onClick?: () => void;
  }> = [
    {
      label: 'Total Products',
      value: summary.totalSkus,
      onClick: () => setShowLowStockOnly(false),
      interactive: true,
      active: !showLowStockOnly,
    },
    {
      label: t('inventory.lowStock', 'Low stock'),
      value: summary.lowStockCount,
      onClick: () => setShowLowStockOnly(true),
      interactive: true,
      active: showLowStockOnly,
    },
    {
      label: 'Out of Stock',
      value: summary.outOfStockCount,
      interactive: false,
    },
    {
      label: 'Stock Value',
      value: formatCompactCurrency(summary.estimatedStockValue),
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
            <Button
              size="sm"
              variant="outline"
              fullWidth
              onClick={() => navigate('/inventory/report')}
              leftIcon={<FileText className="h-4 w-4 sm:h-5 sm:w-5" />}
            >
              Stock Report
            </Button>
            <Button
              size="sm"
              variant="outline"
              fullWidth
              onClick={() => navigate('/inventory/rate-adjustment')}
              leftIcon={<TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />}
            >
              Rate Diff Tool
            </Button>
            <Button
              size="sm"
              variant="primary"
              fullWidth
              onClick={() => setIsAddProductModalOpen(true)}
              leftIcon={<PackagePlus className="h-4 w-4 sm:h-5 sm:w-5" />}
            >
              {t('inventory.newProduct', 'New Product')}
            </Button>
            <Button
              size="sm"
              variant="primary"
              fullWidth
              onClick={() => navigate('/purchases/new')}
              leftIcon={<Plus className="h-4 w-4 sm:h-5 sm:w-5" />}
            >
              {t('inventory.addStock', 'Add Stock')}
            </Button>
          </div>
        }
      />

      {isLoading ? (
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
      ) : !inventory.length ? (
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
          <div className="col-span-full rounded-[26px] border border-slate-200 bg-white p-4 shadow-[0_12px_32px_rgba(148,163,184,0.12)] sm:p-6">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-400 mb-4">{t('inventory.stockSummary', 'Stock Summary')}</p>
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
                    className={`group relative overflow-hidden rounded-[24px] border bg-slate-50/50 px-4 py-4 text-left border-slate-200 shadow-sm transition-all duration-200 sm:px-5 sm:py-5 ${
                      card.interactive ? 'cursor-pointer' : 'cursor-default'
                    } ${
                      card.active
                        ? 'border-slate-200 ring-1 ring-slate-200 shadow-[0_10px_24px_rgba(148,163,184,0.09)] bg-slate-100'
                        : 'hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_14px_28px_rgba(148,163,184,0.12)]'
                    }`}
                  >
                    <div className="absolute inset-x-0 top-0 h-0.5 bg-slate-100" />
                    <div className="relative flex flex-col justify-start gap-2">
                      <div className="text-[0.65rem] font-black uppercase tracking-[0.16em] leading-normal text-slate-400 whitespace-normal">
                        {card.label}
                      </div>
                      <div>
                        <div className="text-[1.95rem] font-black tracking-[-0.07em] leading-none text-slate-950 sm:text-[2.1rem]">
                          {card.value}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </section>
          </div>

          <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-2.5">
              <div className="w-full">
                <SearchBar
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder={t('inventory.searchPlaceholder', 'Search products')}
                  showVoicePlaceholder
                />
              </div>
              
              <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1.5 pt-1 sm:flex-wrap sm:gap-3">
                {/* All */}
                <button
                  type="button"
                  onClick={() => setSelectedType('all')}
                  className={selectedType === 'all' ? 'stock-filter-capsule stock-filter-capsule--active' : 'stock-filter-capsule'}
                >
                  {t('common.all', 'All')}
                </button>

                {/* Types */}
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

                {/* Low Stock */}
                <button
                  type="button"
                  onClick={() => setShowLowStockOnly((value) => !value)}
                  className={showLowStockOnly ? 'stock-filter-capsule stock-filter-capsule--warning-active gap-1.5' : 'stock-filter-capsule stock-filter-capsule--warning gap-1.5'}
                >
                  <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2.5} />
                  {t('inventory.lowStock', 'Low stock')}
                </button>
              </div>
            </div>

            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-semibold text-slate-500">
                <span className="font-black text-slate-900">{pagedInventory.totalCount}</span>{' '}
                {pagedInventory.totalCount === 1 ? 'product' : 'products'}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {showLowStockOnly ? (
                  <Badge variant="warning" className="normal-case tracking-[0.02em]">
                    Low stock only
                  </Badge>
                ) : null}
                {selectedType !== 'all' ? (
                  <Badge variant="info" className="normal-case tracking-[0.02em]">
                    {selectedType}
                  </Badge>
                ) : null}
                {(searchQuery || selectedType !== 'all' || showLowStockOnly) ? (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-sm font-bold text-sky-700 transition-colors hover:text-sky-800"
                  >
                    Clear filters
                  </button>
                ) : null}
              </div>
            </div>
          </section>

          {!pagedInventory.totalCount ? (
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
            <InventoryList items={pagedInventory.visibleItems} />
          )}
          <ListLoadMore
            shown={pagedInventory.visibleCount}
            total={pagedInventory.totalCount}
            onLoadMore={pagedInventory.loadMore}
            label={t('common.loadMore', 'Load more')}
          />
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
