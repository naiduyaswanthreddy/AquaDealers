import React, { useMemo } from 'react';
import { ArrowLeft, CheckCircle2, MessageCircle, Pill, Printer, Wheat } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useCartStore } from '../stores/cartStore';
import { useCreateBill } from '../hooks/useBilling';
import { useAuthStore } from '@/stores/authStore';
import { useBranchStore } from '@/stores/branchStore';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import SignaturePad from './SignaturePad';
import { billingService } from '../services/billingService';
import { SignatureStroke } from '@/types/database';
import { Modal, Button } from '@/components/ui';

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
  }) => void;
  upiRef: string;
  chequeNumber: string;
  notes: string;
}

const normalizeType = (type?: string | null) => {
  const normalized = (type || '').toLowerCase();
  return normalized.includes('medicine') || normalized.includes('medic') ? 'medicine' : 'feed';
};

const getLine = (item: { base_unit_price: number; discount_percentage: number; quantity: number; gst_rate: number }, gstEnabled: boolean) => {
  const unitPrice = Number((item.base_unit_price * (1 - item.discount_percentage / 100)).toFixed(2));
  const subtotal = unitPrice * item.quantity;
  const gstAmount = gstEnabled ? (subtotal * item.gst_rate) / 100 : 0;
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
  upiRef,
  chequeNumber,
  notes,
}) => {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { activeBranch } = useBranchStore();
  const { mutateAsync: createBill, isPending } = useCreateBill();
  const [signatureStrokes, setSignatureStrokes] = React.useState<SignatureStroke[]>([]);
  const [isSavingSignature, setIsSavingSignature] = React.useState(false);
  const [duplicateWarning, setDuplicateWarning] = React.useState<{ show: boolean; farmerName: string; amount: number } | null>(null);
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
  } = useCartStore();

  const [showColumnSettings, setShowColumnSettings] = React.useState(false);
  const [columns, setColumns] = React.useState(() => {
    const saved = localStorage.getItem('receipt_columns');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          signature: parsed.signature ?? true,
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
      signature: true,
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

  const totals = useMemo(() => {
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

  const todayIso = new Date().toISOString();
  const displayDate = formatDateTime(todayIso);
  const balanceDue = Math.max(0, totals.total - amountPaid);
  const projectedDue = Math.max(0, farmerTotalDue + totals.total - amountPaid);
  const exceedsCreditLimit = !!farmerId && farmerCreditLimit > 0 && projectedDue > farmerCreditLimit;
  const signatureEnabled = (user?.bill_signature_enabled ?? true) && columns.signature;
  const signatureRequired = signatureEnabled && (paymentType === 'credit' || balanceDue > 0);

  const handleCheckout = async (ignoreWarning = false) => {
    if (!items.length || !user?.id) return;
    if (amountPaid > totals.total) {
      toast.error(t('billing.errorOverpaid', 'Amount paid cannot exceed the total.'));
      return;
    }
    if (farmerId === null && amountPaid < totals.total) {
      toast.error(t('billing.walkinFullPayment', 'Walk-in bills must be paid in full.'));
      return;
    }
    if (signatureRequired && signatureStrokes.length === 0) {
      toast.error('Customer signature is required for credit or pending bills.');
      return;
    }

    if (!ignoreWarning && farmerId) {
      try {
        const todayStart = new Date();
        todayStart.setHours(0,0,0,0);
        const todayEnd = new Date();
        todayEnd.setHours(23,59,59,999);
        
        const { data: recentBills } = await supabase
          .from('bills')
          .select('total, created_at')
          .eq('farmer_id', farmerId)
          .eq('dealer_id', user.id)
          .gte('created_at', todayStart.toISOString())
          .lte('created_at', todayEnd.toISOString());

        if (recentBills && recentBills.length > 0) {
          const similarBill = recentBills.find(b => Math.abs(Number(b.total) - totals.total) <= 100);
          if (similarBill) {
            setDuplicateWarning({
              show: true,
              farmerName: farmerName || 'this farmer',
              amount: Number(similarBill.total)
            });
            return;
          }
        }
      } catch (err) {
        console.error('Failed to check duplicate bills:', err);
      }
    }

    try {
      if (navigator.vibrate) navigator.vibrate(50);

      const result = await createBill({
        dealer_id: user.id,
        branch_id: activeBranch?.id,
        farmer_id: farmerId,
        farmer_name_snapshot: farmerName,
        bill_date: todayIso,
        subtotal: totals.subtotal,
        gst_amount: totals.gstAmount,
        cgst_amount: totals.gstAmount / 2,
        sgst_amount: totals.gstAmount / 2,
        igst_amount: 0,
        discount_amount: discountAmount,
        total: totals.total,
        amount_paid: amountPaid,
        payment_type: amountPaid > 0 ? paymentType : null,
        credit_override_used: exceedsCreditLimit,
        credit_override_reason: exceedsCreditLimit ? 'Dealer override from checkout' : null,
        upi_ref: paymentType === 'upi' ? upiRef : null,
        cheque_number: paymentType === 'other' ? chequeNumber : null,
        notes: notes || null,
        items: items.map(
          ({ inventory_id, product_id, product_name, hsn_code, quantity, base_unit_price, discount_percentage, gst_rate, mrp }) => ({
            inventory_id,
            product_id,
            product_name,
            hsn_code,
            quantity,
            mrp,
            unit_price: Number((base_unit_price * (1 - discount_percentage / 100)).toFixed(2)),
            gst_rate: gstEnabled ? gst_rate : 0,
          })
        ),
      });

      if (signatureEnabled && signatureStrokes.length > 0) {
        setIsSavingSignature(true);
        await billingService.saveBillSignature({
          dealerId: user.id,
          branchId: activeBranch?.id,
          billId: result.bill_id,
          signerName: farmerName || 'Walk-in Customer',
          signatureData: signatureStrokes,
        });
      }

      toast.success(t('billing.success', 'Bill created successfully.'));
      onSuccess({
        billId: result.bill_id,
        billNumber: result.bill_number,
        total: totals.total,
        amountPaid,
        balanceDue,
        farmerName,
        billDate: displayDate,
      });
    } catch (error: any) {
      toast.error(error.message || t('common.error', 'Something went wrong.'));
    } finally {
      setIsSavingSignature(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 lg:px-8 lg:pb-8 max-w-[64rem] mx-auto w-full">
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

      <section className="billing-invoice-card">
        <div className="billing-invoice-card__header">
          <div>
            <h2 className="text-xl font-black text-slate-950">{gstEnabled ? 'Tax Invoice' : 'Bill of Supply'}</h2>
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

          {items.map((item) => {
            const line = getLine(item, gstEnabled);
            return (
              <React.Fragment key={item.inventory_id}>
                {/* Mobile View Item Row */}
                <div className="grid grid-cols-[1fr_4rem_5.5rem] billing-review-table-row md:hidden">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black text-slate-950">{item.product_name}</div>
                    <div className="truncate text-xs font-semibold text-slate-500 mt-0.5 flex flex-wrap gap-x-1.5 gap-y-0.5">
                      {columns.rate && <span>{formatCurrency(line.unitPrice)}/{item.unit || 'unit'}</span>}
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
                  <span className="truncate text-sm font-black text-slate-950">{item.product_name || 'Unknown Item'}</span>
                  {columns.hsn && <span className="text-sm font-semibold text-slate-600">{item.hsn_code || '-'}</span>}
                  {columns.expiry && <span className="text-sm font-semibold text-slate-600">{item.expiry_date || '-'}</span>}
                  {columns.mrp && <span className="text-right text-sm font-semibold text-slate-600">{formatCurrency(item.mrp || 0)}</span>}
                  {columns.rate && <span className="text-right text-sm font-semibold text-slate-600">{formatCurrency(line.unitPrice)}/{item.unit || 'unit'}</span>}
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
          <div className="billing-review-total-line">
            <span>Subtotal</span>
            <strong>{formatCurrency(totals.subtotal)}</strong>
          </div>

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

          <div className="billing-review-total-line billing-review-total-line--grand">
            <span>Total</span>
            <strong>{formatCurrency(totals.total)}</strong>
          </div>
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
        <SignaturePad
          value={signatureStrokes}
          onChange={setSignatureStrokes}
          required={signatureRequired}
        />
      ) : null}

      <footer className="billing-bottom-bar billing-bottom-bar--review">
        <button type="button" onClick={onBack} className="billing-footer-icon billing-footer-icon--wide">
          <ArrowLeft className="h-5 w-5" />
          <span>Back</span>
        </button>
        <button
          type="button"
          onClick={() => handleCheckout(false)}
          disabled={items.length === 0 || isPending || isSavingSignature}
          className="billing-save-button"
        >
          {isPending || isSavingSignature ? 'Saving...' : 'Save & Finish'}
          <CheckCircle2 className="h-5 w-5" />
        </button>
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
                handleCheckout(true);
              }}
              loading={isPending}
            >
              Yes, Create Another
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ReviewStep;
