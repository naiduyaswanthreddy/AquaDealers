import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ChevronLeft, ChevronRight, FileText,
  Calendar, StickyNote, Percent, Check,
  Plus, Minus, X, ToggleLeft, ToggleRight, Tag,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useBranchStore } from '@/stores/branchStore';
import { PageHeader } from '@/components/layout/PageHeader';
import { SectionCard } from '@/components/layout/SectionCard';
import { Button } from '@/components/ui/Button';
import { formatCurrency, getLocalDateString } from '@/lib/utils';
import { EstimateItemPicker } from '../components/EstimateItemPicker';
import { useEstimateCartStore } from '../stores/estimateCartStore';
import { useCreateEstimate, useUpdateEstimate } from '../hooks/useEstimate';
import type { EstimatePayload } from '../types';

type Step = 'items' | 'review';

function QuantityInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [local, setLocal] = useState(String(value));
  useEffect(() => { setLocal(String(value)); }, [value]);
  return (
    <input
      type="text"
      inputMode="numeric"
      value={local}
      onChange={e => {
        setLocal(e.target.value);
        const v = parseInt(e.target.value, 10);
        if (v > 0) onChange(v);
      }}
      onBlur={() => {
        const v = parseInt(local, 10);
        if (!v || v < 1) { onChange(1); setLocal('1'); }
        else setLocal(String(v));
      }}
      className="w-7 text-center text-sm font-bold text-text-primary bg-transparent focus:outline-none tabular-nums"
    />
  );
}

export const NewEstimatePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { activeBranch } = useBranchStore();
  const { mutateAsync: createEstimate, isPending: isCreating } = useCreateEstimate();
  const { mutateAsync: updateEstimate, isPending: isUpdating } = useUpdateEstimate();
  const isPending = isCreating || isUpdating;

  const {
    farmerId, farmerName, items, gstEnabled,
    discountType, discountAmount, discountPercentage,
    notes, estimateDate, editingEstimateId,
    setNotes, setEstimateDate,
    setDiscountAmount, setDiscountPercentage, setDiscountType,
    setGstEnabled,
    updateQuantity, updateItemDiscount, updateItemPrice, removeItem,
    clearCart,
  } = useEstimateCartStore();

  const [step, setStep] = useState<Step>(editingEstimateId ? 'review' : 'items');

  const subtotalBeforeDiscount = useMemo(
    () => items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0),
    [items]
  );

  const resolvedDiscountAmount = useMemo(() => {
    if (discountType === 'percentage') {
      return Number(((subtotalBeforeDiscount * discountPercentage) / 100).toFixed(2));
    }
    return discountAmount;
  }, [discountType, discountAmount, discountPercentage, subtotalBeforeDiscount]);

  const totals = useMemo(() => {
    const subtotal = Math.max(0, subtotalBeforeDiscount - resolvedDiscountAmount);
    const gstAmount = gstEnabled
      ? items.reduce((sum, i) => sum + (i.unit_price * i.quantity * i.gst_rate) / 100, 0)
      : 0;
    const total = subtotal + gstAmount;
    return { subtotalBeforeDiscount, subtotal, gstAmount, total };
  }, [items, gstEnabled, subtotalBeforeDiscount, resolvedDiscountAmount]);

  const handleSubmit = async () => {
    if (!user?.id || !farmerId) return;

    const payload: EstimatePayload = {
      dealer_id:            user.id,
      branch_id:            activeBranch?.id ?? null,
      farmer_id:            farmerId,
      farmer_name_snapshot: farmerName,
      branch_name_snapshot: activeBranch?.name ?? null,
      estimate_date:        estimateDate || getLocalDateString(),
      subtotal:             totals.subtotal,
      gst_amount:           totals.gstAmount,
      discount_amount:      resolvedDiscountAmount,
      total:                totals.total,
      notes:                notes || null,
      items: items.map(i => ({
        product_id:          i.product_id,
        product_name:        i.product_name,
        hsn_code:            i.hsn_code,
        quantity:            i.quantity,
        unit_price:          i.unit_price,
        discount_percentage: i.discount_percentage,
        gst_rate:            gstEnabled ? i.gst_rate : 0,
        total_price:         Number((i.unit_price * i.quantity).toFixed(2)),
      })),
    };

    try {
      if (editingEstimateId) {
        await updateEstimate({ estimateId: editingEstimateId, payload });
        clearCart();
        toast.success('Estimate updated!');
        navigate(`/estimates/${editingEstimateId}`);
      } else {
        const result = await createEstimate(payload);
        clearCart();
        toast.success(`Estimate ${result.estimate_number} saved!`);
        navigate(`/estimates/${result.estimate_id}`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save estimate.';
      toast.error(message);
    }
  };

  const canProceed = farmerId && items.length > 0;

  return (
    <div className="flex flex-col h-[100dvh] lg:h-full w-full bg-[var(--color-surface)]">

      {/* ── Fixed Header ──────────────────────────────────────────────────────── */}
      <div
        className="shrink-0 z-40 bg-[var(--color-surface)] w-full relative"
        style={{ paddingTop: 'var(--section-gap)', paddingInline: 'var(--page-gutter)' }}
      >
        <div className="absolute inset-0 z-0 bg-[var(--color-primary)]" style={{ bottom: '2rem' }} />

        {/* Step indicator */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
          <div className="flex items-center gap-2 pointer-events-auto lg:-ml-4">
            <div className="flex items-center gap-1.5">
              <div
                className="flex h-6 w-6 items-center justify-center rounded-full text-[0.7rem] font-bold transition-all"
                style={{
                  background: step === 'items' ? 'rgba(255,255,255,0.95)' : 'rgba(31,169,113,0.9)',
                  color: step === 'items' ? '#0052cc' : '#fff',
                }}
              >
                {step === 'items' ? '1' : <Check className="h-3 w-3" />}
              </div>
              <span className="text-xs font-bold hidden sm:inline-block" style={{ color: step === 'items' ? '#fff' : 'rgba(255,255,255,0.75)' }}>
                Items
              </span>
            </div>
            <div className="w-4 sm:w-8 h-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.3)' }} />
            <div className="flex items-center gap-1.5">
              <div
                className="flex h-6 w-6 items-center justify-center rounded-full text-[0.7rem] font-bold transition-all"
                style={{
                  background: step === 'review' ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.18)',
                  color: step === 'review' ? '#0052cc' : 'rgba(255,255,255,0.7)',
                  border: step === 'review' ? 'none' : '1.5px solid rgba(255,255,255,0.3)',
                }}
              >
                2
              </div>
              <span className="text-xs font-bold hidden sm:inline-block" style={{ color: step === 'review' ? '#fff' : 'rgba(255,255,255,0.55)' }}>
                Review
              </span>
            </div>
          </div>
        </div>

        <PageHeader
          className="relative z-10"
          title={editingEstimateId ? 'Edit Estimate' : 'New Estimate'}
          description={step === 'items' ? 'Select a farmer and add items to quote' : 'Edit items and options before saving'}
          onBack={() => editingEstimateId ? navigate(`/estimates/${editingEstimateId}`) : navigate('/estimates')}
        />
        <div className="absolute bottom-0 left-0 right-0 h-4 bg-[#e7f5ff] z-0" />
      </div>

      {/* ── Scrollable Body ───────────────────────────────────────────────────── */}
      <div className="flex-1 w-full overflow-y-auto bg-[#e7f5ff] relative z-10">
        <div className="w-full max-w-4xl mx-auto flex flex-col gap-4 px-4 pt-1 pb-8 lg:px-8 lg:pt-1 lg:pb-6">

          {/* ── Step 1: Items ── */}
          {step === 'items' && (
            <>
              <SectionCard title="Farmer & Items" className="!m-0 shadow-sm border-none">
                <EstimateItemPicker />
              </SectionCard>

              {items.length > 0 && (
                <div
                  className="rounded-2xl px-4 py-3 flex items-center justify-between shadow-sm"
                  style={{ background: 'linear-gradient(135deg, #fff, #f8faff)', border: '1px solid rgba(0,82,204,0.12)' }}
                >
                  <span className="text-sm font-semibold text-text-secondary">
                    {items.length} item{items.length > 1 ? 's' : ''} · Subtotal
                  </span>
                  <span className="text-base font-black text-primary tabular-nums">
                    {formatCurrency(totals.subtotalBeforeDiscount)}
                  </span>
                </div>
              )}
            </>
          )}

          {/* ── Step 2: Review ── */}
          {step === 'review' && (
            <>
              {/* Items card — fully editable */}
              <SectionCard
                title={farmerName ?? ''}
                description={`${items.length} item${items.length > 1 ? 's' : ''}`}
                className="p-0 overflow-hidden !m-0 shadow-sm border-none"
              >
                <div className="divide-y divide-border/40">
                  {items.map((item, idx) => {
                    const lineTotal = item.unit_price * item.quantity;
                    const mrpTotal = (item.mrp ?? 0) * item.quantity;
                    const baseTotal = item.base_unit_price * item.quantity;
                    const strikethrough = mrpTotal > lineTotal ? mrpTotal : baseTotal > lineTotal ? baseTotal : 0;
                    const hasDiscount = item.discount_percentage > 0;
                    const ACCENT_COLORS = ['#6366f1','#f59e0b','#10b981','#ef4444','#3b82f6','#ec4899','#8b5cf6','#14b8a6'];
                    const accentColor = ACCENT_COLORS[idx % ACCENT_COLORS.length];
                    return (
                      <div
                        key={item.product_id}
                        className="px-4 py-3.5 space-y-2.5"
                        style={{ borderLeft: `3px solid ${accentColor}` }}
                      >
                        {/* Row 1: name + total + remove */}
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-text-primary leading-snug truncate">
                              {item.product_name}
                            </p>
                            {item.unit && (
                              <p className="text-[10px] text-text-muted mt-0.5">{item.unit}</p>
                            )}
                          </div>
                          <div className="flex-shrink-0 text-right">
                            <p className="text-sm font-black text-text-primary tabular-nums">
                              {formatCurrency(lineTotal)}
                            </p>
                            {strikethrough > 0 && (
                              <p className="text-[10px] text-text-muted line-through tabular-nums">
                                {formatCurrency(strikethrough)}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeItem(item.product_id)}
                            className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full text-text-muted hover:bg-red-50 hover:text-red-500 transition-colors mt-0.5"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Row 2: qty stepper | price | disc % */}
                        <div className="flex items-center gap-2">
                          {/* Quantity stepper */}
                          <div className="flex items-center gap-0.5 rounded-xl border border-border bg-surface px-1 py-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => item.quantity > 1 && updateQuantity(item.product_id, item.quantity - 1)}
                              className="h-6 w-6 flex items-center justify-center rounded-lg text-text-secondary hover:bg-primary/10 hover:text-primary transition-colors disabled:opacity-30"
                              disabled={item.quantity <= 1}
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <QuantityInput
                              value={item.quantity}
                              onChange={v => updateQuantity(item.product_id, v)}
                            />
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                              className="h-6 w-6 flex items-center justify-center rounded-lg text-text-secondary hover:bg-primary/10 hover:text-primary transition-colors"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>

                          {/* Unit price */}
                          <label className="flex flex-col rounded-xl border border-border bg-surface px-2.5 py-1.5 cursor-text flex-1 min-w-0">
                            <span className="text-[9px] font-bold text-text-muted uppercase tracking-wide leading-none mb-0.5">Price</span>
                            <div className="flex items-center gap-0.5">
                              <span className="text-[10px] text-text-muted font-semibold">₹</span>
                              <input
                                type="number"
                                min={0}
                                step={0.01}
                                value={item.unit_price || ''}
                                onChange={e => updateItemPrice(item.product_id, Number(e.target.value) || 0)}
                                className="w-full text-sm font-bold text-text-primary bg-transparent focus:outline-none tabular-nums"
                              />
                            </div>
                          </label>

                          {/* Per-item discount % */}
                          <label className={`flex flex-col rounded-xl border px-2.5 py-1.5 cursor-text flex-1 min-w-0 transition-colors ${hasDiscount ? 'border-emerald-300 bg-emerald-50/60' : 'border-border bg-surface'}`}>
                            <span className={`text-[9px] font-bold uppercase tracking-wide leading-none mb-0.5 ${hasDiscount ? 'text-emerald-600' : 'text-text-muted'}`}>Disc %</span>
                            <div className="flex items-center gap-0.5">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step={0.5}
                                value={item.discount_percentage || ''}
                                onChange={e => updateItemDiscount(item.product_id, Number(e.target.value) || 0)}
                                className={`w-full text-sm font-bold bg-transparent focus:outline-none tabular-nums ${hasDiscount ? 'text-emerald-700' : 'text-text-primary'}`}
                              />
                              <span className={`text-[10px] font-semibold ${hasDiscount ? 'text-emerald-500' : 'text-text-muted'}`}>%</span>
                            </div>
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Totals */}
                {(() => {
                  const totalSavings = items.reduce((sum, i) => {
                    const mrp = (i.mrp ?? 0) * i.quantity;
                    const base = i.base_unit_price * i.quantity;
                    const line = i.unit_price * i.quantity;
                    const ref = mrp > line ? mrp : base > line ? base : line;
                    return sum + (ref - line);
                  }, 0) + resolvedDiscountAmount;
                  return (
                    <div className="px-5 pt-3 pb-4 border-t border-border/50 space-y-2">
                      <div className="flex justify-between text-sm text-text-secondary">
                        <span>Subtotal</span>
                        <span className="tabular-nums font-semibold">{formatCurrency(totals.subtotalBeforeDiscount)}</span>
                      </div>
                      {resolvedDiscountAmount > 0 && (
                        <div className="flex justify-between text-sm text-emerald-700 font-semibold">
                          <span>Overall Discount</span>
                          <span className="tabular-nums">−{formatCurrency(resolvedDiscountAmount)}</span>
                        </div>
                      )}
                      {totals.gstAmount > 0 && (
                        <div className="flex justify-between text-sm text-text-secondary">
                          <span>GST</span>
                          <span className="tabular-nums font-semibold">{formatCurrency(totals.gstAmount)}</span>
                        </div>
                      )}
                      <div
                        className="flex justify-between items-center rounded-xl px-4 py-3 mt-1"
                        style={{ background: 'linear-gradient(135deg,#0052cc,#3385ff)', boxShadow: '0 4px 14px rgba(0,82,204,0.22)' }}
                      >
                        <div>
                          <span className="text-sm font-bold text-white">Total</span>
                          {totalSavings > 0.01 && (
                            <p className="text-[10px] text-blue-200 font-semibold mt-0.5">
                              You save {formatCurrency(totalSavings)}
                            </p>
                          )}
                        </div>
                        <span className="text-lg font-black text-white tabular-nums">{formatCurrency(totals.total)}</span>
                      </div>
                    </div>
                  );
                })()}
              </SectionCard>

              {/* Options card */}
              <SectionCard title="Options" description="Adjust discount, GST, date and notes" className="p-0 overflow-hidden !m-0 shadow-sm border-none">
                <div className="divide-y divide-border/50">

                  {/* GST toggle */}
                  <button
                    type="button"
                    onClick={() => setGstEnabled(!gstEnabled)}
                    className="flex items-center gap-3 px-5 py-4 w-full text-left hover:bg-surface/60 transition-colors"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 flex-shrink-0">
                      <Tag className="h-4 w-4 text-violet-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-text-muted uppercase tracking-wide mb-0.5">GST</p>
                      <p className="text-sm font-semibold text-text-primary">
                        {gstEnabled ? 'Included in total' : 'Not applied'}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-violet-600">
                      {gstEnabled
                        ? <ToggleRight className="h-6 w-6" />
                        : <ToggleLeft className="h-6 w-6 text-text-muted" />}
                    </div>
                  </button>

                  {/* Overall discount */}
                  <div className="flex items-center gap-3 px-5 py-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 flex-shrink-0">
                      <Percent className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-text-muted uppercase tracking-wide mb-1.5">Overall Discount</p>
                      <div className="flex items-center gap-2">
                        {/* % / ₹ mode toggle */}
                        <div className="flex rounded-lg border border-border overflow-hidden text-xs font-bold">
                          <button
                            type="button"
                            onClick={() => setDiscountType('percentage')}
                            className={`px-2.5 py-1 transition-colors ${discountType === 'percentage' ? 'bg-emerald-600 text-white' : 'bg-white text-text-secondary hover:bg-surface'}`}
                          >
                            %
                          </button>
                          <button
                            type="button"
                            onClick={() => setDiscountType('amount')}
                            className={`px-2.5 py-1 transition-colors ${discountType === 'amount' ? 'bg-emerald-600 text-white' : 'bg-white text-text-secondary hover:bg-surface'}`}
                          >
                            ₹
                          </button>
                        </div>
                        <div className="flex items-center gap-1 flex-1">
                          {discountType === 'percentage' ? (
                            <>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step={0.5}
                                value={discountPercentage || ''}
                                onChange={e => setDiscountPercentage(Number(e.target.value) || 0)}
                                placeholder="0"
                                className="w-20 text-sm font-semibold text-text-primary bg-transparent focus:outline-none tabular-nums"
                              />
                              <span className="text-sm text-text-muted">%</span>
                              {discountPercentage > 0 && (
                                <span className="text-xs text-emerald-600 font-semibold ml-1">
                                  = {formatCurrency(resolvedDiscountAmount)}
                                </span>
                              )}
                            </>
                          ) : (
                            <>
                              <span className="text-sm text-text-muted">₹</span>
                              <input
                                type="number"
                                min={0}
                                value={discountAmount || ''}
                                onChange={e => setDiscountAmount(Number(e.target.value) || 0)}
                                placeholder="0"
                                className="w-24 text-sm font-semibold text-text-primary bg-transparent focus:outline-none tabular-nums"
                              />
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Estimate date */}
                  <div className="flex items-center gap-3 px-5 py-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface flex-shrink-0">
                      <Calendar className="h-4 w-4 text-primary" />
                    </div>
                    <label className="flex-1 min-w-0 cursor-pointer">
                      <p className="text-xs font-bold text-text-muted uppercase tracking-wide mb-0.5">Estimate Date</p>
                      <input
                        type="date"
                        value={estimateDate}
                        onChange={e => setEstimateDate(e.target.value)}
                        className="w-full text-sm font-semibold text-text-primary bg-transparent focus:outline-none"
                      />
                    </label>
                  </div>

                  {/* Notes */}
                  <div className="flex items-start gap-3 px-5 py-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 flex-shrink-0 mt-0.5">
                      <StickyNote className="h-4 w-4 text-amber-600" />
                    </div>
                    <label className="flex-1 min-w-0 cursor-pointer">
                      <p className="text-xs font-bold text-text-muted uppercase tracking-wide mb-0.5">Notes</p>
                      <textarea
                        rows={2}
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder="Optional notes for this estimate…"
                        className="w-full text-sm text-text-primary bg-transparent focus:outline-none resize-none placeholder:text-border"
                      />
                    </label>
                  </div>
                </div>
              </SectionCard>
            </>
          )}
        </div>
      </div>

      {/* ── Fixed Footer ─────────────────────────────────────────────────────── */}
      <div
        className="shrink-0 z-50 w-full border-t border-border bg-white/95 backdrop-blur-md px-4 py-3 lg:px-8 shadow-[0_-4px_16px_rgba(0,0,0,0.05)] relative"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="w-full max-w-4xl mx-auto flex items-center justify-between">
          {step === 'items' ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate('/estimates')}>Cancel</Button>
              <Button
                variant="primary" size="sm"
                rightIcon={<ChevronRight className="h-4 w-4" />}
                onClick={() => setStep('review')}
                disabled={!canProceed}
              >
                Review
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost" size="sm"
                leftIcon={<ChevronLeft className="h-4 w-4" />}
                onClick={() => setStep('items')}
              >
                Back
              </Button>
              <Button
                variant="primary" size="sm"
                leftIcon={<FileText className="h-4 w-4" />}
                loading={isPending}
                onClick={handleSubmit}
              >
                {editingEstimateId ? 'Update Estimate' : 'Save Estimate'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default NewEstimatePage;
