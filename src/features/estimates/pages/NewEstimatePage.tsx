// src/features/estimates/pages/NewEstimatePage.tsx
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useBranchStore } from '@/stores/branchStore';
import { PageShell } from '@/components/layout/PageShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui';
import { cn, formatCurrency, getLocalDateString } from '@/lib/utils';
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

  // ── Totals calculation ─────────────────────────────────────────────────────

  const totals = useMemo(() => {
    const subtotalBeforeDiscount = items.reduce(
      (sum, i) => sum + i.unit_price * i.quantity, 0
    );
    const subtotal = Math.max(0, subtotalBeforeDiscount - discountAmount);
    const gstAmount = gstEnabled
      ? items.reduce((sum, i) => sum + (i.unit_price * i.quantity * i.gst_rate) / 100, 0)
      : 0;
    const total = subtotal + gstAmount;
    return { subtotal, gstAmount, total };
  }, [items, gstEnabled, discountAmount]);

  // ── Submit ─────────────────────────────────────────────────────────────────

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

  // ── Render ─────────────────────────────────────────────────────────────────

  const canProceed = farmerId && items.length > 0;

  return (
    <PageShell>
      <PageHeader
        title="New Estimate"
        onBack={() => navigate('/estimates')}
      />

      {/* Step indicator */}
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        {(['items', 'review'] as Step[]).map((s, idx) => (
          <React.Fragment key={s}>
            <div className={cn(
              'flex items-center gap-1.5 text-sm font-medium',
              step === s ? 'text-primary' : 'text-gray-400'
            )}>
              <span className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
                step === s ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'
              )}>{idx + 1}</span>
              {s === 'items' ? 'Items' : 'Review'}
            </div>
            {idx === 0 && <div className="flex-1 h-px bg-gray-200" />}
          </React.Fragment>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {step === 'items' && <EstimateItemPicker />}

        {step === 'review' && (
          <div className="flex flex-col gap-4 max-w-lg">
            {/* Totals */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span>{formatCurrency(totals.subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-sm text-emerald-600">
                  <span>Discount</span>
                  <span>-{formatCurrency(discountAmount)}</span>
                </div>
              )}
              {totals.gstAmount > 0 && (
                <div className="flex justify-between text-sm text-gray-600">
                  <span>GST</span>
                  <span>{formatCurrency(totals.gstAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold border-t pt-2 text-gray-900">
                <span>Total</span>
                <span>{formatCurrency(totals.total)}</span>
              </div>
            </div>

            {/* Overall discount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Overall Discount (₹)
              </label>
              <input
                type="number"
                min={0}
                value={discountAmount || ''}
                onChange={e => setDiscountAmount(Number(e.target.value) || 0)}
                placeholder="0"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {/* Estimate date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estimate Date
              </label>
              <input
                type="date"
                value={estimateDate}
                onChange={e => setEstimateDate(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                rows={3}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Optional notes for this estimate..."
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer navigation */}
      <div className="border-t px-4 py-3 flex items-center justify-between gap-3 bg-white">
        {step === 'items' ? (
          <>
            <Button variant="ghost" onClick={() => navigate('/estimates')}>
              Cancel
            </Button>
            <Button
              onClick={() => setStep('review')}
              disabled={!canProceed}
            >
              Review
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => setStep('items')}>
              <ChevronLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending ? 'Saving...' : 'Save Estimate'}
            </Button>
          </>
        )}
      </div>
    </PageShell>
  );
};

export default NewEstimatePage;
