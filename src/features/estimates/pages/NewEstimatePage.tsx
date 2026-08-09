import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, FileText, Tag, Calendar, StickyNote, Percent } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useBranchStore } from '@/stores/branchStore';
import { PageShell } from '@/components/layout/PageShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui';
import { formatCurrency, getLocalDateString } from '@/lib/utils';
import { EstimateItemPicker } from '../components/EstimateItemPicker';
import { useEstimateCartStore } from '../stores/estimateCartStore';
import { useCreateEstimate } from '../hooks/useEstimate';
import type { EstimatePayload } from '../types';

type Step = 'items' | 'review';

export const NewEstimatePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { activeBranch } = useBranchStore();
  const { mutateAsync: createEstimate, isPending } = useCreateEstimate();

  const {
    farmerId, farmerName, items, gstEnabled, discountAmount,
    notes, estimateDate, setNotes, setEstimateDate, setDiscountAmount,
    clearCart,
  } = useEstimateCartStore();

  const [step, setStep] = useState<Step>('items');

  const totals = useMemo(() => {
    const subtotalBeforeDiscount = items.reduce(
      (sum, i) => sum + i.unit_price * i.quantity, 0
    );
    const subtotal = Math.max(0, subtotalBeforeDiscount - discountAmount);
    const gstAmount = gstEnabled
      ? items.reduce((sum, i) => sum + (i.unit_price * i.quantity * i.gst_rate) / 100, 0)
      : 0;
    const total = subtotal + gstAmount;
    return { subtotalBeforeDiscount, subtotal, gstAmount, total };
  }, [items, gstEnabled, discountAmount]);

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
      discount_amount:      discountAmount,
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
      const result = await createEstimate(payload);
      clearCart();
      toast.success(`Estimate ${result.estimate_number} saved!`);
      navigate(`/estimates/${result.estimate_id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save estimate.';
      toast.error(message);
    }
  };

  const canProceed = farmerId && items.length > 0;

  return (
    <PageShell>
      <PageHeader
        title="New Estimate"
        onBack={() => navigate('/estimates')}
      />

      {/* ── Step indicator ──────────────────────────────────────────── */}
      <div className="flex items-center gap-0 px-5 py-4 border-b border-[#d9e5ee] bg-white">
        {/* Step 1 */}
        <div className="flex items-center gap-2">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all"
            style={{
              background: step === 'items' ? '#0052cc' : '#1fa971',
              color: '#fff',
            }}
          >
            {step === 'items' ? '1' : '✓'}
          </div>
          <span
            className="text-sm font-semibold transition-colors"
            style={{ color: step === 'items' ? '#0052cc' : '#1fa971' }}
          >
            Items
          </span>
        </div>

        {/* connector */}
        <div className="flex-1 mx-3 flex items-center">
          <div
            className="h-0.5 w-full rounded-full transition-colors"
            style={{ background: step === 'review' ? '#1fa971' : '#d9e5ee' }}
          />
        </div>

        {/* Step 2 */}
        <div className="flex items-center gap-2">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all"
            style={{
              background: step === 'review' ? '#0052cc' : '#e7f5ff',
              color: step === 'review' ? '#fff' : '#8ba0af',
              border: step === 'review' ? 'none' : '2px solid #d9e5ee',
            }}
          >
            2
          </div>
          <span
            className="text-sm font-semibold transition-colors"
            style={{ color: step === 'review' ? '#0052cc' : '#8ba0af' }}
          >
            Review
          </span>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {step === 'items' && (
          <div className="p-4">
            <EstimateItemPicker />
          </div>
        )}

        {step === 'review' && (
          <div className="p-4 flex flex-col gap-4 max-w-2xl">

            {/* Farmer + items summary */}
            <div
              className="rounded-2xl bg-white border border-[#d9e5ee] overflow-hidden"
              style={{ boxShadow: '0 4px 16px rgba(20,54,84,0.06)' }}
            >
              {/* header */}
              <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-[#f0f7ff]">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg,#0052cc,#3385ff)' }}
                >
                  {farmerName?.[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-[#173042] text-sm">{farmerName}</p>
                  <p className="text-xs text-[#8ba0af]">{items.length} item{items.length > 1 ? 's' : ''}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setStep('items')}
                  className="ml-auto text-xs font-semibold text-[#0052cc] hover:underline"
                >
                  Edit
                </button>
              </div>

              {/* items */}
              <div className="divide-y divide-[#f0f7ff]">
                {items.map(item => (
                  <div key={item.product_id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#173042] truncate">{item.product_name}</p>
                      <p className="text-xs text-[#8ba0af]">
                        {item.quantity} × {formatCurrency(item.unit_price)}
                        {item.discount_percentage > 0 && (
                          <span className="ml-1.5 text-emerald-600 font-medium">{item.discount_percentage}% off</span>
                        )}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-[#173042] tabular-nums">
                      {formatCurrency(item.unit_price * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              {/* totals */}
              <div className="px-4 pt-3 pb-4 border-t border-[#f0f7ff] space-y-2">
                <div className="flex justify-between text-sm text-[#5d7486]">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{formatCurrency(totals.subtotalBeforeDiscount)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm text-emerald-600 font-medium">
                    <span>Discount</span>
                    <span className="tabular-nums">−{formatCurrency(discountAmount)}</span>
                  </div>
                )}
                {totals.gstAmount > 0 && (
                  <div className="flex justify-between text-sm text-[#5d7486]">
                    <span>GST</span>
                    <span className="tabular-nums">{formatCurrency(totals.gstAmount)}</span>
                  </div>
                )}
                <div
                  className="flex justify-between items-center rounded-xl px-3 py-2.5 mt-1"
                  style={{ background: 'linear-gradient(135deg,#0052cc,#3385ff)' }}
                >
                  <span className="text-sm font-bold text-white">Total</span>
                  <span className="text-base font-black text-white tabular-nums">{formatCurrency(totals.total)}</span>
                </div>
              </div>
            </div>

            {/* Options */}
            <div
              className="rounded-2xl bg-white border border-[#d9e5ee] overflow-hidden divide-y divide-[#f0f7ff]"
              style={{ boxShadow: '0 4px 16px rgba(20,54,84,0.06)' }}
            >
              {/* Overall discount */}
              <div className="flex items-center gap-3 px-4 py-3.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 flex-shrink-0">
                  <Percent className="h-4 w-4 text-emerald-600" />
                </div>
                <label className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#8ba0af] uppercase tracking-wide mb-0.5">Overall Discount (₹)</p>
                  <input
                    type="number"
                    min={0}
                    value={discountAmount || ''}
                    onChange={e => setDiscountAmount(Number(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full text-sm font-semibold text-[#173042] bg-transparent focus:outline-none placeholder:text-[#d9e5ee] placeholder:font-normal"
                  />
                </label>
              </div>

              {/* Estimate date */}
              <div className="flex items-center gap-3 px-4 py-3.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e7f5ff] flex-shrink-0">
                  <Calendar className="h-4 w-4 text-[#0052cc]" />
                </div>
                <label className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#8ba0af] uppercase tracking-wide mb-0.5">Estimate Date</p>
                  <input
                    type="date"
                    value={estimateDate}
                    onChange={e => setEstimateDate(e.target.value)}
                    className="w-full text-sm font-semibold text-[#173042] bg-transparent focus:outline-none"
                  />
                </label>
              </div>

              {/* Notes */}
              <div className="flex items-start gap-3 px-4 py-3.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 flex-shrink-0 mt-0.5">
                  <StickyNote className="h-4 w-4 text-amber-600" />
                </div>
                <label className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#8ba0af] uppercase tracking-wide mb-0.5">Notes</p>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Optional notes for this estimate…"
                    className="w-full text-sm text-[#173042] bg-transparent focus:outline-none resize-none placeholder:text-[#d9e5ee]"
                  />
                </label>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <div
        className="border-t border-[#d9e5ee] px-4 py-3 flex items-center justify-between gap-3 bg-white"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {step === 'items' ? (
          <>
            <button
              type="button"
              onClick={() => navigate('/estimates')}
              className="text-sm font-semibold text-[#5d7486] hover:text-[#173042] transition-colors px-2"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setStep('review')}
              disabled={!canProceed}
              className="flex items-center gap-1.5 rounded-2xl px-5 py-2.5 text-sm font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: canProceed ? 'linear-gradient(135deg,#0052cc,#3385ff)' : '#8ba0af', boxShadow: canProceed ? '0 4px 12px rgba(0,82,204,0.3)' : 'none' }}
            >
              Review
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setStep('items')}
              className="flex items-center gap-1 text-sm font-semibold text-[#5d7486] hover:text-[#173042] transition-colors px-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending}
              className="flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-bold text-white transition-all disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg,#0052cc,#3385ff)', boxShadow: '0 4px 12px rgba(0,82,204,0.3)' }}
            >
              {isPending ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Saving…
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" />
                  Save Estimate
                </>
              )}
            </button>
          </>
        )}
      </div>
    </PageShell>
  );
};

export default NewEstimatePage;
