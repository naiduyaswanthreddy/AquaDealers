import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Modal } from '@/components/ui';
import Input from '@/components/ui/Input';
import { formatCurrency, getLocalDateString } from '@/lib/utils';
import { useCreateBillReturn, useBillReturns } from '../hooks/useBillReturns';

interface BillItem {
  id: string;
  product_name_snapshot?: string | null;
  quantity: number;
  unit_price: number;
}

interface Bill {
  id: string;
  bill_number?: string | null;
  balance_due?: number | null;
  bill_items?: BillItem[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  bill: Bill;
}

export const ReturnItemsModal: React.FC<Props> = ({ isOpen, onClose, bill }) => {
  const create = useCreateBillReturn();
  const { data: existingReturns = [] } = useBillReturns(bill.id);

  // qty already returned per bill_item across all past returns.
  const returnedByItem = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of existingReturns) {
      for (const it of r.items) {
        // We don't have bill_item_id on the get_returns_for_bill payload. Best-effort
        // client cap: match by product name. Server enforces the real cap anyway.
        const key = String(it.product_name || '').toLowerCase();
        map.set(key, (map.get(key) || 0) + Number(it.quantity || 0));
      }
    }
    return map;
  }, [existingReturns]);

  const items = bill.bill_items || [];
  const [qtyByItem, setQtyByItem] = useState<Record<string, string>>({});
  const [returnDate, setReturnDate] = useState<string>(getLocalDateString());
  const [notes, setNotes] = useState<string>('');

  React.useEffect(() => {
    if (isOpen) { setQtyByItem({}); setReturnDate(getLocalDateString()); setNotes(''); }
  }, [isOpen]);

  const rows = items.map((it) => {
    const alreadyReturned = returnedByItem.get(String(it.product_name_snapshot || '').toLowerCase()) || 0;
    const maxReturnable = Math.max(0, Number(it.quantity) - alreadyReturned);
    const qStr = qtyByItem[it.id] || '';
    const q = Number(qStr) || 0;
    const clamped = Math.min(Math.max(q, 0), maxReturnable);
    const lineTotal = clamped * Number(it.unit_price || 0);
    return { it, alreadyReturned, maxReturnable, q: clamped, qStr, lineTotal };
  });

  const totalReturn = rows.reduce((s, r) => s + r.lineTotal, 0);
  const willBeSelected = rows.filter((r) => r.q > 0).length;
  const canSubmit = willBeSelected > 0 && !create.isPending;

  const handleSubmit = () => {
    const payload = rows
      .filter((r) => r.q > 0)
      .map((r) => ({ bill_item_id: r.it.id, quantity: r.q, unit_price: Number(r.it.unit_price) }));
    if (!payload.length) { toast.error('Choose at least one item and quantity.'); return; }
    create.mutate(
      { billId: bill.id, returnDate, notes: notes || undefined, items: payload },
      {
        onSuccess: (res) => {
          toast.success(`Return ${res.return_number} recorded — ${formatCurrency(res.total)} refunded to farmer.`);
          onClose();
        },
      }
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Return items — ${bill.bill_number || 'Bill'}`}
      contentClassName="max-w-2xl"
      footerButtons={[
        { label: 'Cancel', variant: 'ghost', onClick: onClose, disabled: create.isPending },
        {
          label: create.isPending ? 'Recording…' : `Confirm return (${formatCurrency(totalReturn)})`,
          variant: 'primary',
          onClick: handleSubmit,
          disabled: !canSubmit,
          loading: create.isPending,
        },
      ]}
    >
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Return date</label>
            <Input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} max={getLocalDateString()} />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Note (optional)</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reason for return" />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 overflow-hidden">
          <div className="grid grid-cols-[1fr_90px_90px_100px] gap-2 bg-slate-100 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-slate-600">
            <div>Item</div>
            <div className="text-right">Billed</div>
            <div className="text-right">Return qty</div>
            <div className="text-right">Line total</div>
          </div>
          {rows.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-slate-500">No items on this bill.</div>
          )}
          {rows.map((r) => (
            <div key={r.it.id} className="grid grid-cols-[1fr_90px_90px_100px] gap-2 items-center border-t border-slate-100 px-3 py-2 text-sm">
              <div className="min-w-0">
                <div className="font-semibold truncate text-slate-800">{r.it.product_name_snapshot || 'Item'}</div>
                <div className="text-[11px] text-slate-500">
                  {formatCurrency(Number(r.it.unit_price))}/unit
                  {r.alreadyReturned > 0 && (
                    <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-amber-800 font-semibold">
                      {r.alreadyReturned} already returned
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right tabular-nums">{Number(r.it.quantity)}</div>
              <div className="flex justify-end">
                <input
                  type="number"
                  min={0}
                  max={r.maxReturnable}
                  step="0.01"
                  value={r.qStr}
                  onChange={(e) => setQtyByItem((prev) => ({ ...prev, [r.it.id]: e.target.value }))}
                  disabled={r.maxReturnable <= 0}
                  placeholder="0"
                  className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-right tabular-nums text-sm focus:border-sky-500 focus:outline-none disabled:bg-slate-100"
                />
              </div>
              <div className="text-right tabular-nums font-semibold text-slate-800">
                {r.lineTotal > 0 ? formatCurrency(r.lineTotal) : '—'}
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm text-slate-700">
          <div className="flex justify-between">
            <span>Bill current balance</span>
            <span className="tabular-nums font-semibold">{formatCurrency(Number(bill.balance_due || 0))}</span>
          </div>
          <div className="flex justify-between text-emerald-700">
            <span>Return total (reduces balance)</span>
            <span className="tabular-nums font-semibold">− {formatCurrency(totalReturn)}</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-slate-200 pt-2">
            <span className="font-bold">New balance</span>
            <span className="tabular-nums font-black">
              {formatCurrency(Math.max(0, Number(bill.balance_due || 0) - totalReturn))}
            </span>
          </div>
          {totalReturn > Number(bill.balance_due || 0) && (
            <div className="mt-1 text-xs text-emerald-700">
              Excess of {formatCurrency(totalReturn - Number(bill.balance_due || 0))} will be credited to the farmer&apos;s account.
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default ReturnItemsModal;
