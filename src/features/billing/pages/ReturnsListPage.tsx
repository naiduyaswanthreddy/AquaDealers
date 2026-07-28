import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ChevronLeft, ClipboardCheck, Plus, Search, Trash2, Undo2 } from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Input, Modal, Skeleton } from '@/components/ui';
import { formatCurrency, formatDate, getLocalDateString, sanitizeSearchTerm } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useBranchStore } from '@/stores/branchStore';
import { useCreateFarmerReturn, useFarmerReturnPreview, useReplaceFarmerReturn } from '../hooks/useBillReturns';
import { getFarmerReturnDetail, type FarmerReturnDetail, type FarmerReturnItemInput, type FarmerReturnPreview } from '../services/billReturnsService';

interface ReturnRow { id: string; return_number: string | null; return_date: string; total_amount: number; notes: string | null; branch_name_snapshot: string | null; created_at: string; bill_id: string | null; farmers: { name: string } | null; }
interface FarmerOption { id: string; name: string; phone: string | null; village: string | null; total_due: number; }
interface ProductOption { id: string; name: string; type: string | null; default_price: number | null; }
interface DraftItem extends FarmerReturnItemInput { name: string; }
interface ReturnContext { farmer?: FarmerOption; billDate?: string; items?: DraftItem[]; }

const initialStartDate = () => { const date = new Date(); date.setDate(date.getDate() - 30); return date.toISOString().slice(0, 10); };

export const ReturnsListPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dealer = useAuthStore((state) => state.user);
  const activeBranch = useBranchStore((state) => state.activeBranch);
  const isAllBranches = useBranchStore((state) => state.isAllBranches);
  const [isOpen, setIsOpen] = useState(false);
  const [farmerSearch, setFarmerSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [farmer, setFarmer] = useState<FarmerOption | null>(null);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(getLocalDateString);
  const [returnDate, setReturnDate] = useState(getLocalDateString);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<DraftItem[]>([]);
  const [preview, setPreview] = useState<FarmerReturnPreview | null>(null);
  const [settlementMethod, setSettlementMethod] = useState<'farmer_credit' | 'cash_refund'>('farmer_credit');
  const [selectedReturnId, setSelectedReturnId] = useState<string | null>(null);
  const [editingReturn, setEditingReturn] = useState<FarmerReturnDetail | null>(null);
  const previewMutation = useFarmerReturnPreview();
  const createMutation = useCreateFarmerReturn();
  const replaceMutation = useReplaceFarmerReturn();

  const { data: selectedReturn, isLoading: isLoadingReturn } = useQuery({
    queryKey: ['farmer-return-detail', selectedReturnId],
    queryFn: () => getFarmerReturnDetail(selectedReturnId!),
    enabled: !!selectedReturnId,
  });

  React.useEffect(() => {
    const context = (location.state as { returnContext?: ReturnContext } | null)?.returnContext;
    if (!context) return;
    if (context.farmer?.id) setFarmer(context.farmer);
    if (context.billDate) { setStartDate(context.billDate); setEndDate(context.billDate); }
    if (context.items?.length) setItems(context.items.filter((item) => !!item.product_id));
    setIsOpen(true);
    window.history.replaceState({}, document.title, location.pathname);
  }, [location.pathname, location.state]);

  const { data: rows = [], isLoading } = useQuery<ReturnRow[]>({
    queryKey: ['bill-returns-list', dealer?.id], enabled: !!dealer?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from('bill_returns').select('id, return_number, return_date, total_amount, notes, branch_name_snapshot, created_at, bill_id, farmers(name)').order('return_date', { ascending: false }).order('created_at', { ascending: false }).limit(200);
      if (error) throw error; return (data ?? []) as unknown as ReturnRow[];
    },
  });
  const { data: farmers = [] } = useQuery<FarmerOption[]>({
    queryKey: ['farmer-return-picker', dealer?.id, farmerSearch], enabled: isOpen && !!dealer?.id,
    queryFn: async () => {
      let query = supabase.from('farmers').select('id, name, phone, village, total_due').eq('dealer_id', dealer!.id).eq('is_active', true).order('name').limit(30);
      const term = sanitizeSearchTerm(farmerSearch.trim()); if (term) query = query.or(`name.ilike.%${term}%,phone.ilike.%${term}%,village.ilike.%${term}%`);
      const { data, error } = await query; if (error) throw error; return (data ?? []) as FarmerOption[];
    },
  });
  const { data: products = [] } = useQuery<ProductOption[]>({
    queryKey: ['farmer-return-products', dealer?.id, productSearch], enabled: isOpen && !!dealer?.id,
    queryFn: async () => {
      let query = supabase.from('products').select('id, name, type, default_price').eq('dealer_id', dealer!.id).eq('is_active', true).order('name').limit(30);
      const term = sanitizeSearchTerm(productSearch.trim()); if (term) query = query.ilike('name', `%${term}%`);
      const { data, error } = await query; if (error) throw error; return (data ?? []) as ProductOption[];
    },
  });

  const total = useMemo(() => rows.reduce((sum, row) => sum + Number(row.total_amount || 0), 0), [rows]);
  const reset = () => { setIsOpen(false); setEditingReturn(null); setFarmer(null); setFarmerSearch(''); setProductSearch(''); setItems([]); setPreview(null); setNotes(''); setStartDate(initialStartDate()); setEndDate(getLocalDateString()); setReturnDate(getLocalDateString()); setSettlementMethod('farmer_credit'); };
  const addProduct = (product: ProductOption) => {
    setItems((current) => current.some((item) => item.product_id === product.id) ? current : [...current, { product_id: product.id, name: product.name, quantity: 1, unmatched_unit_price: Number(product.default_price || 0) }]);
    setProductSearch(''); setPreview(null);
  };
  const updateItem = (productId: string, field: 'quantity' | 'unmatched_unit_price', value: string) => { setItems((current) => current.map((item) => item.product_id === productId ? { ...item, [field]: Math.max(0, Number(value) || 0) } : item)); setPreview(null); };
  const requestPreview = async () => {
    if (!farmer || !startDate || !endDate || items.length === 0) return;
    const result = await previewMutation.mutateAsync({ farmerId: farmer.id, startDate, endDate, items }); setPreview(result);
  };
  const confirm = async () => {
    if (!farmer || !preview) return;
    const payload = { farmerId: farmer.id, branchId: editingReturn?.branchId || activeBranch?.id || '', startDate, endDate, returnDate, notes, settlementMethod, items, expectedPreview: preview };
    if (!payload.branchId) return;
    if (editingReturn?.eventId) await replaceMutation.mutateAsync({ ...payload, eventId: editingReturn.eventId });
    else await createMutation.mutateAsync(payload);
    reset();
  };
  const startEditing = (detail: FarmerReturnDetail) => {
    if (!detail.eventId) return;
    setEditingReturn(detail);
    setFarmer({ id: detail.farmerId, name: detail.farmerName, phone: null, village: null, total_due: 0 });
    setStartDate(detail.startDate); setEndDate(detail.endDate); setReturnDate(detail.returnDate);
    setNotes(detail.notes || ''); setSettlementMethod(detail.settlementMethod); setItems(detail.items);
    setPreview(null); setSelectedReturnId(null); setIsOpen(true);
  };

  return <PageShell width="wide">
    <PageHeader title="Returns" description={`${rows.length} returns · ${formatCurrency(total)} recorded`} onBack={() => navigate('/more')} action={<Button onClick={() => setIsOpen(true)} leftIcon={<Plus className="w-4 h-4" />}>New return</Button>} />
    {isLoading ? <div className="mt-4 space-y-2">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-20 w-full rounded-xl" />)}</div> : rows.length === 0 ? <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center"><Undo2 className="mx-auto h-8 w-8 text-slate-400" /><div className="mt-3 text-sm font-bold text-slate-700">No returns yet</div><Button className="mt-4" onClick={() => setIsOpen(true)}>Record a farmer return</Button></div> : <div className="mt-4 grid gap-2">{rows.map((row) => <button key={row.id} onClick={() => setSelectedReturnId(row.id)} className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm"><div className="flex justify-between"><span className="font-black text-slate-900">{row.return_number}</span><span className="font-black text-emerald-700">− {formatCurrency(Number(row.total_amount))}</span></div><div className="mt-1 flex items-center gap-2 text-xs text-slate-500"><span>{formatDate(row.return_date)}</span><ArrowRight className="h-3 w-3" /><span>{row.farmers?.name || 'Farmer return'}</span>{row.branch_name_snapshot && <span>· {row.branch_name_snapshot}</span>}</div>{row.notes && <div className="mt-1 truncate text-xs text-slate-500">{row.notes}</div>}</button>)}</div>}

    <Modal isOpen={isOpen} onClose={reset} title={preview ? 'Review farmer return' : 'New farmer return'} contentClassName="max-w-4xl" footerButtons={preview ? [{ label: 'Back to edit', variant: 'ghost', onClick: () => setPreview(null), disabled: createMutation.isPending }, { label: createMutation.isPending ? 'Recording…' : `Confirm ${formatCurrency(preview.total_amount)}`, variant: 'primary', onClick: confirm, disabled: createMutation.isPending || !activeBranch || isAllBranches, loading: createMutation.isPending }] : [{ label: previewMutation.isPending ? 'Preparing review…' : 'Review return', variant: 'primary', onClick: requestPreview, disabled: !farmer || !startDate || !endDate || items.length === 0 || previewMutation.isPending || isAllBranches, loading: previewMutation.isPending }]}>
      {isAllBranches && !editingReturn && <div className="mb-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Choose a receiving branch before recording a return.</div>}
      {!preview ? <div className="grid gap-5">
        {farmer ? <div className="flex items-center justify-between rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950"><span><span className="font-bold">Selected farmer:</span> {farmer.name}{farmer.phone ? ` (${farmer.phone})` : ''}</span><Button size="sm" variant="ghost" onClick={() => { setFarmer(null); setFarmerSearch(''); setPreview(null); }}>Change farmer</Button></div> : <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">Select a farmer to continue. Your selected farmer is shown here before you review the return.</div>}
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700"><span className="font-bold">Product fields:</span> enter the return quantity first. The “Unmatched price” is a fallback per-unit value used only when that quantity is absent from every selected bill; matched quantities use their original bill price automatically.</div>
        <section><label className="text-xs font-bold uppercase tracking-wider text-slate-500">1. Farmer</label><div className="mt-2 rounded-xl border border-slate-200 p-3"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={farmerSearch} onChange={(event) => setFarmerSearch(event.target.value)} placeholder="Search farmer name, phone, or village" className="pl-9" /></div><div className="mt-2 max-h-36 overflow-auto">{farmers.map((option) => <button type="button" key={option.id} onClick={() => { setFarmer(option); setPreview(null); }} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-sky-50 ${farmer?.id === option.id ? 'bg-sky-50 ring-1 ring-sky-300' : ''}`}><span className="font-semibold">{option.name}<span className="ml-2 text-xs font-normal text-slate-500">{[option.phone, option.village].filter(Boolean).join(' · ')}</span></span><span className="text-xs text-amber-700">Due {formatCurrency(Number(option.total_due))}</span></button>)}</div></div></section>
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3"><div><label className="text-xs font-bold uppercase tracking-wider text-slate-500">Bills from</label><Input type="date" value={startDate} max={endDate} onChange={(event) => { setStartDate(event.target.value); setPreview(null); }} /></div><div><label className="text-xs font-bold uppercase tracking-wider text-slate-500">Bills to</label><Input type="date" value={endDate} min={startDate} max={getLocalDateString()} onChange={(event) => { setEndDate(event.target.value); setPreview(null); }} /></div><div><label className="text-xs font-bold uppercase tracking-wider text-slate-500">Return date</label><Input type="date" value={returnDate} max={getLocalDateString()} onChange={(event) => setReturnDate(event.target.value)} /></div></section>
        <section><label className="text-xs font-bold uppercase tracking-wider text-slate-500">2. Returned products</label><div className="mt-2 rounded-xl border border-slate-200 p-3"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Search products to add" className="pl-9" /></div>{productSearch && <div className="mt-2 max-h-32 overflow-auto">{products.map((product) => <button key={product.id} type="button" onClick={() => addProduct(product)} className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-sky-50"><span className="font-semibold">{product.name}</span><span className="ml-2 text-xs text-slate-500">{product.type}</span></button>)}</div>}<div className="mt-3 divide-y divide-slate-100">{items.map((item) => <div key={item.product_id} className="grid grid-cols-[1fr_90px_110px_32px] items-center gap-2 py-2"><span className="font-semibold text-slate-800">{item.name}</span><Input type="number" min="0.01" step="0.01" value={item.quantity || ''} onChange={(event) => updateItem(item.product_id, 'quantity', event.target.value)} placeholder="Qty" /><Input type="number" min="0" step="0.01" value={item.unmatched_unit_price || ''} onChange={(event) => updateItem(item.product_id, 'unmatched_unit_price', event.target.value)} placeholder="Unmatched price" /><button type="button" aria-label={`Remove ${item.name}`} onClick={() => { setItems((current) => current.filter((entry) => entry.product_id !== item.product_id)); setPreview(null); }} className="text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></div>)}{items.length === 0 && <div className="py-5 text-center text-sm text-slate-500">Add one or more catalog products.</div>}</div><p className="mt-2 text-xs text-slate-500">The unmatched price is used only for quantity not found in the selected bills.</p></div></section>
        <section><label className="text-xs font-bold uppercase tracking-wider text-slate-500">Note</label><Input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Reason for return (optional)" /></section>
      </div> : <ReturnReview preview={preview} receivingBranch={activeBranch?.name || 'No branch selected'} settlementMethod={settlementMethod} setSettlementMethod={setSettlementMethod} />}
    </Modal>
    <Modal isOpen={!!selectedReturnId} onClose={() => setSelectedReturnId(null)} title={selectedReturn?.returnNumber || 'Return details'} contentClassName="max-w-xl" footerButtons={selectedReturn?.eventId ? [{ label: 'Edit return', variant: 'primary', onClick: () => startEditing(selectedReturn) }] : undefined}>
      {isLoadingReturn ? <Skeleton className="h-48 w-full rounded-xl" /> : selectedReturn ? <div className="grid gap-4 text-sm"><div className="rounded-xl bg-sky-50 p-3 text-sky-950"><div className="font-black">{selectedReturn.farmerName}</div><div className="mt-1 text-xs">Returned on {formatDate(selectedReturn.returnDate)} · Bills from {formatDate(selectedReturn.startDate)} to {formatDate(selectedReturn.endDate)}</div></div><div className="rounded-xl border border-slate-200"><div className="grid grid-cols-[1fr_5rem_6rem] gap-2 bg-slate-50 px-3 py-2 text-[10px] font-black uppercase text-slate-500"><span>Returned item</span><span className="text-right">Qty</span><span className="text-right">Fallback price</span></div>{selectedReturn.items.map((item) => <div key={item.product_id} className="grid grid-cols-[1fr_5rem_6rem] gap-2 border-t border-slate-100 px-3 py-2"><span className="font-semibold text-slate-800">{item.name}</span><span className="text-right">{item.quantity}</span><span className="text-right">{formatCurrency(item.unmatched_unit_price)}</span></div>)}</div>{selectedReturn.notes && <div className="rounded-xl border border-slate-200 p-3"><div className="text-xs font-black uppercase text-slate-500">Note</div><div className="mt-1 text-slate-700">{selectedReturn.notes}</div></div>}<div className="flex justify-between rounded-xl bg-slate-900 p-3 font-black text-white"><span>Total returned value</span><span>{formatCurrency(selectedReturn.totalAmount)}</span></div>{!selectedReturn.eventId && <p className="text-xs text-slate-500">This return can no longer be edited because its safe undo window has closed or a later transaction depends on it.</p>}</div> : <div className="text-sm text-slate-500">Return details are unavailable.</div>}
    </Modal>
  </PageShell>;
};

const ReturnReview: React.FC<{ preview: FarmerReturnPreview; receivingBranch: string; settlementMethod: 'farmer_credit' | 'cash_refund'; setSettlementMethod: (method: 'farmer_credit' | 'cash_refund') => void }> = ({ preview, receivingBranch, settlementMethod, setSettlementMethod }) => <div className="grid gap-4 text-sm">
  <div className="rounded-xl border border-sky-200 bg-sky-50 p-3"><div className="font-black text-sky-950">{preview.farmer_name} · {formatDate(preview.start_date)} to {formatDate(preview.end_date)}</div><div className="mt-1 text-xs text-sky-800">Stock will be received into {receivingBranch}.</div></div>
  {preview.lines.map((line) => <section key={line.product_id} className="overflow-hidden rounded-xl border border-slate-200"><div className="flex flex-wrap justify-between gap-2 bg-slate-50 px-3 py-2"><div><span className="font-black text-slate-900">{line.product_name}</span><span className="ml-2 text-xs text-slate-500">Requested {line.quantity} · Matched {line.matched_quantity} · Unmatched {line.unmatched_quantity}</span></div><span className="font-black text-slate-900">{formatCurrency(line.total_amount)}</span></div>{line.allocations.length > 0 && <div className="overflow-x-auto"><table className="min-w-full text-xs"><thead className="bg-white text-left uppercase tracking-wider text-slate-500"><tr><th className="px-3 py-2">Bill</th><th className="px-3 py-2">Branch</th><th className="px-3 py-2 text-right">Qty × price</th><th className="px-3 py-2 text-right">Return value</th><th className="px-3 py-2 text-right">Bill due before → after</th></tr></thead><tbody>{line.allocations.map((allocation) => <tr key={allocation.bill_item_id} className="border-t border-slate-100"><td className="px-3 py-2 font-semibold">{allocation.bill_number}<div className="font-normal text-slate-500">{formatDate(allocation.bill_date)}</div></td><td className="px-3 py-2">{allocation.branch_name || '—'}</td><td className="px-3 py-2 text-right">{allocation.quantity} × {formatCurrency(allocation.unit_price)}</td><td className="px-3 py-2 text-right font-semibold">{formatCurrency(allocation.total_amount)}</td><td className="px-3 py-2 text-right">{formatCurrency(allocation.balance_before)} → {formatCurrency(allocation.balance_after)}{allocation.settlement_amount > 0 && <div className="text-amber-700">Extra {formatCurrency(allocation.settlement_amount)}</div>}</td></tr>)}</tbody></table></div>}{line.unmatched_quantity > 0 && <div className="border-t border-amber-100 bg-amber-50 px-3 py-2 text-amber-900"><b>Unmatched:</b> {line.unmatched_quantity} × {formatCurrency(line.unmatched_unit_price)} = {formatCurrency(line.unmatched_quantity * line.unmatched_unit_price)}. This is not present in the selected bills.</div>}</section>)}
  <section className="rounded-xl border border-slate-200 p-3"><h3 className="font-black text-slate-900">Account settlement</h3><div className="mt-2 grid gap-1 text-slate-700"><div className="flex justify-between"><span>Opening balance</span><span>{formatCurrency(preview.opening_balance_before)} → {formatCurrency(preview.opening_balance_after)}</span></div><div className="flex justify-between text-emerald-700"><span>Reduced from bill dues</span><span>− {formatCurrency(preview.bill_balance_reduction)}</span></div><div className="flex justify-between text-emerald-700"><span>Reduced from opening balance</span><span>− {formatCurrency(preview.opening_balance_reduction)}</span></div><div className="flex justify-between"><span>Farmer due before</span><span>{formatCurrency(preview.farmer_due_before)}</span></div><div className="flex justify-between font-black"><span>Farmer due after settlement</span><span>{formatCurrency(settlementMethod === 'farmer_credit' ? preview.farmer_due_after_credit : preview.farmer_due_after_cash_refund)}</span></div></div>{preview.settlement_amount > 0 && <div className="mt-3 border-t pt-3"><div className="font-bold text-slate-800">Extra to settle: {formatCurrency(preview.settlement_amount)}</div><div className="mt-2 flex gap-2"><Button size="sm" variant={settlementMethod === 'farmer_credit' ? 'primary' : 'outline'} onClick={() => setSettlementMethod('farmer_credit')}>Farmer credit</Button><Button size="sm" variant={settlementMethod === 'cash_refund' ? 'primary' : 'outline'} onClick={() => setSettlementMethod('cash_refund')}>Cash refund</Button></div><p className="mt-1 text-xs text-slate-500">{settlementMethod === 'farmer_credit' ? 'This amount is saved against the farmer account.' : 'This amount is recorded as a cash-book refund.'}</p></div>}</section>
  <div className="rounded-xl bg-slate-900 p-4 text-white"><div className="flex items-center gap-2 font-black"><ClipboardCheck className="h-5 w-5" /> Final confirmation</div><div className="mt-2 grid grid-cols-2 gap-2 text-sm text-slate-200"><span>Items received</span><span className="text-right">{preview.lines.reduce((sum, line) => sum + Number(line.quantity), 0)}</span><span>Affected bills</span><span className="text-right">{new Set(preview.lines.flatMap((line) => line.allocations.map((allocation) => allocation.bill_id))).size}</span><span>Total return value</span><span className="text-right font-black text-white">{formatCurrency(preview.total_amount)}</span></div></div>
</div>;

export default ReturnsListPage;
