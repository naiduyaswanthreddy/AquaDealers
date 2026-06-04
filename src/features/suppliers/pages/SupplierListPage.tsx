import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Truck, ChevronRight } from 'lucide-react';
import { useSuppliers } from '../hooks/useSuppliers';
import { SupplierFormModal } from '../components/SupplierFormModal';
import { formatCurrency, cn } from '@/lib/utils';
import { PageShell } from '@/components/layout/PageShell';
import { PageHeader } from '@/components/layout/PageHeader';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { ListLoadMore } from '@/components/ui/ListLoadMore';
import { useLoadMoreList } from '@/lib/useLoadMoreList';
import { useAuthStore } from '@/stores/authStore';
import { supplierService } from '../services/supplierService';
import { SupplierItem } from '../types';

const SupplierListPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: suppliers, isLoading, error } = useSuppliers();
  const [search, setSearch] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const { user } = useAuthStore();

  const fetchSuppliersPage = React.useCallback(async ({ page, limit }: { page: number; limit: number }) => {
    if (!user?.id) throw new Error('No dealer ID');
    return supplierService.getSuppliers(user.id, search || undefined, page, limit);
  }, [user?.id, search]);

  const pagedSuppliers = useLoadMoreList<SupplierItem>({
    initialLimit: 9,
    step: 9,
    fetchFn: fetchSuppliersPage,
    dependencies: [fetchSuppliersPage],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-red-600 bg-red-50 rounded-2xl">
        <p>{t('common.error')}</p>
      </div>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title={t('nav.suppliers', 'Suppliers')}
        description={t('suppliers.subtitle', 'Manage your suppliers and payables')}
        action={
          <Button onClick={() => setIsAddModalOpen(true)} leftIcon={<Plus className="w-5 h-5" />}>
            {t('suppliers.addSupplier', 'Add Supplier')}
          </Button>
        }
      />

      <div className="relative">
        <Input
          placeholder={t('suppliers.searchPlaceholder', 'Search by name, company, or phone...')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 max-w-md"
        />
        <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {pagedSuppliers.visibleItems.map((supplier) => (
          <div
            key={supplier.id}
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/suppliers/${supplier.id}`)}
            style={{ backgroundColor: '#ffffff' }}
            className="flex flex-col p-4 rounded-[22px] shadow-sm border border-slate-200/80 transition-all hover:shadow-md hover:-translate-y-0.5 hover:border-blue-300 text-left relative overflow-hidden cursor-pointer"
          >
            <div className="flex items-start justify-between w-full mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <span className="font-bold text-blue-700 text-lg">
                    {(supplier.name || 'S').charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 line-clamp-1">{supplier.name}</h3>
                  <p className="text-sm text-gray-500 line-clamp-1">
                    {supplier.company || t('inventory.noCompany', 'No company')}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 w-full bg-slate-50/50 p-3.5 rounded-xl border border-slate-100/60">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">{t('suppliers.totalDue')}</p>
                <p className={cn(
                  "font-bold",
                  supplier.total_due > 0 ? "text-red-600" : "text-green-600"
                )}>
                  {formatCurrency(supplier.total_due)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Credit Terms</p>
                <p className="font-bold text-gray-900">
                  {supplier.credit_days > 0 ? `${supplier.credit_days} days` : 'Immediate'}
                </p>
              </div>
            </div>
          </div>
        ))}

        {pagedSuppliers.visibleItems.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center p-12 text-center bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <Truck className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">{t('common.noResults')}</h3>
            <p className="text-gray-500">{t('suppliers.noSuppliersFound', 'No suppliers found.')}</p>
          </div>
        )}
      </div>

      <ListLoadMore
        shown={pagedSuppliers.visibleCount}
        total={pagedSuppliers.totalCount}
        onLoadMore={pagedSuppliers.loadMore}
        label={t('common.loadMore', 'Load more')}
      />

      {isAddModalOpen && (
        <SupplierFormModal onClose={() => setIsAddModalOpen(false)} />
      )}
    </PageShell>
  );
};

export default SupplierListPage;
