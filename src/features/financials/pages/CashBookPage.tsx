import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, BookOpen, Plus, Minus, Wallet, TrendingUp, Scale, Smartphone, Landmark, Save } from 'lucide-react';
import { useCashBook, useCloseCashDay, useDailyCashClarity } from '../hooks/useFinancials';
import { CashEntryModal } from '../components/CashEntryModal';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { PageShell } from '@/components/layout/PageShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker';
import { ListLoadMore } from '@/components/ui/ListLoadMore';
import { useLoadMoreList } from '@/lib/useLoadMoreList';
import { useAuthStore } from '@/stores/authStore';
import { useBranchStore } from '@/stores/branchStore';
import { DateRangeFilter } from '@/components/ui';
import { toast } from 'sonner';

const CashBookPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const { activeBranch, isAllBranches } = useBranchStore();
  
  // Default to current month
  const today = new Date();
  const todayLabel = today.toISOString().slice(0, 10);
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
  
  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(lastDay);
  const [cashDate, setCashDate] = useState(todayLabel);
  const [physicalCash, setPhysicalCash] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [modalType, setModalType] = useState<'income' | 'expense' | null>(null);

  const { data: ledger, isLoading, error } = useCashBook(startDate, endDate);
  const { data: dailyCash } = useDailyCashClarity(cashDate);
  const closeCashMutation = useCloseCashDay();

  const entries = ledger?.entries || [];
  const openingBalance = ledger?.openingBalance || 0;

  const totals = useMemo(() => {
    const income = entries.filter((e) => e.entry_type === 'income').reduce((sum, e) => sum + e.amount, 0);
    const expense = entries.filter((e) => e.entry_type === 'expense').reduce((sum, e) => sum + e.amount, 0);
    const movement = income - expense;
    const closingBalance = openingBalance + movement;
    const averageEntry = entries.length ? (income + expense) / entries.length : 0;
    const expenseRatio = income > 0 ? (expense / income) * 100 : 0;
    return { income, expense, movement, closingBalance, averageEntry, expenseRatio };
  }, [entries, openingBalance]);

  const runningEntries = useMemo(() => {
    let running = openingBalance;
    return entries.map((entry) => {
      running += entry.entry_type === 'income' ? entry.amount : -entry.amount;
      return { ...entry, runningBalance: running };
    });
  }, [entries, openingBalance]);
  const pagedEntries = useLoadMoreList(runningEntries, {
    initialCount: 15,
    step: 15,
    resetDeps: [startDate, endDate, entries.length],
  });

  const handleCloseCash = async () => {
    if (!user?.id || !dailyCash) return;
    const physical = Number(physicalCash);
    if (Number.isNaN(physical) || physical < 0) {
      toast.error('Enter the physical cash counted at the counter.');
      return;
    }

    try {
      await closeCashMutation.mutateAsync({
        dealer_id: user.id,
        branch_id: isAllBranches ? null : activeBranch?.id,
        closing_date: cashDate,
        physical_cash: physical,
        notes: closingNotes || null,
      });
      toast.success('Counter cash closed for the day.');
    } catch (err: any) {
      toast.error(err.message || t('common.error'));
    }
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
        title={t('nav.cashbook', 'Cash Book')}
        description={t('financials.cashbookSubtitle', 'Track all cash inflows and outflows')}
        onBack={() => navigate('/more')}
        action={
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button 
              variant="success"
              onClick={() => setModalType('income')} 
              leftIcon={<Plus className="w-4 h-4" />}
              className="min-h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 px-4 font-black text-white shadow-[0_10px_22px_rgba(16,185,129,0.22)] hover:from-emerald-600 hover:to-emerald-700"
            >
              {t('financials.moneyIn', 'Money In')}
            </Button>
            <Button 
              variant="danger"
              onClick={() => setModalType('expense')} 
              leftIcon={<Minus className="w-4 h-4" />}
              className="min-h-11 rounded-2xl bg-gradient-to-br from-rose-500 to-rose-600 px-4 font-black text-white shadow-[0_10px_22px_rgba(244,63,94,0.22)] hover:from-rose-600 hover:to-rose-700"
            >
              {t('financials.moneyOut', 'Money Out')}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
        <div className="col-span-full rounded-[26px] border border-slate-200 bg-white p-4 shadow-[0_12px_32px_rgba(148,163,184,0.12)] sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">Daily Counter Summary</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">{formatDate(cashDate)}</h2>
              <p className="mt-1 text-xs font-semibold text-slate-500 sm:text-sm">
              </p>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2 xl:flex xl:items-end">
              <DatePicker
                value={cashDate}
                onChange={setCashDate}
                className="w-full sm:w-48"
              />
              <Input
                type="number"
                value={physicalCash}
                onChange={(event) => setPhysicalCash(event.target.value)}
                placeholder="Physical cash"
                className="w-full sm:w-48"
              />
              <Input
                value={closingNotes}
                onChange={(event) => setClosingNotes(event.target.value)}
                placeholder="Closing note"
                className="w-full sm:w-52"
              />
              <Button
                type="button"
                onClick={handleCloseCash}
                loading={closeCashMutation.isPending}
                leftIcon={<Save className="h-4 w-4" />}
                className="min-h-12 rounded-2xl font-black xl:px-5"
              >
                Close Day
              </Button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2.5 xl:grid-cols-6">
            {[
              { label: 'Opening Cash', value: dailyCash?.openingCash ?? 0, icon: Wallet, cardTone: 'from-slate-50 to-slate-100/60 border-slate-200', iconTone: 'bg-white text-slate-700 shadow-sm', gridClass: 'col-span-2 xl:col-span-1' },
              { label: 'Cash In', value: dailyCash?.cashIn ?? 0, icon: ArrowDownRight, cardTone: 'from-emerald-50/80 to-emerald-100/50 border-emerald-100', iconTone: 'bg-white text-emerald-600 shadow-sm', gridClass: 'col-span-1' },
              { label: 'Cash Out', value: dailyCash?.cashOut ?? 0, icon: ArrowUpRight, cardTone: 'from-rose-50/80 to-rose-100/50 border-rose-100', iconTone: 'bg-white text-rose-600 shadow-sm', gridClass: 'col-span-1' },
              { label: 'UPI In', value: dailyCash?.upiIn ?? 0, icon: Smartphone, cardTone: 'from-sky-50/80 to-sky-100/50 border-sky-100', iconTone: 'bg-white text-sky-600 shadow-sm', gridClass: 'col-span-1' },
              { label: 'Shop Expenses', value: dailyCash?.shopExpenses ?? 0, icon: Landmark, cardTone: 'from-indigo-50/80 to-indigo-100/50 border-indigo-100', iconTone: 'bg-white text-indigo-600 shadow-sm', gridClass: 'col-span-1' },
              { label: 'Expected Cash', value: dailyCash?.expectedClosingCash ?? 0, icon: Scale, cardTone: 'from-amber-50/80 to-amber-100/50 border-amber-100', iconTone: 'bg-white text-amber-600 shadow-sm', gridClass: 'col-span-2 xl:col-span-1' },
            ].map((card) => (
              <div key={card.label} className={cn("rounded-2xl border bg-gradient-to-br p-3 shadow-sm sm:p-4", card.cardTone, card.gridClass)}>
                <div className={cn('mb-2.5 flex h-9 w-9 items-center justify-center rounded-xl', card.iconTone)}>
                  <card.icon className="h-4.5 w-4.5" />
                </div>
                <p className="text-[9px] font-black uppercase tracking-wider text-slate-500 sm:text-xs">{card.label}</p>
                <p className="mt-1 text-[0.95rem] font-black tracking-tight text-slate-900 sm:text-xl">{formatCurrency(card.value)}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-2.5 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-sm font-semibold text-slate-600 sm:grid-cols-2">
            <div className="rounded-xl bg-white px-3 py-2.5">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Physical closing</div>
              <div className="mt-0.5 font-black text-slate-900">
                {dailyCash?.physicalClosingCash != null ? formatCurrency(dailyCash.physicalClosingCash) : 'Not closed'}
              </div>
            </div>
            <div className="rounded-xl bg-white px-3 py-2.5">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Variance</div>
              <div className={cn('mt-0.5 font-black', (dailyCash?.variance ?? 0) === 0 ? 'text-emerald-600' : 'text-rose-600')}>
                {dailyCash?.variance != null ? formatCurrency(dailyCash.variance) : 'Not counted'}
              </div>
            </div>
          </div>

          {dailyCash?.entries && dailyCash.entries.filter(e => !e.source || e.source === 'manual').length ? (
            <>
            <div className="mt-4 space-y-2 md:hidden">
              {dailyCash.entries.filter(e => !e.source || e.source === 'manual').map((entry) => {
                const time = new Date(entry.created_at).toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                const isCash = entry.displayType === 'cash_in' || entry.displayType === 'cash_out';
                const amount =
                  entry.displayType === 'upi_in' || entry.displayType === 'cheque_in'
                    ? entry.amount
                    : Math.abs(entry.counterCashChange);
                const isOut = entry.counterCashChange < 0;

                return (
                  <div key={entry.id} className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-black capitalize text-slate-900">{entry.source?.replace(/_/g, ' ') || 'Manual'}</div>
                        <div className="mt-0.5 truncate text-xs font-semibold text-slate-500">{entry.notes || '-'}</div>
                        <div className="mt-1 text-[11px] font-bold text-slate-400">{time}</div>
                      </div>
                      <div className="text-right">
                        <div className={cn('text-sm font-black', isOut ? 'text-rose-600' : isCash ? 'text-emerald-600' : entry.displayType === 'upi_in' ? 'text-sky-700' : 'text-violet-700')}>
                          {isCash ? `${isOut ? '-' : '+'}${formatCurrency(amount)}` : formatCurrency(amount)}
                        </div>
                        <div className="mt-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                          {entry.displayType.replace(/_/g, ' ')}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 hidden overflow-x-auto rounded-xl border border-slate-100 md:block">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-black uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Details</th>
                    <th className="px-4 py-3 text-right">Cash</th>
                    <th className="px-4 py-3 text-right">UPI</th>
                    <th className="px-4 py-3 text-right">Cheque</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {dailyCash.entries.filter(e => !e.source || e.source === 'manual').map((entry) => {
                    const time = new Date(entry.created_at).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                    return (
                      <tr key={entry.id}>
                        <td className="px-4 py-3 font-semibold text-slate-500">{time}</td>
                        <td className="px-4 py-3 font-bold capitalize text-slate-800">{entry.source?.replace(/_/g, ' ') || 'Manual'}</td>
                        <td className="px-4 py-3 text-slate-600">{entry.notes || '-'}</td>
                        <td className={cn('px-4 py-3 text-right font-black', entry.counterCashChange < 0 ? 'text-rose-600' : 'text-emerald-600')}>
                          {entry.displayType === 'cash_in' || entry.displayType === 'cash_out'
                            ? `${entry.counterCashChange < 0 ? '-' : '+'}${formatCurrency(Math.abs(entry.counterCashChange))}`
                            : '-'}
                        </td>
                        <td className="px-4 py-3 text-right font-black text-sky-700">
                          {entry.displayType === 'upi_in' ? formatCurrency(entry.amount) : '-'}
                        </td>
                        <td className="px-4 py-3 text-right font-black text-violet-700">
                          {entry.displayType === 'cheque_in' ? formatCurrency(entry.amount) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
          ) : null}
        </div>

        <div className="col-span-full rounded-3xl border border-slate-200 bg-white p-3 shadow-[0_12px_32px_rgba(148,163,184,0.12)] sm:p-5 mt-2">
          <div className="mb-4">
            <DateRangeFilter
              startDate={startDate}
              endDate={endDate}
              onChange={(start, end) => {
                setStartDate(start);
                setEndDate(end);
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: t('financials.openingBalance', 'Opening Balance'), value: openingBalance, icon: Wallet, tone: 'bg-slate-50 text-slate-700', valClass: 'text-slate-900', gridClass: 'col-span-2 sm:col-span-1' },
              { label: t('financials.totalIn', 'Total In'), value: totals.income, icon: ArrowDownRight, tone: 'bg-emerald-50 text-emerald-700', valClass: 'text-emerald-700' },
              { label: t('financials.totalOut', 'Total Out'), value: totals.expense, icon: ArrowUpRight, tone: 'bg-rose-50 text-rose-700', valClass: 'text-rose-700' },
              { label: t('financials.averageEntry', 'Average Entry'), value: totals.averageEntry, icon: BookOpen, tone: 'bg-blue-50 text-blue-700', valClass: 'text-blue-700' },
              { label: t('financials.netMovement', 'Net Movement'), value: totals.movement, icon: TrendingUp, tone: 'bg-amber-50 text-amber-700', valClass: totals.movement >= 0 ? "text-amber-700" : "text-rose-600" },
              { label: t('financials.closingBalance', 'Closing Balance'), value: totals.closingBalance, icon: Scale, tone: 'bg-emerald-50 text-emerald-700', valClass: totals.closingBalance >= 0 ? "text-emerald-700" : "text-rose-600", gridClass: 'col-span-2 sm:col-span-1' },
            ].map((card) => (
              <div key={card.label} className={cn("rounded-2xl border border-slate-100 bg-gradient-to-br from-white to-slate-50/70 p-3 shadow-sm", card.gridClass)}>
                <div className={cn('mb-2.5 flex h-9 w-9 items-center justify-center rounded-xl', card.tone)}>
                  <card.icon className="h-4.5 w-4.5" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{card.label}</p>
                <p className={cn("mt-1 text-[1.05rem] font-black tracking-tight", card.valClass)}>{formatCurrency(card.value)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mt-2">
        {(!entries || entries.length === 0) ? (
          <div className="p-16 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <BookOpen className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">{t('common.noResults')}</h3>
            <p className="text-gray-500 max-w-sm">{t('financials.noEntriesDesc', 'No cash entries found for the selected date range. Click Money In or Money Out to add one.')}</p>
          </div>
        ) : (
          <>
          <div className="space-y-2 p-3 md:hidden">
            {pagedEntries.visibleItems.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-black text-slate-900">{entry.notes || 'No details'}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-500">
                        {entry.source?.replace('_', ' ') || 'Manual'}
                      </span>
                      <span className="text-xs font-semibold text-slate-400">{formatDate(entry.entry_date)}</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className={cn('text-sm font-black', entry.entry_type === 'income' ? 'text-emerald-600' : 'text-rose-600')}>
                      {entry.entry_type === 'income' ? '+' : '-'}{formatCurrency(entry.amount)}
                    </div>
                    <div className="mt-1 text-[11px] font-bold text-slate-500">{formatCurrency(entry.runningBalance)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden overflow-x-auto custom-scrollbar md:block">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-slate-50/80 border-b border-gray-100">
                  <th className="py-4 px-6 font-bold text-slate-700 text-xs uppercase tracking-wider">{t('financials.date', 'Date')}</th>
                  <th className="py-4 px-6 font-bold text-slate-700 text-xs uppercase tracking-wider">{t('financials.details', 'Details')}</th>
                  <th className="py-4 px-6 font-bold text-slate-700 text-xs uppercase tracking-wider">{t('financials.source', 'Source')}</th>
                  <th className="py-4 px-6 font-bold text-slate-700 text-xs uppercase tracking-wider text-right">{t('financials.in', 'In (+)')}</th>
                  <th className="py-4 px-6 font-bold text-slate-700 text-xs uppercase tracking-wider text-right">{t('financials.out', 'Out (-)')}</th>
                  <th className="py-4 px-6 font-bold text-slate-700 text-xs uppercase tracking-wider text-right">{t('financials.runningBalance', 'Running Balance')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pagedEntries.visibleItems.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="py-4 px-6 text-sm text-gray-500 whitespace-nowrap group-hover:text-gray-700 transition-colors">
                      {formatDate(entry.entry_date)}
                    </td>
                    <td className="py-4 px-6 text-sm font-medium text-gray-900 max-w-[300px] truncate" title={entry.notes || ''}>
                      {entry.notes || <span className="text-gray-400 italic">No details</span>}
                    </td>
                    <td className="py-4 px-6">
                      <span className={cn(
                        "text-[11px] font-bold tracking-wider px-2.5 py-1 rounded-md uppercase",
                        entry.source === 'sale' ? "bg-blue-50 text-blue-700 border border-blue-100" :
                        entry.source === 'purchase' ? "bg-orange-50 text-orange-700 border border-orange-100" :
                        entry.source === 'expense' ? "bg-rose-50 text-rose-700 border border-rose-100" :
                        "bg-gray-50 text-gray-600 border border-gray-200"
                      )}>
                        {entry.source?.replace('_', ' ') || 'Manual'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-sm font-bold text-emerald-600 text-right whitespace-nowrap tabular-nums">
                      {entry.entry_type === 'income' ? formatCurrency(entry.amount) : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="py-4 px-6 text-sm font-bold text-rose-600 text-right whitespace-nowrap tabular-nums">
                      {entry.entry_type === 'expense' ? formatCurrency(entry.amount) : <span className="text-gray-300">-</span>}
                    </td>
                    <td className={cn(
                      "py-4 px-6 text-sm font-black text-right whitespace-nowrap tabular-nums",
                      entry.runningBalance >= 0 ? "text-slate-900" : "text-rose-600"
                    )}>
                      {formatCurrency(entry.runningBalance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ListLoadMore
            shown={pagedEntries.visibleCount}
            total={pagedEntries.totalCount}
            onLoadMore={pagedEntries.loadMore}
            label={t('common.loadMore', 'Load more')}
          />
          </>
        )}
      </div>

      {modalType && (
        <CashEntryModal type={modalType} onClose={() => setModalType(null)} />
      )}
    </PageShell>
  );
};

export default CashBookPage;
