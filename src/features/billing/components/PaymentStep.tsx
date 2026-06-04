import React, { useMemo } from 'react';
import { ArrowRight, Banknote, ChevronDown, CreditCard, HelpCircle, IndianRupee, QrCode, User } from 'lucide-react';
import { useCartStore } from '../stores/cartStore';
import { formatCurrency } from '@/lib/utils';

interface PaymentStepProps {
  onNext: () => void;
  upiRef: string;
  setUpiRef: (val: string) => void;
  chequeNumber: string;
  setChequeNumber: (val: string) => void;
  notes: string;
  setNotes: (val: string) => void;
}

const getLineTotal = (item: { base_unit_price: number; discount_percentage: number; quantity: number }) => {
  const unitPrice = Number((item.base_unit_price * (1 - item.discount_percentage / 100)).toFixed(2));
  return unitPrice * item.quantity;
};

export const PaymentStep: React.FC<PaymentStepProps> = ({
  onNext,
  upiRef,
  setUpiRef,
  chequeNumber,
  setChequeNumber,
  notes,
  setNotes,
}) => {
  const [showNotes, setShowNotes] = React.useState(false);
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
    setGstEnabled,
    setDiscount,
    setAmountPaid,
    setPaymentType,
  } = useCartStore();

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + getLineTotal(item), 0);
    const gstAmount = gstEnabled
      ? items.reduce((sum, item) => sum + (getLineTotal(item) * item.gst_rate) / 100, 0)
      : 0;

    return {
      subtotal,
      gstAmount,
      total: Math.max(0, subtotal + gstAmount - discountAmount),
    };
  }, [discountAmount, gstEnabled, items]);

  const balanceDue = Math.max(0, totals.total - amountPaid);
  const projectedDue = Math.max(0, farmerTotalDue + totals.total - amountPaid);
  const isWalkIn = farmerId === null;

  const handlePaymentTypeChange = (type: string) => {
    setPaymentType(type);
    if (type === 'credit') {
      setAmountPaid(0);
    } else {
      setAmountPaid(totals.total);
    }
  };

  const handleAmountPaidChange = (value: number) => {
    setAmountPaid(Math.min(Math.max(0, Number.isNaN(value) ? 0 : value), totals.total));
  };

  const paymentOptions = [
    { id: 'cash', label: 'Cash', icon: Banknote },
    { id: 'upi', label: 'UPI', icon: QrCode },
    { id: 'credit', label: 'Credit', icon: User, disabled: isWalkIn },
    { id: 'other', label: 'Other', icon: HelpCircle },
  ];

  return (
    <div className="billing-step-content lg:px-8 lg:pb-8">
      <section className="billing-payment-card">
        <div className="billing-payment-card__summary">
          <div>
            <div className="text-sm font-bold text-slate-600">Total Amount</div>
            <div className="mt-1 text-4xl font-black tracking-tight text-slate-950">{formatCurrency(totals.total)}</div>
          </div>
        </div>

        <div className="billing-payment-card__body">
          <h2 className="billing-section-title">Payment Method</h2>
          <div className="billing-payment-grid">
            {paymentOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = paymentType === option.id;

              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={option.disabled}
                  onClick={() => handlePaymentTypeChange(option.id)}
                  className={isSelected ? 'billing-payment-tile billing-payment-tile--active' : 'billing-payment-tile'}
                >
                  <Icon className="h-6 w-6" />
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>

          <label className="billing-field">
            <span>Amount Paid</span>
            <div className="billing-field__input">
              <input
                type="number"
                value={amountPaid || ''}
                onChange={(event) => handleAmountPaidChange(Number(event.target.value))}
                placeholder="0"
              />
              <IndianRupee className="h-4 w-4 text-slate-500" />
            </div>
          </label>

          {paymentType === 'upi' ? (
            <label className="billing-field">
              <span>UPI Reference</span>
              <div className="billing-field__input">
                <input value={upiRef} onChange={(event) => setUpiRef(event.target.value)} placeholder="Transaction ID" />
              </div>
            </label>
          ) : null}

          {paymentType === 'other' ? (
            <label className="billing-field">
              <span>Cheque / Other Reference</span>
              <div className="billing-field__input">
                <input value={chequeNumber} onChange={(event) => setChequeNumber(event.target.value)} placeholder="Reference number" />
              </div>
            </label>
          ) : null}

          <div className="billing-balance-row">
            <span>Balance Due</span>
            <strong className={balanceDue > 0 ? 'text-rose-500' : 'text-emerald-600'}>{formatCurrency(balanceDue)}</strong>
          </div>
        </div>
      </section>


      {!isWalkIn ? (
        <section className="billing-collapsed-card">
          <div className="text-sm font-black text-slate-950">{farmerName}</div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-bold text-slate-600">
            <div className="rounded-2xl bg-slate-50 p-3">
              Previous
              <strong className="mt-1 block text-sm text-slate-950">{formatCurrency(farmerTotalDue)}</strong>
            </div>
            <div className="rounded-2xl bg-sky-50 p-3 text-sky-700">
              This Bill
              <strong className="mt-1 block text-sm">{formatCurrency(totals.total)}</strong>
            </div>
            <div className="rounded-2xl bg-rose-50 p-3 text-rose-700">
              New Due
              <strong className="mt-1 block text-sm">{formatCurrency(projectedDue)}</strong>
            </div>
          </div>
          <div className="mt-3 text-xs font-semibold text-slate-500">
            Credit limit: {farmerCreditLimit > 0 ? formatCurrency(farmerCreditLimit) : 'No limit set'}
          </div>
        </section>
      ) : null}



      <footer className="billing-bottom-bar">
        <div className="min-w-0 flex-shrink-0">
          <div className="text-2xl font-black leading-tight whitespace-nowrap">{formatCurrency(balanceDue)}</div>
          <div className="text-sm font-black text-sky-100 whitespace-nowrap">Balance Due</div>
        </div>
        <button type="button" onClick={onNext} disabled={items.length === 0} className="billing-bottom-bar__primary billing-bottom-bar__primary--light flex-shrink">
          Continue to Review
          <ArrowRight className="h-6 w-6" />
        </button>
      </footer>
    </div>
  );
};

export default PaymentStep;
