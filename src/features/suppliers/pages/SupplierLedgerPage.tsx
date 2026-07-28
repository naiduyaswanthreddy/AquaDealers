import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Edit2, DollarSign, Package, Building2 } from 'lucide-react';
import { useSupplier, useSupplierPurchases, useSupplierPayments } from '../hooks/useSuppliers';
import { SupplierFormModal } from '../components/SupplierFormModal';
import { SupplierPaymentModal } from '../components/SupplierPaymentModal';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { PageShell } from '@/components/layout/PageShell';
import Button from '@/components/ui/Button';
import { ListLoadMore } from '@/components/ui/ListLoadMore';
import { useLoadMoreList } from '@/lib/useLoadMoreList';
import { useStaffStore } from '@/stores/staffStore';
import { getStaffFeatureMode } from '@/lib/staffAccess';
import { useBranchStore } from '@/stores/branchStore';
import type { PurchaseItem } from '../types';

const SupplierLedgerPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const currentStaff = useStaffStore((s) => s.currentStaff);
  const canNewPurchase = getStaffFeatureMode('suppliers', currentStaff?.permissions, !!currentStaff) === 'visible';
  
  const { data: supplier, isLoading: isLoadingSupplier } = useSupplier(id || '');
  const { data: purchases, isLoading: isLoadingPurchases } = useSupplierPurchases(id || '');
  const { data: payments, isLoading: isLoadingPayments } = useSupplierPayments(id || '');
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [showItems, setShowItems] = useState(false);

  // Branch scope: "current" filters purchases to the active branch; "all" shows every branch.
  // If dealer is in "All Branches" mode, we ignore the toggle and always show all.
  const branches = useBranchStore((s) => s.branches);
  const activeBranchId = useBranchStore((s) => s.getActiveBranchId());
  const isAllBranchesGlobal = useBranchStore((s) => s.isAllBranches);
  const [scope, setScope] = useState<'current' | 'all'>('current');
  const effectiveScope: 'current' | 'all' = isAllBranchesGlobal ? 'all' : scope;
  const branchNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of branches) m.set(b.id, b.name);
    return m;
  }, [branches]);
  const activeBranchName = activeBranchId ? branchNameById.get(activeBranchId) || 'Current branch' : 'All branches';

  // Per-branch purchase totals (from the full list, regardless of scope).
  const perBranchTotals = useMemo(() => {
    const acc = new Map<string, { name: string; total: number; count: number }>();
    for (const p of purchases || []) {
      const bId = (p as any).branch_id || 'unknown';
      const cur = acc.get(bId) || { name: branchNameById.get(bId) || 'Unknown branch', total: 0, count: 0 };
      cur.total += Number(p.total_amount || 0);
      cur.count += 1;
      acc.set(bId, cur);
    }
    return Array.from(acc.entries()).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.total - a.total);
  }, [purchases, branchNameById]);
  const grandPurchases = perBranchTotals.reduce((s, r) => s + r.total, 0);

  const transactions = useMemo(() => {
    if (!purchases || !payments) return [];

    const purchasesInScope = effectiveScope === 'current' && activeBranchId
      ? purchases.filter((p) => (p as any).branch_id === activeBranchId)
      : purchases;

    const pTx = purchasesInScope.map(p => ({
      id: `pur_${p.id}`,
      date: p.purchase_date,
      type: 'purchase' as const,
      amount: p.total_amount || 0,
      reference: p.invoice_number,
      details: p,
      created_at: p.created_at,
      branchName: branchNameById.get((p as any).branch_id) || 'Unknown branch',
    }));

    // Payments are dealer-scoped (no branch_id in schema), so they show for every scope.
    const payTx = payments.map(p => ({
      id: `pay_${p.id}`,
      date: p.payment_date,
      type: 'payment' as const,
      amount: p.amount,
      reference: p.method,
      details: p,
      created_at: p.created_at,
      branchName: null as string | null,
    }));

    return [...pTx, ...payTx].sort((a, b) => {
      const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateDiff !== 0) return dateDiff;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [purchases, payments, effectiveScope, activeBranchId, branchNameById]);
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
          {canNewPurchase && <Button
            variant="outline"
            onClick={() => navigate(`/purchases/new?supplier=${supplier.id}`)}
            className="flex-1 sm:flex-none"
            leftIcon={<Package className="w-5 h-5" />}
          >
            {t('suppliers.newPurchase', 'New Purchase')}
          </Button>}
        </div>
      </div>

      {perBranchTotals.length > 1 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mt-4">
          <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-500" />
            <h3 className="font-bold text-gray-900">Purchases by branch</h3>
            <span className="ml-auto text-sm text-slate-500 tabular-nums">Total {formatCurrency(grandPurchases)}</span>
          </div>
          <div className="p-4 grid gap-2 sm:grid-cols-2">
            {perBranchTotals.map((b) => {
              const pct = grandPurchases > 0 ? Math.round((b.total / grandPurchases) * 100) : 0;
              return (
                <div key={b.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="font-bold text-slate-800 truncate">{b.name}</div>
                    <div className="text-sm text-slate-500 tabular-nums">{b.count} purchase{b.count === 1 ? '' : 's'}</div>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between">
                    <div className="text-lg font-black text-slate-900 tabular-nums">{formatCurrency(b.total)}</div>
                    <div className="text-xs text-slate-500 tabular-nums">{pct}%</div>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                    <div className="h-full bg-sky-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mt-4">
        <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-wrap items-center gap-3">
          <h3 className="font-bold text-gray-900">{t('suppliers.transactionHistory', 'Transaction History')}</h3>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700">Show Items</span>
            <label className="relative inline-flex shrink-0 cursor-pointer items-center">
              <input type="checkbox" checked={showItems} onChange={(event) => setShowItems(event.target.checked)} className="sr-only peer" />
              <div className="h-5 w-9 rounded-full bg-slate-200 peer peer-focus:outline-none peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all" />
            </label>
          </div>
          {!isAllBranchesGlobal && perBranchTotals.length > 1 && (
            <div className="ml-auto inline-flex items-center rounded-full bg-slate-200/70 p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setScope('current')}
                className={cn(
                  'rounded-full px-3 py-1 transition-all',
                  scope === 'current' ? 'bg-white text-sky-800 shadow' : 'text-slate-500'
                )}
              >
                {activeBranchName}
              </button>
              <button
                type="button"
                onClick={() => setScope('all')}
                className={cn(
                  'rounded-full px-3 py-1 transition-all',
                  scope === 'all' ? 'bg-white text-sky-800 shadow' : 'text-slate-500'
                )}
              >
                All branches
              </button>
            </div>
          )}
        </div>
        {effectiveScope === 'current' && perBranchTotals.length > 1 && (
          <div className="border-b border-slate-100 bg-sky-50/50 px-4 py-2 text-[11px] font-semibold text-sky-800">
            Showing purchases at <b>{activeBranchName}</b> · payments always shown across all branches (single supplier balance).
          </div>
        )}

        {transactions.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            {t('common.noResults')}
          </div>
        ) : (
          <>
          <div className="divide-y divide-gray-100">
            {pagedTransactions.visibleItems.map((tx) => {
              const transactionDate = new Date(tx.date);
              const day = transactionDate.getDate();
              const month = transactionDate.toLocaleDateString('en-US', { month: 'short' });
              const product = tx.type === 'purchase'
                ? (tx.details as PurchaseItem).product
                : undefined;

              return (
              <div 
                key={tx.id} 
                className={cn(
                  "p-4 flex items-center justify-between gap-3 transition-colors cursor-pointer",
                  tx.type === 'purchase' ? "hover:bg-red-50/50" : "hover:bg-green-50/50"
                )}
                onClick={() => {
                  if (tx.type === 'purchase') {
                    navigate(`/purchases/${tx.details.id}`);
                  }
                }}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm">
                    <span className="text-[0.95rem] font-black leading-none text-slate-800">{day}</span>
                    <span className="mt-0.5 text-[0.56rem] font-black uppercase tracking-[0.16em] text-slate-400">{month}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900">
                      {tx.type === 'purchase' ? t('suppliers.purchase', 'Purchase') : t('suppliers.payment', 'Payment')}
                    </p>
                    {showItems && tx.type === 'purchase' && product ? (
                      <p className="mt-0.5 text-sm font-medium text-slate-600">
                        {product.name} ({tx.details.quantity})
                      </p>
                    ) : null}
                    <p className="inline-flex flex-wrap items-center gap-1.5 text-sm text-gray-500 [&>span:first-child]:hidden">
                      <span>{formatDate(tx.date)} {tx.reference && `• ${t('suppliers.ref', 'Ref:')} ${tx.reference}`}</span>
                      {tx.branchName && (
                        <span className="inline-flex items-center rounded bg-sky-50 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-sky-700 ring-1 ring-sky-200">
                          {tx.branchName}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="ml-auto shrink-0 text-right">
                  <p className={cn(
                    "font-bold text-lg",
                    tx.type === 'purchase' ? "text-red-600" : "text-green-600"
                  )}>
                    {tx.type === 'purchase' ? '-' : '+'}{formatCurrency(tx.amount)}
                  </p>
                </div>
              </div>
              );
            })}
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
