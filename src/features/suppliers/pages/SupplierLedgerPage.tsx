import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Edit2, Plus, DollarSign, Package } from 'lucide-react';
import { useSupplier, useSupplierPurchases, useSupplierPayments } from '../hooks/useSuppliers';
import { SupplierFormModal } from '../components/SupplierFormModal';
import { SupplierPaymentModal } from '../components/SupplierPaymentModal';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { PageShell } from '@/components/layout/PageShell';
import Button from '@/components/ui/Button';
import { ListLoadMore } from '@/components/ui/ListLoadMore';
import { useLoadMoreList } from '@/lib/useLoadMoreList';

const SupplierLedgerPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  const { data: supplier, isLoading: isLoadingSupplier } = useSupplier(id || '');
  const { data: purchases, isLoading: isLoadingPurchases } = useSupplierPurchases(id || '');
  const { data: payments, isLoading: isLoadingPayments } = useSupplierPayments(id || '');
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const transactions = useMemo(() => {
    if (!purchases || !payments) return [];

    const pTx = purchases.map(p => ({
      id: `pur_${p.id}`,
      date: p.purchase_date,
      type: 'purchase' as const,
      amount: p.total_amount || 0,
      reference: p.invoice_number,
      details: p,
      created_at: p.created_at,
    }));

    const payTx = payments.map(p => ({
      id: `pay_${p.id}`,
      date: p.payment_date,
      type: 'payment' as const,
      amount: p.amount,
      reference: p.method,
      details: p,
      created_at: p.created_at,
    }));

    // Sort by date descending, then by created_at descending
    return [...pTx, ...payTx].sort((a, b) => {
      const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateDiff !== 0) return dateDiff;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [purchases, payments]);
  const pagedTransactions = useLoadMoreList(transactions, {
    initialCount: 12,
    step: 12,
    resetDeps: [transactions.length],
  });

  const isLoading = isLoadingSupplier || isLoadingPurchases || isLoadingPayments;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="p-8 text-center text-red-600 bg-red-50 rounded-2xl">
        <p>{t('common.error')}</p>
        <Button onClick={() => navigate('/suppliers')} className="mt-4">{t('common.back', 'Go Back')}</Button>
      </div>
    );
  }

  return (
    <PageShell width="wide">
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={() => navigate('/suppliers')}
          className="focus-ring flex items-center gap-2 text-sm font-bold text-text-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('common.back')}
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gradient-to-br from-blue-50/50 to-white">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center flex-shrink-0 shadow-inner overflow-hidden">
                {supplier.photo_url ? (
                  <img src={supplier.photo_url} alt={supplier.name} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold text-blue-700">
                    {supplier.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-2xl font-bold text-gray-900">{supplier.name}</h1>
                  <button onClick={() => setIsEditModalOpen(true)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-gray-500 flex flex-wrap items-center gap-2">
                  <span>{supplier.company || t('inventory.noCompany', 'No company')}</span>
                  <span>•</span>
                  <span>{[supplier.phone, supplier.alternate_phone].filter(Boolean).join(' / ') || t('common.noPhone', 'No phone')}</span>
                </p>
              </div>
            </div>

            <div className="flex flex-col items-start sm:items-end p-4 bg-white rounded-xl shadow-sm border border-gray-100 min-w-[200px]">
              <p className="text-sm font-medium text-gray-500 mb-1">{t('suppliers.totalDue')}</p>
              <h2 className={cn(
                "text-3xl font-black",
                supplier.total_due > 0 ? "text-red-600" : "text-green-600"
              )}>
                {formatCurrency(supplier.total_due)}
              </h2>
            </div>
          </div>
        </div>

        <div className="p-4 bg-gray-50 border-b border-gray-100 flex flex-wrap gap-3">
          <Button 
            onClick={() => setIsPaymentModalOpen(true)}
            className="flex-1 sm:flex-none"
            leftIcon={<DollarSign className="w-5 h-5" />}
          >
            {t('suppliers.makePayment', 'Make Payment')}
          </Button>
          <Button 
            variant="outline"
            onClick={() => navigate(`/purchases/new?supplier=${supplier.id}`)}
            className="flex-1 sm:flex-none"
            leftIcon={<Package className="w-5 h-5" />}
          >
            {t('suppliers.newPurchase', 'New Purchase')}
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50">
          <h3 className="font-bold text-gray-900">{t('suppliers.transactionHistory', 'Transaction History')}</h3>
        </div>

        {transactions.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            {t('common.noResults')}
          </div>
        ) : (
          <>
          <div className="divide-y divide-gray-100">
            {pagedTransactions.visibleItems.map((tx) => (
              <div 
                key={tx.id} 
                className={cn(
                  "p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors cursor-pointer",
                  tx.type === 'purchase' ? "hover:bg-red-50/50" : "hover:bg-green-50/50"
                )}
                onClick={() => {
                  if (tx.type === 'purchase') {
                    navigate(`/purchases/${tx.details.id}`);
                  }
                }}
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                    tx.type === 'purchase' ? "bg-red-100" : "bg-green-100"
                  )}>
                    {tx.type === 'purchase' ? <Package className="w-5 h-5 text-red-600" /> : <DollarSign className="w-5 h-5 text-green-600" />}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">
                      {tx.type === 'purchase' ? t('suppliers.purchase', 'Purchase') : t('suppliers.payment', 'Payment')}
                    </p>
                    <p className="text-sm text-gray-500">
                      {formatDate(tx.date)} {tx.reference && `• ${t('suppliers.ref', 'Ref:')} ${tx.reference}`}
                    </p>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <p className={cn(
                    "font-bold text-lg",
                    tx.type === 'purchase' ? "text-red-600" : "text-green-600"
                  )}>
                    {tx.type === 'purchase' ? '-' : '+'}{formatCurrency(tx.amount)}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <ListLoadMore
            shown={pagedTransactions.visibleCount}
            total={pagedTransactions.totalCount}
            onLoadMore={pagedTransactions.loadMore}
            label={t('common.loadMore', 'Load more')}
          />
          </>
        )}
      </div>

      {isEditModalOpen && (
        <SupplierFormModal supplier={supplier} onClose={() => setIsEditModalOpen(false)} />
      )}
      
      {isPaymentModalOpen && (
        <SupplierPaymentModal supplier={supplier} onClose={() => setIsPaymentModalOpen(false)} />
      )}
    </PageShell>
  );
};

export default SupplierLedgerPage;
