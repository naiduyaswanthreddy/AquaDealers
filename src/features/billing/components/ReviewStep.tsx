import React, { useMemo } from 'react';
import { ArrowLeft, CheckCircle2, MessageCircle, Pill, Printer, Wheat } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useCartStore } from '../stores/cartStore';
import { useCreateBill } from '../hooks/useBilling';
import { useCheckout } from '../hooks/useCheckout';
import { useAuthStore } from '@/stores/authStore';
import { useBranchStore } from '@/stores/branchStore';
import { formatCurrency, formatDate } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import SignaturePad from './SignaturePad';
import { billingService } from '../services/billingService';
import { SignatureStroke } from '@/types/database';
import { Modal, Button } from '@/components/ui';
import { BillingPayload, FifoBillPreview } from '../types';
import { generateTempBillNumber, isNetworkError, useOfflineBillStore } from '../offline/offlineBillStore';

interface ReviewStepProps {
  onBack: () => void;
  onSuccess: (result: {
    billId: string;
    billNumber: string;
    total: number;
    amountPaid: number;
    balanceDue: number;
    farmerName: string | null;
    billDate: string;
    isOffline?: boolean;
  }) => void;
}

const normalizeType = (type?: string | null) => {
  const normalized = (type || '').toLowerCase();
  return normalized.includes('medicine') || normalized.includes('medic') ? 'medicine' : 'feed';
};

const getLine = (item: { base_unit_price: number; discount_percentage: number; quantity: number; gst_rate: number }, gstEnabled: boolean) => {
  const unitPrice = Number((item.base_unit_price * (1 - item.discount_percentage / 100)).toFixed(2));
  // Round each line to 2dp before summing — matches the server's per-line
  // ROUND(qty*price, 2) so the preview total equals the saved bill total.
  const subtotal = Number((unitPrice * item.quantity).toFixed(2));
  const gstAmount = gstEnabled ? Number(((subtotal * item.gst_rate) / 100).toFixed(2)) : 0;
  return { unitPrice, subtotal, gstAmount, total: subtotal + gstAmount };
};

const ProductIcon: React.FC<{ type?: string | null }> = ({ type }) => {
  const normalized = normalizeType(type);
  const Icon = normalized === 'medicine' ? Pill : Wheat;
  return (
    <span className={normalized === 'medicine' ? 'billing-product-icon billing-product-icon--medicine' : 'billing-product-icon billing-product-icon--feed'}>
      <Icon className="h-5 w-5" />
    </span>
  );
};

export const ReviewStep: React.FC<ReviewStepProps> = ({
  onBack,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { activeBranch } = useBranchStore();
  const { mutateAsync: createBill, isPending } = useCreateBill();
  const queueOfflineBill = useOfflineBillStore((s) => s.queueBill);
  // Idempotency key: generated fresh per submit attempt, prevents double-submit duplicates.
  // The DB has a UNIQUE index on (dealer_id, idempotency_key).
  const idempotencyKeyRef = React.useRef<string | null>(null);
  const generateIdempotencyKey = () => {
    // crypto.randomUUID() is available in all modern browsers
    const key = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    idempotencyKeyRef.current = key;
    return key;
  };
  const [isSignModalOpen, setIsSignModalOpen] = React.useState(false);
  const [signatureStrokes, setSignatureStrokes] = React.useState<SignatureStroke[]>([]);
  const [sigCanvasDims, setSigCanvasDims] = React.useState({ w: 600, h: 220 });
  const [fifoPreview, setFifoPreview] = React.useState<FifoBillPreview | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = React.useState(false);
  const {
    items,
    farmerId,
    farmerName,
    farmerTotalDue,
    farmerCreditLimit,
    gstEnabled,
    discountAmount,
    amountPaid,
    paymentType,
    upiRef,
    chequeNumber,
    notes,
    billDate,
    settlementDiscountAmount,
    isEstimate,
    setIsEstimate,
  } = useCartStore();

  const [showColumnSettings, setShowColumnSettings] = React.useState(false);
  const [columns, setColumns] = React.useState(() => {
    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;
    const saved = localStorage.getItem('receipt_columns');

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          // Always show signature on mobile, always hide on desktop by default
          signature: !isDesktop,
        };
      } catch (e) {
        // Fallback if parsing fails
      }
    }
    return {
      hsn: false,
      rate: true,
      discount: true,
      gst: gstEnabled,
      mrp: false,
      expiry: false,
      signature: !isDesktop,
    };
  });

  React.useEffect(() => {
    localStorage.setItem('receipt_columns', JSON.stringify(columns));
  }, [columns]);

  const columnConfig = useMemo(() => {
    const cols = [];
    cols.push({ id: 'item', label: 'Item', width: '1fr', align: 'left' });
    if (columns.hsn) cols.push({ id: 'hsn', label: 'HSN', width: '4.5rem', align: 'left' });
    if (columns.expiry) cols.push({ id: 'expiry', label: 'EXP', width: '5rem', align: 'left' });
    if (columns.mrp) cols.push({ id: 'mrp', label: 'MRP', width: '4.5rem', align: 'right' });
    if (columns.rate) cols.push({ id: 'rate', label: 'Rate', width: '5.5rem', align: 'right' });
    if (columns.discount) cols.push({ id: 'discount', label: 'Disc.', width: '4.5rem', align: 'right' });
    if (columns.gst && gstEnabled) cols.push({ id: 'gst', label: 'GST', width: '4.5rem', align: 'right' });
    cols.push({ id: 'qty', label: 'Qty', width: '3.5rem', align: 'center' });
    cols.push({ id: 'amount', label: 'Amount', width: '6rem', align: 'right' });

    const gridTemplate = cols.map(c => c.width).join(' ');
    return { cols, gridTemplate };
  }, [columns, gstEnabled]);

  const clientTotals = useMemo(() => {
    let subtotal = 0;
    let gstAmount = 0;
    const breakdown: Record<number, { taxableValue: number; cgst: number; sgst: number }> = {};

    items.forEach((item) => {
      const line = getLine(item, gstEnabled);
      subtotal += line.subtotal;
      gstAmount += line.gstAmount;

      if (gstEnabled) {
        if (!breakdown[item.gst_rate]) {
          breakdown[item.gst_rate] = { taxableValue: 0, cgst: 0, sgst: 0 };
        }
        breakdown[item.gst_rate].taxableValue += line.subtotal;
        breakdown[item.gst_rate].cgst += Number((line.gstAmount / 2).toFixed(2));
        breakdown[item.gst_rate].sgst += Number((line.gstAmount / 2).toFixed(2));
      }
    });

    return {
      subtotal,
      gstAmount,
      total: Math.max(0, subtotal + gstAmount - discountAmount),
      gstBreakdown: breakdown,
    };
  }, [discountAmount, gstEnabled, items]);

  const savingsAmount = useMemo(() => {
    return items.reduce((acc, item) => {
      if (!item.mrp || item.mrp <= 0) return acc;
      const effectivePrice = item.base_unit_price * (1 - item.discount_percentage / 100);
      const saved = (item.mrp - effectivePrice) * item.quantity;
      return acc + (saved > 0 ? saved : 0);
    }, 0);
  }, [items]);

  const displayDate = formatDate(billDate);
  const totals = clientTotals;
  const effectiveTotal = Math.max(0, totals.total - (settlementDiscountAmount || 0));
  const balanceDue = Math.max(0, effectiveTotal - amountPaid);
  const projectedDue = Math.max(0, farmerTotalDue + effectiveTotal - amountPaid);
  const exceedsCreditLimit = !!farmerId && farmerCreditLimit > 0 && projectedDue > farmerCreditLimit;
  const signatureEnabled = (user?.bill_signature_enabled ?? true) && columns.signature;
  const signatureRequired = signatureEnabled && (paymentType === 'credit' || balanceDue > 0);

  // When SignaturePad isn't rendered we show an explicit "Signed & Verified in person" checkbox
  // so the dealer intentionally opts in to marking the bill verified.
  const showDesktopVerifyCheckbox = !signatureEnabled;
  const [desktopVerified, setDesktopVerified] = React.useState<boolean>(true);
  const [mobileSignatureMode, setMobileSignatureMode] = React.useState<'sign' | 'verify_later'>('sign');
  const previewLines = null;

  const {
    handleCheckout,
    buildPayload,
    isSubmitting,
    isSavingSignature,
    duplicateWarning,
    setDuplicateWarning,
    creditLimitWarning,
    setCreditLimitWarning,
  } = useCheckout();

  // Each warning is confirmed independently, but confirmations must accumulate
  // across retries within one checkout attempt — otherwise confirming the
  // duplicate-bill warning (which only sets its own flag) would reset the
  // credit-limit flag back to false and re-trigger that modal in a loop.
  // Refs (not state) because the confirm handlers need the flag to take
  // effect on the very next synchronous call, before a re-render could land.
  const ignoreCreditLimitRef = React.useRef(false);
  const ignoreDuplicateRef = React.useRef(false);

  const onCheckoutClick = (
    overrides: { ignoreCreditLimitWarning?: boolean; ignoreDuplicateWarning?: boolean } = {},
    mode: 'sign' | 'transport' | 'in_person' = 'sign'
  ) => {
    if (overrides.ignoreCreditLimitWarning) ignoreCreditLimitRef.current = true;
    if (overrides.ignoreDuplicateWarning) ignoreDuplicateRef.current = true;
    handleCheckout({
      totals: {
        subtotal: totals.subtotal,
        gstAmount: totals.gstAmount,
        total: totals.total,
      },
      signatureStrokes,
      sigCanvasDims,
      ignoreCreditLimitWarning: ignoreCreditLimitRef.current,
      ignoreDuplicateWarning: ignoreDuplicateRef.current,
      mode,
      onSuccess,
    });
  };
  const getCheckoutMode = (): 'sign' | 'transport' | 'in_person' =>
    showDesktopVerifyCheckbox ? (desktopVerified ? 'in_person' : 'transport')
      : signatureEnabled && mobileSignatureMode === 'verify_later' ? 'transport' : 'sign';

  return (
    <div className="flex flex-col gap-6 pb-32 lg:px-8 lg:pb-8 max-w-[64rem] mx-auto w-full">
      <section className="billing-collapsed-card">
        <button
          type="button"
          onClick={() => setShowColumnSettings(!showColumnSettings)}
          className="flex w-full items-center justify-between gap-3 text-left outline-none"
        >
          <h2 className="text-sm font-black text-slate-700">Receipt Column Settings</h2>
          <span className="text-xs font-bold text-primary bg-sky-50 px-2.5 py-1 rounded-lg">Configure</span>
        </button>
        {showColumnSettings && (
          <div className="mt-3 grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100 animate-fade-in">
            <label className="flex items-center gap-2 text-xs font-black text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={columns.rate}
                onChange={(e) => setColumns({ ...columns, rate: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
              />
              Show Unit Rate
            </label>
            <label className="flex items-center gap-2 text-xs font-black text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={columns.discount}
                onChange={(e) => setColumns({ ...columns, discount: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
              />
              Show Item Discount
            </label>
            {gstEnabled && (
              <label className="flex items-center gap-2 text-xs font-black text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={columns.gst}
                  onChange={(e) => setColumns({ ...columns, gst: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                />
                Show Item GST
              </label>
            )}
            <label className="flex items-center gap-2 text-xs font-black text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={columns.hsn}
                onChange={(e) => setColumns({ ...columns, hsn: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
              />
              Show HSN Code
            </label>
            <label className="flex items-center gap-2 text-xs font-black text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={columns.expiry}
                onChange={(e) => setColumns({ ...columns, expiry: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
              />
              Show Expiry Date
            </label>
            <label className="flex items-center gap-2 text-xs font-black text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={columns.mrp}
                onChange={(e) => setColumns({ ...columns, mrp: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
              />
              Show MRP
            </label>
            {(user?.bill_signature_enabled ?? true) && (
              <label className="flex items-center gap-2 text-xs font-black text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={columns.signature}
                  onChange={(e) => setColumns({ ...columns, signature: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                />
                Customer Signature
              </label>
            )}
          </div>
        )}
      </section>

      {/* Estimate toggle */}
      <div
        className={`rounded-2xl border p-4 transition-colors ${
          isEstimate
            ? 'border-amber-300 bg-amber-50'
            : 'border-slate-200 bg-white'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className={`text-sm font-black ${isEstimate ? 'text-amber-800' : 'text-slate-900'}`}>
              Save as Estimate
            </div>
            <div className={`mt-0.5 text-xs font-medium ${isEstimate ? 'text-amber-700' : 'text-slate-500'}`}>
              {isEstimate
                ? 'Price quote only — no stock deducted, no dues added'
                : 'Toggle on to send a price quote instead of a real bill'}
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isEstimate}
            onClick={() => setIsEstimate(!isEstimate)}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 ${
              isEstimate ? 'bg-amber-500' : 'bg-slate-200'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                isEstimate ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      <section className="billing-invoice-card">
        <div className="billing-invoice-card__header">
          <div>
            <h2 className="text-xl font-black text-slate-950">
              {isEstimate ? 'Estimate' : gstEnabled ? 'Tax Invoice' : 'Bill of Supply'}
            </h2>
            {isEstimate && (
              <div className="mt-1 inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                Price Quote · Not a Bill
              </div>
            )}
            <div className="mt-1 text-sm font-semibold text-slate-600">{gstEnabled ? 'GST enabled' : 'GST disabled'}</div>
          </div>
          <div className="text-sm font-bold text-slate-700">{displayDate}</div>
        </div>

        <div className="billing-invoice-card__customer">
          <div className="text-sm font-semibold text-slate-500">Billed To</div>
          <div className="text-lg font-black text-slate-950">{farmerName || 'Walk-in Customer'}</div>
        </div>

        <div className="billing-review-items">
          {/* Mobile Table Header */}
          <div className="grid grid-cols-[1fr_4rem_5.5rem] billing-review-table-head md:hidden">
            <span>Item</span>
            <span className="text-center">Qty</span>
            <span className="text-right">Amount</span>
          </div>

          {/* Desktop Table Header */}
          <div
            className="hidden md:grid billing-review-table-head"
            style={{ gridTemplateColumns: columnConfig.gridTemplate }}
          >
            {columnConfig.cols.map(col => (
              <span key={col.id} className={col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'}>
                {col.label}
              </span>
            ))}
          </div>

          {(previewLines || items).map((item: any, index) => {
            const line = getLine(item, gstEnabled);
            const unit = item.unit || items.find((cartItem) => cartItem.inventory_id === item.inventory_id)?.unit || 'unit';
            const productName = item.product_name || item.product_name_snapshot || 'Unknown Item';
            const rowKey = item.lot_id || `${item.inventory_id}-${index}`;
            return (
              <React.Fragment key={rowKey}>
                {/* Mobile View Item Row */}
                <div className="grid grid-cols-[1fr_4rem_5.5rem] billing-review-table-row md:hidden">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black text-slate-950">{productName}</div>
                    <div className="truncate text-xs font-semibold text-slate-500 mt-0.5 flex flex-wrap gap-x-1.5 gap-y-0.5">
                      {columns.rate && <span>{formatCurrency(line.unitPrice)}/{unit}</span>}
                      {item.batch_number && <span>Batch {item.batch_number}</span>}
                      {item.discount_label && <span>{item.discount_label}</span>}
                      {columns.mrp && <span>MRP {formatCurrency(item.mrp || 0)}</span>}
                      {columns.discount && item.discount_percentage > 0 && <span>(Disc. {item.discount_percentage}%)</span>}
                      {columns.gst && gstEnabled && <span>GST {item.gst_rate}%</span>}
                      {columns.hsn && item.hsn_code && <span>HSN {item.hsn_code}</span>}
                      {columns.expiry && item.expiry_date && <span>EXP {item.expiry_date}</span>}
                    </div>
                  </div>
                  <div className="text-center text-sm font-black text-slate-700">{item.quantity}</div>
                  <div className="text-right text-sm font-black text-slate-950">{formatCurrency(line.total)}</div>
                </div>

                {/* Desktop View Item Row */}
                <div
                  className="hidden md:grid billing-review-table-row"
                  style={{ gridTemplateColumns: columnConfig.gridTemplate }}
                >
                  <span className="truncate text-sm font-black text-slate-950">{productName}</span>
                  {columns.hsn && <span className="text-sm font-semibold text-slate-600">{item.hsn_code || '-'}</span>}
                  {columns.expiry && <span className="text-sm font-semibold text-slate-600">{item.expiry_date || '-'}</span>}
                  {columns.mrp && <span className="text-right text-sm font-semibold text-slate-600">{formatCurrency(item.mrp || 0)}</span>}
                  {columns.rate && <span className="text-right text-sm font-semibold text-slate-600">{formatCurrency(line.unitPrice)}/{unit}</span>}
                  {columns.discount && <span className="text-right text-sm font-semibold text-slate-600">{item.discount_percentage}%</span>}
                  {columns.gst && gstEnabled && <span className="text-right text-sm font-semibold text-slate-600">{item.gst_rate}%</span>}
                  <span className="text-center text-sm font-black text-slate-700">{item.quantity}</span>
                  <span className="text-right text-sm font-black text-slate-950">{formatCurrency(line.total)}</span>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        <div className="billing-review-totals">
          {isPreviewLoading ? (
            <div className="billing-review-tax-line text-sky-600">
              <span>Checking FIFO prices</span>
              <span>...</span>
            </div>
          ) : null}
          <div className="billing-review-total-line">
            <span>Subtotal</span>
            <strong>{formatCurrency(totals.subtotal)}</strong>
          </div>

          {savingsAmount > 0 && (
            <div className="billing-review-tax-line text-emerald-600">
              <span className="flex items-center gap-1">🏷️ Farmer Savings</span>
              <span className="font-bold">-{formatCurrency(savingsAmount)}</span>
            </div>
          )}

          {gstEnabled ? (
            <>
              <div className="billing-review-tax-line">
                <span>CGST</span>
                <span>{formatCurrency(totals.gstAmount / 2)}</span>
              </div>
              <div className="billing-review-tax-line">
                <span>SGST</span>
                <span>{formatCurrency(totals.gstAmount / 2)}</span>
              </div>
            </>
          ) : null}

          {discountAmount > 0 ? (
            <div className="billing-review-tax-line text-emerald-600">
              <span>Discount</span>
              <span>-{formatCurrency(discountAmount)}</span>
            </div>
          ) : null}

          {settlementDiscountAmount > 0 ? (
            <div className="billing-review-tax-line text-emerald-600">
              <span>Settlement Discount</span>
              <span>-{formatCurrency(settlementDiscountAmount)}</span>
            </div>
          ) : null}

          <div className="billing-review-total-line billing-review-total-line--grand">
            <span>{settlementDiscountAmount > 0 ? 'Effective Total' : 'Total'}</span>
            <strong>{formatCurrency(effectiveTotal)}</strong>
          </div>
          {!isEstimate && (
          <div className="billing-review-total-line">
            <span>Payment Mode</span>
            <strong className="uppercase text-slate-800">{paymentType || (amountPaid === 0 ? 'Credit' : 'Cash')}</strong>
          </div>
          )}
          <div className="billing-review-total-line">
            <span>Amount Paid</span>
            <strong className="text-emerald-600">{formatCurrency(amountPaid)}</strong>
          </div>
          <div className="billing-review-total-line">
            <span>Balance Due</span>
            <strong className={balanceDue > 0 ? 'text-rose-500' : 'text-slate-950'}>{formatCurrency(balanceDue)}</strong>
          </div>
        </div>
      </section>


      {signatureEnabled ? (
        <div className="billing-signature-section">
          <div className="flex bg-slate-100 rounded-xl p-1 mb-4 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileSignatureMode('sign')}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mobileSignatureMode === 'sign' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Sign Now
            </button>
            <button
              type="button"
              onClick={() => setMobileSignatureMode('verify_later')}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mobileSignatureMode === 'verify_later' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Verify Later
            </button>
          </div>

          {mobileSignatureMode === 'sign' ? (
            <SignaturePad
              value={signatureStrokes}
              onChange={setSignatureStrokes}
              required={signatureRequired}
              onDimensionsCaptured={(w, h) => setSigCanvasDims({ w, h })}
            />
          ) : (
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 text-center animate-fade-in">
              <div className="text-blue-700 font-black mb-1.5 text-lg">Verify Later Selected</div>
              <div className="text-sm font-semibold text-blue-700/80">A 4-digit PIN will be generated. The customer can provide this PIN to you later to mark this bill as verified.</div>
            </div>
          )}
        </div>
      ) : showDesktopVerifyCheckbox ? (
        <label className="billing-signature-card flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={desktopVerified}
            onChange={(e) => setDesktopVerified(e.target.checked)}
            className="mt-1 h-5 w-5 rounded border-slate-300 text-primary focus:ring-primary"
          />
          <div className="flex-1">
            <div className="text-sm font-black text-slate-900">Signed &amp; Verified in person</div>
            <div className="mt-0.5 text-xs text-slate-500">
              {desktopVerified
                ? 'Bill will be saved as verified — no delivery PIN needed.'
                : 'Uncheck to save without verification. A 4-digit delivery PIN will be generated; enter it later to mark verified.'}
            </div>
          </div>
        </label>
      ) : null}

      <footer className="billing-bottom-bar billing-bottom-bar--review">
        <button type="button" onClick={onBack} className="billing-footer-icon billing-footer-icon--wide shrink-0">
          <ArrowLeft className="h-5 w-5" />
          <span>Back</span>
        </button>
        <div className="flex gap-2 w-full">
          <button
            type="button"
            onClick={() => {
              ignoreCreditLimitRef.current = false;
              ignoreDuplicateRef.current = false;
              onCheckoutClick({}, getCheckoutMode());
            }}
            disabled={items.length === 0 || isSubmitting || isSavingSignature}
            className={`billing-save-button flex-1 ${signatureEnabled && mobileSignatureMode === 'verify_later' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20' : ''}`}
          >
            {isSubmitting || isSavingSignature
              ? 'Saving...'
              : showDesktopVerifyCheckbox
                ? (desktopVerified ? 'Save & Verify' : 'Save with PIN')
                : (signatureEnabled && mobileSignatureMode === 'verify_later'
                    ? 'Save & Verify Later'
                    : (isEstimate ? 'Save Estimate' : 'Sign & Save'))}
            <CheckCircle2 className="h-5 w-5" />
          </button>
        </div>
      </footer>
      {/* Duplicate Warning Modal */}
      <Modal
        isOpen={duplicateWarning?.show || false}
        onClose={() => setDuplicateWarning(null)}
        title="Possible Duplicate Bill"
      >
        <div className="p-4">
          <p className="text-slate-600 mb-6">
            You already created a bill for <strong>{duplicateWarning?.farmerName}</strong> today for <strong>{duplicateWarning ? formatCurrency(duplicateWarning.amount) : ''}</strong>.
            <br/><br/>
            Create another?
          </p>
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={() => setDuplicateWarning(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setDuplicateWarning(null);
                onCheckoutClick({ ignoreDuplicateWarning: true }, getCheckoutMode());
              }}
              loading={isSubmitting}
            >
              Yes, Create Another
            </Button>
          </div>
        </div>
      </Modal>
      {/* Credit Limit Warning Modal */}
      <Modal
        isOpen={creditLimitWarning?.show || false}
        onClose={() => setCreditLimitWarning(null)}
        title="Over Credit Limit"
      >
        <div className="p-4">
          <p className="text-slate-600 mb-6">
            This bill will take <strong>{creditLimitWarning?.farmerName}</strong>'s outstanding due to{' '}
            <strong>{creditLimitWarning ? formatCurrency(creditLimitWarning.projectedDue) : ''}</strong>, above their{' '}
            <strong>{creditLimitWarning ? formatCurrency(creditLimitWarning.creditLimit) : ''}</strong> credit limit.
            <br /><br />
            Continue anyway?
          </p>
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={() => setCreditLimitWarning(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setCreditLimitWarning(null);
                onCheckoutClick({ ignoreCreditLimitWarning: true }, getCheckoutMode());
              }}
              loading={isSubmitting}
            >
              Bill Anyway
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ReviewStep;
