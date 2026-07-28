import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { History, RotateCcw, Search, SlidersHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageShell } from '@/components/layout/PageShell';
import { Button, DatePicker, Input, Modal, Select, Skeleton, Textarea } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useStaffStore } from '@/stores/staffStore';
import { listStaffMembers } from '@/features/staff/services/staffService';
import { getTransactionEvents, undoTransaction } from '../services/transactionsService';
import type { TransactionEvent, TransactionType } from '../types';

const typeLabels: Record<TransactionType, string> = {
  bill: 'Bill',
  farmer_payment: 'Farmer payment',
  stock_purchase: 'Stock purchase',
  supplier_payment: 'Supplier payment',
  bill_return: 'Return',
  stock_transfer: 'Stock transfer',
  expense: 'Expense',
  cash_entry: 'Cash entry',
};

const invalidationKeys = [
  'bills', 'bill', 'inventory', 'farmer', 'farmers', 'supplier', 'suppliers',
  'cashbook', 'cash-book', 'daily-book', 'dashboard', 'reports', 'financial', 'transactions',
];
const PAGE_SIZE = 20;

function remainingUndoTime(expiresAt: string | null): string {
  if (!expiresAt) return '';
  const remaining = new Date(expiresAt).getTime() - Date.now();
  if (remaining <= 0) return 'Undo window ended';
  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  return `${hours}h ${minutes}m left`;
}

function undoEffect(event: TransactionEvent): string {
  if (event.source_type === 'bill_return') return 'Reverses the return allocations, received stock, and any related farmer or cash settlement.';
  switch (event.source_type) {
    case 'bill': return 'Restores the exact stock lots, removes the bill payment and cash entry, and recalculates the farmer due.';
    case 'farmer_payment': return 'Reopens the payment allocations, restores the farmer due, and removes the cash-book entry.';
    case 'stock_purchase': return 'Removes only stock that has not been used, then restores the supplier due and related cash entry.';
    case 'supplier_payment': return 'Restores the supplier due and removes the related cash-book entry.';
    case 'stock_transfer': return 'Moves untouched transferred lots back to the original shop.';
    case 'expense': return 'Removes the expense and its related cash-book entry.';
    case 'cash_entry': return 'Removes this manual cash-book entry.';
    default: return 'Reverses this transaction only when no later linked activity depends on it.';
  }
}

export const TransactionsPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentStaff = useStaffStore((s) => s.currentStaff);
  const user = useAuthStore((s) => s.user);
  const [staffFilter, setStaffFilter] = useState('');
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [branchId, setBranchId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<TransactionEvent | null>(null);
  const [detail, setDetail] = useState<TransactionEvent | null>(null);
  const [reason, setReason] = useState('');

  const filters = useMemo(() => ({
    search,
    type,
    status,
    branchId: currentStaff ? null : branchId,
    startDate,
    endDate,
    staffId: currentStaff ? currentStaff.id : (staffFilter || null),
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  }), [branchId, currentStaff, endDate, page, search, staffFilter, startDate, status, type]);
  useEffect(() => setPage(0), [branchId, endDate, search, staffFilter, startDate, status, type]);
  const { data, isLoading } = useQuery({ queryKey: ['transactions', filters], queryFn: () => getTransactionEvents(filters) });
  const { data: branches = [] } = useQuery({
    queryKey: ['transaction-filter-branches'],
    queryFn: async () => {
      const { data: branchRows, error } = await supabase.from('branches').select('id, name').eq('is_active', true).order('name');
      if (error) throw error;
      return branchRows ?? [];
    },
  });
  const { data: staffList = [] } = useQuery({
    queryKey: ['transaction-filter-staff', user?.id],
    queryFn: () => listStaffMembers(user!.id),
    enabled: !!user?.id && !currentStaff,
  });
  const undo = useMutation({
    mutationFn: ({ id, reasonText }: { id: string; reasonText: string }) => undoTransaction(id, reasonText),
    onSuccess: async () => {
      await Promise.all(invalidationKeys.map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
      toast.success('Transaction undone. Related balances and stock were refreshed.');
      setSelected(null);
      setReason('');
    },
    onError: (error: Error) => toast.error(error.message || 'This transaction cannot be undone safely.'),
  });

  const rows = data?.data ?? [];

  return (
    <PageShell width="wide">
      <PageHeader title="Transactions" description="All business activity in one place. Eligible transactions can be undone for 48 hours." onBack={() => navigate('/more')} />

      {currentStaff && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-800">
          <SlidersHorizontal className="h-4 w-4 shrink-0" />
          Showing only your activity — bills, payments, and entries you created.
        </div>
      )}

      <div className={`mt-4 grid gap-3 rounded-lg border border-border bg-surface p-3 ${currentStaff ? 'md:grid-cols-2 xl:grid-cols-[1fr_11rem_11rem_10rem]' : 'md:grid-cols-2 xl:grid-cols-[1fr_11rem_11rem_10rem_10rem_10rem]'}`}>
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search reference or party" leftIcon={<Search className="h-4 w-4" />} />
        <Select value={type} onChange={(event) => setType(event.target.value)} options={Object.entries(typeLabels).map(([value, label]) => ({ value, label }))} placeholder="All types" />
        <Select value={status} onChange={(event) => setStatus(event.target.value)} options={[{ value: 'active', label: 'Active' }, { value: 'undone', label: 'Undone' }, { value: 'read_only', label: 'History only' }]} placeholder="All statuses" />
        {!currentStaff && <Select value={branchId} onChange={(event) => setBranchId(event.target.value)} options={branches.map((branch) => ({ value: branch.id, label: branch.name }))} placeholder="All shops" />}
        {!currentStaff && <Select value={staffFilter} onChange={(event) => setStaffFilter(event.target.value)} options={[{ value: '', label: 'All staff' }, ...staffList.map((s) => ({ value: s.id, label: s.name }))]} />}
        <div className="grid grid-cols-2 gap-2"><DatePicker value={startDate} onChange={setStartDate} placeholder="From date" /><DatePicker value={endDate} onChange={setEndDate} placeholder="To date" /></div>
      </div>

      <div className="mt-3 flex items-center gap-2 text-sm text-text-muted"><SlidersHorizontal className="h-4 w-4" /> {data?.total ?? 0} transactions</div>

      {isLoading ? (
        <div className="mt-4 space-y-2">{[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-24 w-full rounded-lg" />)}</div>
      ) : rows.length === 0 ? (
        <div className="mt-6 border border-dashed border-border bg-surface p-10 text-center">
          <History className="mx-auto h-9 w-9 text-text-muted" />
          <p className="mt-3 font-bold text-text-primary">No transactions found</p>
          <p className="mt-1 text-sm text-text-muted">New bills, payments, stock changes, and cash entries will appear here.</p>
        </div>
      ) : (
        <div className="mt-4 divide-y divide-border overflow-hidden border border-border bg-white">
          {rows.map((event) => (
            <button key={event.id} type="button" onClick={() => setDetail(event)} className="flex w-full flex-col gap-3 p-4 text-left hover:bg-surface sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-text-primary">{typeLabels[event.source_type] ?? event.source_type}</span>
                  <span className={`rounded px-2 py-0.5 text-xs font-bold ${event.status === 'undone' ? 'bg-slate-100 text-slate-600' : event.status === 'read_only' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{event.undo_state}</span>
                </div>
                <div className="mt-1 truncate text-sm text-text-secondary">{event.reference || 'No reference'}{event.party_name ? ` · ${event.party_name}` : ''}{event.branch_name ? ` · ${event.branch_name}` : ''}</div>
                <div className="mt-1 text-xs text-text-muted">{formatDate(event.created_at)} · {new Date(event.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                {event.status === 'undone' && event.undo_reason ? <div className="mt-1 text-xs text-text-muted">Reason: {event.undo_reason}</div> : null}
              </div>
              <div className="flex shrink-0 items-center gap-3 sm:text-right">
                <div className="min-w-[5.5rem] font-black tabular-nums text-text-primary">
                  {event.amount !== null ? formatCurrency(Number(event.amount)) : event.quantity !== null ? `${event.quantity} units` : '—'}
                </div>
                {event.can_undo ? <Button size="sm" variant="outline" onClick={(clickEvent) => { clickEvent.stopPropagation(); setSelected(event); }} leftIcon={<RotateCcw className="h-3.5 w-3.5" />}>Undo</Button> : null}
              </div>
            </button>
          ))}
        </div>
      )}

      {data && data.total > PAGE_SIZE ? (
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="text-sm text-text-muted">
            Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, data.total)} of {data.total}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 0 || isLoading} onClick={() => setPage((current) => current - 1)}>Previous</Button>
            <Button size="sm" variant="outline" disabled={(page + 1) * PAGE_SIZE >= data.total || isLoading} onClick={() => setPage((current) => current + 1)}>Next</Button>
          </div>
        </div>
      ) : null}

      <Modal
        isOpen={!!detail}
        onClose={() => setDetail(null)}
        title="Transaction details"
        footerButtons={[
          ...(detail?.source_type === 'bill' ? [{ label: 'Open bill', variant: 'primary' as const, onClick: () => { navigate(`/bills/${detail.source_id}`); setDetail(null); } }] : []),
          { label: 'Close', variant: 'secondary', onClick: () => setDetail(null) },
        ]}
      >
        {detail ? <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3"><div><span className="block text-xs text-text-muted">Type</span><strong>{typeLabels[detail.source_type]}</strong></div><div><span className="block text-xs text-text-muted">Status</span><strong>{detail.undo_state}</strong></div><div><span className="block text-xs text-text-muted">Reference</span><strong>{detail.reference || '—'}</strong></div><div><span className="block text-xs text-text-muted">Shop</span><strong>{detail.branch_name || 'All shops'}</strong></div><div><span className="block text-xs text-text-muted">Party</span><strong>{detail.party_name || '—'}</strong></div><div><span className="block text-xs text-text-muted">Created</span><strong>{formatDate(detail.created_at)} {new Date(detail.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></div></div>
          <div className="border border-border bg-surface p-3 font-semibold">{detail.amount !== null ? `Amount: ${formatCurrency(Number(detail.amount))}` : detail.quantity !== null ? `Quantity: ${detail.quantity} units` : 'No amount or quantity recorded'}</div>
          {detail.status === 'undone' ? <div className="border border-slate-200 bg-slate-50 p-3">Undo reason: {detail.undo_reason || 'Not recorded'}</div> : null}
          {detail.can_undo ? <div className="border border-amber-200 bg-amber-50 p-3 text-amber-950">If undone: {undoEffect(detail)}</div> : null}
        </div> : null}
      </Modal>

      <Modal
        isOpen={!!selected}
        onClose={() => !undo.isPending && setSelected(null)}
        title="Undo transaction"
        footerButtons={[
          { label: 'Cancel', variant: 'secondary', onClick: () => setSelected(null), disabled: undo.isPending },
          { label: 'Undo transaction', variant: 'danger', loading: undo.isPending, disabled: reason.trim().length < 3, onClick: () => selected && undo.mutate({ id: selected.id, reasonText: reason }) },
        ]}
      >
        {selected ? <div className="space-y-4">
          <div className="border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><strong>{selected.reference || typeLabels[selected.source_type]}</strong><br />{undoEffect(selected)}</div>
          <p className="text-sm text-text-secondary">This is available for {remainingUndoTime(selected.undo_expires_at)}. The system will stop the undo if a later linked action makes it unsafe.</p>
          <Textarea label="Reason for undo" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain why this needs to be reversed" rows={3} />
        </div> : null}
      </Modal>
    </PageShell>
  );
};

export default TransactionsPage;
