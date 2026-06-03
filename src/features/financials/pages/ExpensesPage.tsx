import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Plus, TrendingDown } from 'lucide-react';
import { useExpenses } from '../hooks/useFinancials';
import { ExpenseModal } from '../components/ExpenseModal';
import { EXPENSE_CATEGORIES } from '@/lib/constants';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { PageShell } from '@/components/layout/PageShell';
import { PageHeader } from '@/components/layout/PageHeader';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { ListLoadMore } from '@/components/ui/ListLoadMore';
import { useLoadMoreList } from '@/lib/useLoadMoreList';
import { useAuthStore } from '@/stores/authStore';
import { useBranchStore } from '@/stores/branchStore';
import { financialService } from '../services/financialService';
import { ExpenseItem } from '../types';

const ExpensesPage: React.FC = () => {
  const { t } = useTranslation();
  const { data: expenses, isLoading, error } = useExpenses();
  const [search, setSearch] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const { user } = useAuthStore();
  const { activeBranch, isAllBranches } = useBranchStore();
  const branchId = isAllBranches ? null : activeBranch?.id;

  const filteredExpenses = useMemo(() => {
    if (!expenses) return [];
    return expenses.filter(e => 
      (e.description?.toLowerCase().includes(search.toLowerCase()) || false) ||
      (e.category?.toLowerCase().includes(search.toLowerCase()) || false)
    );
  }, [expenses, search]);

  const fetchExpensesPage = React.useCallback(async ({ page, limit }: { page: number; limit: number }) => {
    if (!user?.id) throw new Error('No dealer ID');
    return financialService.getExpenses(user.id, branchId, search || undefined, page, limit);
  }, [user?.id, branchId, search]);

  const pagedExpenses = useLoadMoreList<ExpenseItem>({
    initialLimit: 12,
    step: 12,
    fetchFn: fetchExpensesPage,
    dependencies: [fetchExpensesPage],
  });

  const totalExpenses = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [filteredExpenses]);

  const getCategoryLabel = (catId: string) => {
    const cat = EXPENSE_CATEGORIES.find(c => c.value === catId);
    if (!cat) return catId;
    const Icon = cat.icon;
    return (
      <>
        <Icon className="w-3.5 h-3.5" />
        {cat.label}
      </>
    );
  };

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
    <PageShell width="wide">
      <PageHeader
        eyebrow={t('nav.financials', 'Financials')}
        title={t('nav.expenses', 'Expenses')}
        description={t('financials.expensesSubtitle', 'Track and manage your operational costs')}
        action={
          <Button onClick={() => setIsAddModalOpen(true)} leftIcon={<Plus className="w-5 h-5" />}>
            {t('financials.recordExpense')}
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-red-50 to-white p-6 rounded-2xl border border-red-100 shadow-sm md:col-span-1">
          <p className="text-sm font-medium text-red-800 mb-2">{t('financials.totalExpenses', 'Total Expenses')}</p>
          <h2 className="text-3xl font-black text-red-600">{formatCurrency(totalExpenses)}</h2>
          <p className="text-xs text-red-600/70 mt-2">{t('financials.forDisplayedPeriod', 'For displayed period')}</p>
        </div>
        
        <div className="md:col-span-2 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-center">
          <div className="relative">
            <Input
              placeholder={t('financials.searchExpenses', 'Search description or category...')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {filteredExpenses.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            {t('common.noResults')}
          </div>
        ) : (
          <>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="py-3 px-4 font-bold text-gray-900 text-sm">{t('financials.date')}</th>
                  <th className="py-3 px-4 font-bold text-gray-900 text-sm">{t('financials.category')}</th>
                  <th className="py-3 px-4 font-bold text-gray-900 text-sm">{t('financials.description')}</th>
                  <th className="py-3 px-4 font-bold text-gray-900 text-sm">{t('financials.paidVia')}</th>
                  <th className="py-3 px-4 font-bold text-gray-900 text-sm text-right">{t('financials.amount')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pagedExpenses.visibleItems.map((expense) => (
                  <tr key={expense.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 text-sm text-gray-500 whitespace-nowrap">
                      {formatDate(expense.expense_date)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {getCategoryLabel(expense.category || '')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm font-medium text-gray-900 max-w-[200px] truncate" title={expense.description || ''}>
                      {expense.description}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs uppercase font-bold tracking-wider text-gray-500">
                        {expense.paid_via}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm font-bold text-red-600 text-right whitespace-nowrap">
                      {formatCurrency(expense.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ListLoadMore
            shown={pagedExpenses.visibleCount}
            total={pagedExpenses.totalCount}
            onLoadMore={pagedExpenses.loadMore}
            label={t('common.loadMore', 'Load more')}
          />
          </>
        )}
      </div>

      {isAddModalOpen && (
        <ExpenseModal onClose={() => setIsAddModalOpen(false)} />
      )}
    </PageShell>
  );
};

export default ExpensesPage;
