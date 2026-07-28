import React, { useState } from 'react';
import { Search, Trash2 } from 'lucide-react';
import { Modal, Button, Input } from '@/components/ui';
import { useFarmers } from '@/features/farmers/hooks/useFarmers';
import CollectPaymentModal from '@/features/farmers/components/CollectPaymentModal';
import { formatCurrency, getLocalDateString, sanitizeSearchTerm } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useBranchStore } from '@/stores/branchStore';
import { useCreateFarmerReturn, useFarmerReturnPreview } from '../hooks/useBillReturns';
import { ReturnReview } from '../pages/ReturnsListPage';
import type { FarmerReturnItemInput, FarmerReturnPreview } from '../services/billReturnsService';

interface FarmerActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'payment' | 'return';
}

interface ProductOption { id: string; name: string; type: string | null; default_price: number | null; }
interface DraftItem extends FarmerReturnItemInput { name: string; }

const initialStartDate = () => { const date = new Date(); date.setDate(date.getDate() - 30); return date.toISOString().slice(0, 10); };

// Reuses the same farmer list + CollectPaymentModal/return preview & create hooks the
// Farmer/Returns pages use, so this stays in sync with those features instead of
// re-implementing them. The return flow runs fully inline so the dealer never leaves billing.
export const FarmerActionModal: React.FC<FarmerActionModalProps> = ({ isOpen, onClose, mode }) => {
  const dealer = useAuthStore((state) => state.user);
  const activeBranch = useBranchStore((state) => state.activeBranch);
  const isAllBranches = useBranchStore((state) => state.isAllBranches);
  const { data: farmers = [] } = useFarmers();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCollectOpen, setIsCollectOpen] = useState(false);

  // Return-flow state
  const [productSearch, setProductSearch] = useState('');
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(getLocalDateString);
  const [returnDate, setReturnDate] = useState(getLocalDateString);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<DraftItem[]>([]);
  const [preview, setPreview] = useState<FarmerReturnPreview | null>(null);
  const [settlementMethod, setSettlementMethod] = useState<'farmer_credit' | 'cash_refund'>('farmer_credit');
  const previewMutation = useFarmerReturnPreview();
  const createMutation = useCreateFarmerReturn();

  const matches = search.trim()
    ? farmers.filter((f) => {
        const q = search.trim().toLowerCase();
        return f.name.toLowerCase().includes(q) || f.phone?.includes(search) || f.village?.toLowerCase().includes(q);
      }).slice(0, 20)
    : farmers.slice(0, 20);

  const selectedFarmer = farmers.find((f) => f.id === selectedId) || null;

  const reset = () => {
    setSearch('');
    setSelectedId(null);
    setIsCollectOpen(false);
    setProductSearch('');
    setStartDate(initialStartDate());
    setEndDate(getLocalDateString());
    setReturnDate(getLocalDateString());
    setNotes('');
    setItems([]);
    setPreview(null);
    setSettlementMethod('farmer_credit');
  };

  const closeAll = () => { onClose(); reset(); };

  const handleSelect = (farmerId: string) => {
    setSelectedId(farmerId);
    if (mode === 'payment') setIsCollectOpen(true);
  };

  const addProduct = (product: ProductOption) => {
    setItems((current) => current.some((item) => item.product_id === product.id) ? current : [...current, { product_id: product.id, name: product.name, quantity: 1, unmatched_unit_price: Number(product.default_price || 0) }]);
    setProductSearch(''); setPreview(null);
  };
  const updateItem = (productId: string, field: 'quantity' | 'unmatched_unit_price', value: string) => {
    setItems((current) => current.map((item) => item.product_id === productId ? { ...item, [field]: Math.max(0, Number(value) || 0) } : item));
    setPreview(null);
  };
  const requestPreview = async () => {
    if (!selectedFarmer || !startDate || !endDate || items.length === 0) return;
    const result = await previewMutation.mutateAsync({ farmerId: selectedFarmer.id, startDate, endDate, items });
    setPreview(result);
  };
  const confirmReturn = async () => {
    if (!selectedFarmer || !preview || !activeBranch?.id) return;
    await createMutation.mutateAsync({ farmerId: selectedFarmer.id, branchId: activeBranch.id, startDate, endDate, returnDate, notes, settlementMethod, items, expectedPreview: preview });
    closeAll();
  };

  return (
    <>
      <Modal
        isOpen={isOpen && !isCollectOpen}
        onClose={closeAll}
        title={mode === 'payment' ? 'Collect Payment' : preview ? 'Review farmer return' : 'Record Return'}
        contentClassName={mode === 'return' ? 'max-w-2xl' : 'max-w-lg'}
        footerButtons={mode === 'return' && selectedFarmer ? (
          preview
            ? [
                { label: 'Back to edit', variant: 'ghost', onClick: () => setPreview(null), disabled: createMutation.isPending },
                { label: createMutation.isPending ? 'Recording…' : `Confirm ${formatCurrency(preview.total_amount)}`, variant: 'primary', onClick: confirmReturn, disabled: createMutation.isPending || !activeBranch || isAllBranches, loading: createMutation.isPending },
              ]
            : [
                { label: previewMutation.isPending ? 'Preparing review…' : 'Review return', variant: 'primary', onClick: requestPreview, disabled: !startDate || !endDate || items.length === 0 || previewMutation.isPending || isAllBranches, loading: previewMutation.isPending },
              ]
        ) : undefined}
      >
        <div className="grid gap-3">
          {!selectedFarmer ? (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search farmer by name, phone, or village"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </div>
              <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200">
                {matches.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm font-semibold text-slate-500">No farmers found.</div>
                ) : (
                  matches.map((farmer) => (
                    <button
                      key={farmer.id}
                      type="button"
                      onClick={() => handleSelect(farmer.id)}
                      className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5 text-left last:border-0 hover:bg-slate-50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-slate-900">{farmer.name}</span>
                        <span className="block truncate text-xs text-slate-500">{farmer.village || farmer.phone || 'Farmer'}</span>
                      </span>
                      <span className="shrink-0 text-xs font-bold text-amber-700">{formatCurrency(farmer.total_due)} due</span>
                    </button>
                  ))
                )}
              </div>
            </>
          ) : mode === 'return' ? (
            preview ? (
              <ReturnReview preview={preview} receivingBranch={activeBranch?.name || 'No branch selected'} settlementMethod={settlementMethod} setSettlementMethod={setSettlementMethod} />
            ) : (
              <ReturnBuilder
                farmerName={selectedFarmer.name}
                onChangeFarmer={() => { setSelectedId(null); setPreview(null); }}
                isAllBranches={isAllBranches}
                startDate={startDate} endDate={endDate} returnDate={returnDate} notes={notes}
                setStartDate={(v) => { setStartDate(v); setPreview(null); }}
                setEndDate={(v) => { setEndDate(v); setPreview(null); }}
                setReturnDate={setReturnDate}
                setNotes={setNotes}
                productSearch={productSearch} setProductSearch={setProductSearch}
                dealerId={dealer?.id || ''}
                items={items} addProduct={addProduct} updateItem={updateItem}
                removeItem={(productId) => { setItems((c) => c.filter((i) => i.product_id !== productId)); setPreview(null); }}
              />
            )
          ) : null}
        </div>
      </Modal>

      {selectedFarmer ? (
        <CollectPaymentModal
          isOpen={isCollectOpen}
          onClose={closeAll}
          farmerId={selectedFarmer.id}
          farmerName={selectedFarmer.name}
          totalDue={selectedFarmer.total_due}
        />
      ) : null}
    </>
  );
};

// Product search + item builder for the inline return flow. Split out only to keep the
// parent's JSX readable — always rendered from FarmerActionModal with a farmer already picked.
const ReturnBuilder: React.FC<{
  farmerName: string;
  onChangeFarmer: () => void;
  isAllBranches: boolean;
  startDate: string; endDate: string; returnDate: string; notes: string;
  setStartDate: (v: string) => void; setEndDate: (v: string) => void; setReturnDate: (v: string) => void; setNotes: (v: string) => void;
  productSearch: string; setProductSearch: (v: string) => void;
  dealerId: string;
  items: DraftItem[];
  addProduct: (p: ProductOption) => void;
  updateItem: (productId: string, field: 'quantity' | 'unmatched_unit_price', value: string) => void;
  removeItem: (productId: string) => void;
}> = ({ farmerName, onChangeFarmer, isAllBranches, startDate, endDate, returnDate, notes, setStartDate, setEndDate, setReturnDate, setNotes, productSearch, setProductSearch, dealerId, items, addProduct, updateItem, removeItem }) => {
  const [products, setProducts] = useState<ProductOption[]>([]);

  React.useEffect(() => {
    if (!dealerId) return;
    let cancelled = false;
    (async () => {
      let query = supabase.from('products').select('id, name, type, default_price').eq('dealer_id', dealerId).eq('is_active', true).order('name').limit(30);
      const term = sanitizeSearchTerm(productSearch.trim());
      if (term) query = query.ilike('name', `%${term}%`);
      const { data } = await query;
      if (!cancelled) setProducts((data ?? []) as ProductOption[]);
    })();
    return () => { cancelled = true; };
  }, [dealerId, productSearch]);

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950">
        <span><span className="font-bold">Farmer:</span> {farmerName}</span>
        <Button size="sm" variant="ghost" onClick={onChangeFarmer}>Change farmer</Button>
      </div>
      {isAllBranches && <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Choose a receiving branch before recording a return.</div>}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div><label className="text-xs font-bold uppercase tracking-wider text-slate-500">Bills from</label><Input type="date" value={startDate} max={endDate} onChange={(e) => setStartDate(e.target.value)} /></div>
        <div><label className="text-xs font-bold uppercase tracking-wider text-slate-500">Bills to</label><Input type="date" value={endDate} min={startDate} max={getLocalDateString()} onChange={(e) => setEndDate(e.target.value)} /></div>
        <div><label className="text-xs font-bold uppercase tracking-wider text-slate-500">Return date</label><Input type="date" value={returnDate} max={getLocalDateString()} onChange={(e) => setReturnDate(e.target.value)} /></div>
      </section>
      <section>
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Returned products</label>
        <div className="mt-2 rounded-xl border border-slate-200 p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Search products to add" className="pl-9" />
          </div>
          {productSearch && (
            <div className="mt-2 max-h-32 overflow-auto">
              {products.map((product) => (
                <button key={product.id} type="button" onClick={() => addProduct(product)} className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-sky-50">
                  <span className="font-semibold">{product.name}</span>
                  <span className="ml-2 text-xs text-slate-500">{product.type}</span>
                </button>
              ))}
            </div>
          )}
          <div className="mt-3 divide-y divide-slate-100">
            {items.map((item) => (
              <div key={item.product_id} className="grid grid-cols-[1fr_90px_110px_32px] items-center gap-2 py-2">
                <span className="font-semibold text-slate-800">{item.name}</span>
                <Input type="number" min="0.01" step="0.01" value={item.quantity || ''} onChange={(e) => updateItem(item.product_id, 'quantity', e.target.value)} placeholder="Qty" />
                <Input type="number" min="0" step="0.01" value={item.unmatched_unit_price || ''} onChange={(e) => updateItem(item.product_id, 'unmatched_unit_price', e.target.value)} placeholder="Unmatched price" />
                <button type="button" aria-label={`Remove ${item.name}`} onClick={() => removeItem(item.product_id)} className="text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
            {items.length === 0 && <div className="py-5 text-center text-sm text-slate-500">Add one or more catalog products.</div>}
          </div>
          <p className="mt-2 text-xs text-slate-500">The unmatched price is used only for quantity not found in the selected bills.</p>
        </div>
      </section>
      <section><label className="text-xs font-bold uppercase tracking-wider text-slate-500">Note</label><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reason for return (optional)" /></section>
    </div>
  );
};

export default FarmerActionModal;
