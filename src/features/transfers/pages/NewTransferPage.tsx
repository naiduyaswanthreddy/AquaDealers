import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeftRight, Plus, Trash2 } from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui';
import Input from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useAuthStore } from '@/stores/authStore';
import { useBranchStore } from '@/stores/branchStore';
import { formatQuantity, getLocalDateString } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useCreateStockTransfer } from '../hooks/useTransfers';
import { TransferPreviewModal } from '../components/TransferPreviewModal';

interface Row {
  product_id: string;
  quantity: string;
}

interface InventoryRow {
  product_id: string;
  quantity_in_stock: number;
  products: { name: string; unit?: string | null } | null;
}

export const NewTransferPage: React.FC = () => {
  const navigate = useNavigate();
  const dealer = useAuthStore((s) => s.user);
  const branches = useBranchStore((s) => s.branches);
  const activeBranchId = useBranchStore((s) => s.getActiveBranchId());
  const create = useCreateStockTransfer();

  const [fromBranchId, setFromBranchId] = useState<string>(activeBranchId || branches[0]?.id || '');
  const [toBranchId, setToBranchId] = useState<string>('');
  const [transferDate, setTransferDate] = useState(getLocalDateString());
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<Row[]>([{ product_id: '', quantity: '' }]);

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);

  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  React.useEffect(() => {
    if (!dealer?.id || !fromBranchId) { setInventory([]); return; }
    supabase
      .from('inventory')
      .select('product_id, quantity_in_stock, products(name, unit)')
      .eq('dealer_id', dealer.id)
      .eq('branch_id', fromBranchId)
      .gt('quantity_in_stock', 0)
      .limit(5000)
      .then(({ data }) => setInventory((data ?? []) as any));
  }, [dealer?.id, fromBranchId]);

  const stockByProduct = useMemo(() => {
    const m = new Map<string, InventoryRow>();
    for (const r of inventory) m.set(r.product_id, r);
    return m;
  }, [inventory]);

  const branchOptions = branches.map((b) => ({ value: b.id, label: b.name }));
  const toBranchOptions = branchOptions.filter((b) => b.value !== fromBranchId);
  const productOptions = inventory.map((r) => ({
    value: r.product_id,
    label: `${r.products?.name || 'Product'} — ${formatQuantity(Number(r.quantity_in_stock), r.products?.unit)}`,
  }));

  const totalQty = rows.reduce((s, r) => s + (Number(r.quantity) || 0), 0);

  const updateRow = (i: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const removeRow = (i: number) => setRows((prev) => prev.filter((_, idx) => idx !== i));
  const isValid = !!(fromBranchId && toBranchId && rows.some(r => r.product_id && Number(r.quantity) > 0));

  const handleTransferPreview = () => {
    if (!isValid) return;
    const validRows = rows.filter(r => r.product_id && Number(r.quantity) > 0).map(r => {
      const p = stockByProduct.get(r.product_id);
      return { ...r, name: p?.products?.name || 'Unknown', unit: p?.products?.unit || '' };
    });
    setPreviewData({
      fromBranchName: branches.find(b => b.id === fromBranchId)?.name || '',
      toBranchName: branches.find(b => b.id === toBranchId)?.name || '',
      transferDate,
      notes,
      rows: validRows
    });
    setIsPreviewOpen(true);
  };

  const handleConfirmTransfer = async () => {
    if (!dealer?.id || !previewData) return;
    const items = previewData.rows.map((r: any) => ({ product_id: r.product_id, quantity: Number(r.quantity) }));

    // Client-side sanity: no over-transfer per row (server enforces too).
    for (const it of items) {
      const inv = stockByProduct.get(it.product_id);
      if (!inv || Number(inv.quantity_in_stock) < it.quantity) {
        toast.error(`Only ${Number(inv?.quantity_in_stock ?? 0)} in source for ${inv?.products?.name || 'item'}.`);
        return;
      }
    }

    try {
      const res = await create.mutateAsync({
        fromBranchId, toBranchId, transferDate, notes: notes || undefined, items,
      });
      toast.success('Stock transfer recorded successfully');
      setIsPreviewOpen(false);
      navigate('/transfers');
    } catch (err: any) {
      toast.error(err.message || 'Failed to record stock transfer');
    }
  };

  return (
    <PageShell width="wide">
      <PageHeader
        title="New stock transfer"
        eyebrow="Stock Transfers"
        onBack={() => navigate('/transfers')}
      />

      <div className="mt-4 grid gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 grid gap-3 sm:grid-cols-3">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">From branch</label>
            <Select value={fromBranchId} onChange={(e) => { setFromBranchId(e.target.value); setRows([{ product_id: '', quantity: '' }]); }} options={branchOptions} />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">To branch</label>
            <Select value={toBranchId} onChange={(e) => setToBranchId(e.target.value)} options={[{ value: '', label: 'Choose…' }, ...toBranchOptions]} />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Date</label>
            <Input type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} max={getLocalDateString()} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2">
            <div className="text-sm font-black text-slate-800">Items to transfer</div>
            <Button variant="ghost" size="sm" onClick={() => setRows((prev) => [...prev, { product_id: '', quantity: '' }])} leftIcon={<Plus className="w-4 h-4" />}>Add row</Button>
          </div>
          <div className="divide-y divide-slate-100">
            {rows.map((r, i) => {
              const inv = r.product_id ? stockByProduct.get(r.product_id) : null;
              const available = inv ? Number(inv.quantity_in_stock) : 0;
              const overLimit = Number(r.quantity || 0) > available;
              return (
                <div key={i} className="grid grid-cols-[1fr_110px_36px] gap-2 items-start p-3">
                  <div>
                    <Select
                      value={r.product_id}
                      onChange={(e) => updateRow(i, { product_id: e.target.value })}
                      options={[{ value: '', label: 'Pick a product…' }, ...productOptions]}
                    />
                    {inv && (
                      <div className="mt-1 text-[11px] text-slate-500">Available: {available} {inv.products?.unit || 'units'}</div>
                    )}
                  </div>
                  <div>
                    <Input
                      type="number" step="0.01" min={0} max={available || undefined}
                      value={r.quantity}
                      onChange={(e) => updateRow(i, { quantity: e.target.value })}
                      placeholder="Qty"
                    />
                    {overLimit && <div className="mt-1 text-[11px] font-semibold text-rose-600">Over available</div>}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    disabled={rows.length === 1}
                    className="mt-2 inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
                    aria-label="Remove row"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Notes (optional)</label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Vehicle no, courier, reason…" />
        </div>

        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm text-slate-700 flex items-center gap-3">
          <ArrowLeftRight className="w-4 h-4 text-sky-500" />
          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate('/transfers')}
              disabled={create.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleTransferPreview}
              disabled={!isValid || create.isPending}
            >
              Review Transfer
            </Button>
          </div>
        </div>
      </div>
      
      <TransferPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        onConfirm={handleConfirmTransfer}
        isSubmitting={create.isPending}
        data={previewData}
      />
    </PageShell>
  );
};

export default NewTransferPage;
