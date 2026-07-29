import React, { useMemo, useRef, useEffect, useState } from 'react';
import { ArrowRight, Banknote, CreditCard, HelpCircle, QrCode, User, Receipt, ChevronDown } from 'lucide-react';
import { useCartStore } from '../stores/cartStore';
import { formatCurrency } from '@/lib/utils';

interface PaymentStepProps {
  onNext: () => void;
}

const getLineTotal = (item: { base_unit_price: number; discount_percentage: number; quantity: number }) => {
  const unitPrice = Number((item.base_unit_price * (1 - item.discount_percentage / 100)).toFixed(2));
  return unitPrice * item.quantity;
};

export const PaymentStep: React.FC<PaymentStepProps> = ({ onNext }) => {
  const [showNotes, setShowNotes] = React.useState(false);
  const [showItemsBreakdown, setShowItemsBreakdown] = useState(false);
  const [highlightPayment, setHighlightPayment] = useState(true);
  const paymentMethodRef = useRef<HTMLDivElement>(null);
  const lastAutoAmountRef = useRef<number | null>(null);

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
    setAmountPaid,
    setPaymentType,
    setUpiRef,
    setChequeNumber,
    setNotes,
    settlementDiscountAmount,
    setSettlementDiscount,
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

  const effectiveTotal = Math.max(0, totals.total - settlementDiscountAmount);
  const balanceDue = Math.max(0, effectiveTotal - amountPaid);
  const projectedDue = Math.max(0, farmerTotalDue + effectiveTotal - amountPaid);
  const remainingCredit = farmerCreditLimit > 0 ? farmerCreditLimit - projectedDue : null;
  const isWalkIn = farmerId === null;

  // Highlight the payment section on arrival, fade out after 1.2s
  useEffect(() => {
    paymentMethodRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    const t = setTimeout(() => setHighlightPayment(false), 1200);
    return () => clearTimeout(t);
  }, []);

  const handlePaymentTypeChange = (type: string) => {
    setPaymentType(type);
    if (type === 'credit') {
      setAmountPaid(0);
    } else {
      setAmountPaid(Math.max(0, totals.total - settlementDiscountAmount));
    }
  };

  const handleAmountPaidChange = (value: number) => {
    const eff = Math.max(0, totals.total - settlementDiscountAmount);
    setAmountPaid(Math.min(Math.max(0, Number.isNaN(value) ? 0 : value), eff));
  };

  const paymentOptions = [
    { id: 'cash',   label: 'Cash',   icon: Banknote },
    { id: 'upi',    label: 'UPI',    icon: QrCode },
    { id: 'credit', label: 'Credit', icon: User,       disabled: isWalkIn },
    { id: 'other',  label: 'Other',  icon: HelpCircle },
  ];

  // Bill summary card — shown on mobile once a payment type is active
  const BillSummary = () => (
    <section className="lg:hidden bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-4">
      <button
        type="button"
        onClick={() => setShowItemsBreakdown(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 border-b border-slate-100"
      >
        <div className="flex items-center gap-2 text-sm font-black text-slate-700">
          <Receipt className="w-4 h-4 text-primary" />
          Bill Summary · {items.length} item{items.length !== 1 ? 's' : ''}
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showItemsBreakdown ? 'rotate-180' : ''}`} />
      </button>

      {showItemsBreakdown && (
        <div className="px-4 py-3 border-b border-slate-100 space-y-1 max-h-40 overflow-y-auto">
          {items.map((item, i) => {
            const unitPrice = Number((item.base_unit_price * (1 - item.discount_percentage / 100)).toFixed(2));
            return (
              <div key={item.inventory_id} className="flex items-center gap-2 text-xs">
                <span className="w-5 text-slate-400 font-bold shrink-0 tabular-nums">{i + 1}.</span>
                <span className="flex-1 truncate text-slate-700 font-bold">{item.product_name}</span>
                <span className="text-slate-500 shrink-0">{item.quantity} × {formatCurrency(unitPrice)}</span>
                <span className="font-black text-slate-800 shrink-0 w-20 text-right tabular-nums">{formatCurrency(getLineTotal(item))}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="px-4 py-3 space-y-2">
        <div className="flex justify-between text-xs font-bold text-slate-500">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatCurrency(totals.subtotal)}</span>
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between text-xs font-bold text-emerald-600">
            <span>Discount</span>
            <span className="tabular-nums">-{formatCurrency(discountAmount)}</span>
          </div>
        )}
        {settlementDiscountAmount > 0 && (
          <div className="flex justify-between text-xs font-bold text-emerald-600">
            <span>Settlement Discount</span>
            <span className="tabular-nums">-{formatCurrency(settlementDiscountAmount)}</span>
          </div>
        )}
        {gstEnabled && totals.gstAmount > 0 && (
          <div className="flex justify-between text-xs font-bold text-slate-500">
            <span>GST</span>
            <span className="tabular-nums">{formatCurrency(totals.gstAmount)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-slate-100">
          <span>{settlementDiscountAmount > 0 ? 'Effective Total' : 'Total'}</span>
          <span className="tabular-nums">{formatCurrency(effectiveTotal)}</span>
        </div>

        {/* Payment status — shown once amount is entered */}
        {amountPaid > 0 && (
          <div className="mt-2 pt-2 border-t border-dashed border-slate-200 space-y-1.5">
            <div className="flex justify-between text-xs font-bold text-emerald-700">
              <span>Amount Received</span>
              <span className="tabular-nums">{formatCurrency(amountPaid)}</span>
            </div>
            <div className={`flex justify-between text-sm font-black ${balanceDue > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              <span>Balance Due</span>
              <span className="tabular-nums">{formatCurrency(balanceDue)}</span>
            </div>
          </div>
        )}

        {/* Farmer dues context */}
        {!isWalkIn && (
          <div className={`mt-2 pt-2 border-t border-slate-100 grid gap-2 ${farmerCreditLimit > 0 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <div className="rounded-lg bg-slate-50 px-2.5 py-2">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Prev. Arrears</div>
              <div className="text-xs font-black text-slate-700 tabular-nums mt-0.5">{formatCurrency(farmerTotalDue)}</div>
            </div>
            <div className={`rounded-lg px-2.5 py-2 ${projectedDue > 0 ? 'bg-rose-50' : 'bg-emerald-50'}`}>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Due</div>
              <div className={`text-xs font-black tabular-nums mt-0.5 ${projectedDue > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{formatCurrency(projectedDue)}</div>
            </div>
            {farmerCreditLimit > 0 && (
              <div className={`rounded-lg px-2.5 py-2 ${remainingCredit !== null && remainingCredit < 0 ? 'bg-rose-50' : 'bg-emerald-50'}`}>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rem. Credit</div>
                <div className={`text-xs font-black tabular-nums mt-0.5 ${remainingCredit !== null && remainingCredit < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                  {remainingCredit !== null ? formatCurrency(remainingCredit) : '—'}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );

  return (
    <div className="flex-1 min-h-0 w-full h-full lg:px-8 lg:pb-8 lg:grid lg:grid-cols-[1.35fr_1fr] lg:gap-8 lg:items-stretch lg:overflow-hidden">

      {/* LEFT COLUMN / MAIN MOBILE FORM */}
      <div className="flex flex-col w-full h-full max-h-full overflow-y-auto lg:pr-2 pb-32 lg:pb-0 scrollbar-thin">

        {/* Mobile: total amount header */}
        <div className="px-4 pt-4 pb-3 lg:hidden">
          <div className="flex items-end justify-between px-1">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Amount to Pay</div>
            <div className="text-3xl font-black tracking-tighter text-slate-900 leading-none tabular-nums">{formatCurrency(effectiveTotal)}</div>
          </div>
        </div>

        <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-6 lg:p-10 mx-4 lg:mx-0">
          {/* Desktop-only total header */}
          <div className="mb-6 border-b border-slate-100 pb-5 text-center sm:text-left hidden lg:flex flex-col sm:flex-row sm:items-end justify-between gap-1">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Amount to Pay</div>
            <div className="text-4xl font-black tracking-tighter text-slate-900 leading-none">{formatCurrency(effectiveTotal)}</div>
          </div>

          {/* Payment method — highlighted on arrival */}
          <div ref={paymentMethodRef}>
            <h2 className="text-sm font-black text-slate-800 mb-3">Select Payment Method</h2>
            <div
              className={`grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6 rounded-2xl transition-all duration-700 ${
                highlightPayment ? 'ring-2 ring-primary/30 ring-offset-2' : 'ring-0'
              }`}
            >
              {paymentOptions.map((option) => {
                const Icon = option.icon;
                const isSelected = paymentType === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={option.disabled}
                    onClick={() => handlePaymentTypeChange(option.id)}
                    className={`relative flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all h-12 ${
                      isSelected
                        ? 'border-primary bg-primary/5 text-primary shadow-sm z-10'
                        : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200 hover:bg-slate-50 disabled:opacity-40'
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${isSelected ? 'text-primary' : 'text-slate-400'}`} />
                    <span className="font-bold text-sm">{option.label}</span>
                    {isSelected && <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-4 max-w-lg">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">Amount Received</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400">₹</div>
                <input
                  type="number"
                  value={amountPaid || ''}
                  onChange={(event) => handleAmountPaidChange(Number(event.target.value))}
                  className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-lg font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all shadow-sm"
                  placeholder="0.00"
                />
              </div>
            </div>

            {paymentType !== 'credit' && (
              <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Settlement Discount <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400">₹</div>
                  <input
                    type="number"
                    min="0"
                    max={totals.total}
                    value={settlementDiscountAmount || ''}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      const clamped = Math.min(Math.max(0, Number.isNaN(v) ? 0 : v), totals.total);
                      setSettlementDiscount(clamped);
                      const untouched = amountPaid === totals.total || amountPaid === lastAutoAmountRef.current;
                      if (untouched) {
                        const newAmount = Math.max(0, totals.total - clamped);
                        lastAutoAmountRef.current = newAmount;
                        setAmountPaid(newAmount);
                      }
                    }}
                    className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-lg font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white transition-all shadow-sm"
                    placeholder="0.00"
                  />
                </div>
                {settlementDiscountAmount > 0 && (
                  <p className="mt-1.5 text-xs font-bold text-emerald-600">
                    Effective total: {formatCurrency(effectiveTotal)}
                  </p>
                )}
              </div>
            )}

          {paymentType === 'upi' && (
              <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                <label className="text-xs font-bold text-slate-700 block mb-1.5">UPI Reference / Transaction ID</label>
                <input
                  value={upiRef}
                  onChange={(event) => setUpiRef(event.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                  placeholder="e.g. 31234567890"
                />
              </div>
            )}

            {paymentType === 'other' && (
              <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                <label className="text-xs font-bold text-slate-700 block mb-1.5">Cheque / Other Reference Note</label>
                <input
                  value={chequeNumber}
                  onChange={(event) => setChequeNumber(event.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                  placeholder="e.g. Cheque #000123"
                />
              </div>
            )}
          </div>
        </section>

        {/* Mobile: bill summary below payment */}
        <div className="px-4 pt-3 lg:hidden">
          <BillSummary />
        </div>
      </div>

      {/* RIGHT COLUMN: Order Summary (desktop only) */}
      <div className="hidden lg:flex flex-col h-full max-h-full min-h-0">
        <section className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden flex flex-col flex-1 h-full max-h-full">
          <div className="p-6 bg-gradient-to-br from-slate-50 to-white border-b border-slate-100">
            <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" /> Order Summary
            </h3>
          </div>

          <div className="p-6 space-y-4 flex-1 overflow-y-auto scrollbar-thin">
            <div className="flex justify-between text-sm font-bold text-slate-500">
              <span>Subtotal ({items.length} items)</span>
              <span className="text-slate-800 tabular-nums">{formatCurrency(totals.subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-sm font-bold text-emerald-600 bg-emerald-50 p-2 -mx-2 rounded-lg">
                <span>Total Discount</span>
                <span className="tabular-nums">-{formatCurrency(discountAmount)}</span>
              </div>
            )}
            {settlementDiscountAmount > 0 && (
              <div className="flex justify-between text-sm font-bold text-emerald-600 bg-emerald-50 p-2 -mx-2 rounded-lg">
                <span>Settlement Discount</span>
                <span className="tabular-nums">-{formatCurrency(settlementDiscountAmount)}</span>
              </div>
            )}
            {gstEnabled && (
              <div className="flex justify-between text-sm font-bold text-slate-500">
                <span>GST Taxes</span>
                <span className="text-slate-800 tabular-nums">{formatCurrency(totals.gstAmount)}</span>
              </div>
            )}
            <div className="pt-4 mt-4 border-t-2 border-dashed border-slate-200 flex justify-between items-center">
              <span className="font-black text-slate-800">Final Amount</span>
              <span className="text-2xl font-black text-slate-900 tabular-nums">{formatCurrency(effectiveTotal)}</span>
            </div>

            {/* Farmer Account Details */}
            {!isWalkIn && (
              <div className="mt-8 p-5 bg-gradient-to-b from-blue-50/50 to-slate-50 rounded-2xl border border-blue-100/50 shadow-sm">
                <div className="text-[10px] font-black text-primary uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> Customer Account
                </div>
                <div className="font-black text-slate-800 text-lg mb-4">{farmerName}</div>

                <div className="space-y-3">
                  <div className="flex justify-between text-sm font-bold">
                    <span className="text-slate-500">Previous Arrears</span>
                    <span className="text-slate-800 tabular-nums">{formatCurrency(farmerTotalDue)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-black text-rose-600 pt-3 border-t border-slate-200/60">
                    <span>Projected Total Due</span>
                    <span className="tabular-nums">{formatCurrency(projectedDue)}</span>
                  </div>
                  {farmerCreditLimit > 0 && (
                    <div className="flex justify-between text-sm font-bold pt-2 border-t border-slate-200/60">
                      <span className="text-slate-500">Credit Limit</span>
                      <span className="text-slate-700 tabular-nums">{formatCurrency(farmerCreditLimit)}</span>
                    </div>
                  )}
                  {remainingCredit !== null && (
                    <div className={`flex justify-between text-sm font-black pt-2 border-t border-slate-200/60 ${remainingCredit < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      <span>Remaining Credit</span>
                      <span className="tabular-nums">{formatCurrency(remainingCredit)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="p-6 bg-slate-50 border-t border-slate-100 shrink-0">
            <div className="flex justify-between items-center mb-5 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-sm font-bold text-slate-600">Balance Remaining</span>
              <span className={`text-2xl font-black tabular-nums ${balanceDue > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {formatCurrency(balanceDue)}
              </span>
            </div>
            <button
              onClick={onNext}
              className="w-full bg-primary hover:bg-primary/90 text-white font-black py-4 px-6 rounded-xl shadow-[0_8px_20px_rgba(37,99,235,0.2)] transition-all hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2 group text-base"
            >
              Review & Finalize Bill
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" strokeWidth={3} />
            </button>
          </div>
        </section>
      </div>

      {/* MOBILE BOTTOM BAR */}
      <footer className="billing-bottom-bar lg:!hidden">
        <div className="min-w-0 flex-shrink-0">
          <div className={`text-2xl font-black leading-tight whitespace-nowrap tabular-nums ${balanceDue > 0 ? 'text-white' : 'text-emerald-300'}`}>
            {formatCurrency(balanceDue)}
          </div>
          <div className="text-[10px] font-black text-sky-100 uppercase tracking-widest mt-0.5">
            {balanceDue > 0 ? 'Balance Remaining' : 'Fully Paid'}
          </div>
        </div>
        <button type="button" onClick={onNext} className="billing-bottom-bar__primary flex-shrink !bg-white !text-blue-600 group">
          Review Bill
          <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" strokeWidth={3} />
        </button>
      </footer>
    </div>
  );
};

export default PaymentStep;
