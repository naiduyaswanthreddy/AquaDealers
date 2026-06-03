import React, { useMemo } from 'react';
import { Minus, Plus, Receipt, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button, EmptyState, Input } from '@/components/ui';
import { SectionCard } from '@/components/layout/SectionCard';
import { formatCurrency } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useBranchStore } from '@/stores/branchStore';
import { useCreateBill } from '../hooks/useBilling';
import { useCartStore } from '../stores/cartStore';

export const CartSidebar: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { activeBranch } = useBranchStore();
  const { mutateAsync: createBill, isPending } = useCreateBill();
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
    updateQuantity,
    updateItemDiscount,
    removeItem,
    setGstEnabled,
    setDiscount,
    setAmountPaid,
    setPaymentType,
    clearCart,
  } = useCartStore();

  const totals = useMemo(() => {
    let originalSubtotal = 0;
    let subtotal = 0;
    let gstAmount = 0;
    let itemDiscountAmount = 0;

    items.forEach((item) => {
      const discountedUnitPrice = Number((item.base_unit_price * (1 - item.discount_percentage / 100)).toFixed(2));
      const originalLineTotal = item.base_unit_price * item.quantity;
      const lineTotal = discountedUnitPrice * item.quantity;

      originalSubtotal += originalLineTotal;
      subtotal += lineTotal;
      itemDiscountAmount += originalLineTotal - lineTotal;

      if (gstEnabled) {
        gstAmount += (lineTotal * item.gst_rate) / 100;
      }
    });

    const overallDiscount = itemDiscountAmount + discountAmount;

    return {
      originalSubtotal,
      subtotal,
      itemDiscountAmount,
      gstAmount,
      overallDiscount,
      total: Math.max(0, subtotal + gstAmount - discountAmount),
    };
  }, [discountAmount, gstEnabled, items]);

  const projectedDue = Math.max(0, farmerTotalDue + totals.total - amountPaid);
  const exceedsCreditLimit = !!farmerId && farmerCreditLimit > 0 && projectedDue > farmerCreditLimit;

  const handleCheckout = async () => {
    if (!items.length || !user?.id) return;
    if (amountPaid > totals.total) {
      toast.error(t('billing.errorOverpaid', 'Amount paid cannot exceed the total.'));
      return;
    }
    if (farmerId === null && amountPaid < totals.total) {
      toast.error(t('billing.walkinFullPayment', 'Walk-in bills must be paid in full.'));
      return;
    }
    if (exceedsCreditLimit) {
      const proceed = window.confirm(
        `This bill will exceed the farmer credit limit by ${formatCurrency(projectedDue - farmerCreditLimit)}. Do you want to continue?`
      );
      if (!proceed) {
        return;
      }
    }

    try {
      const result = await createBill({
        dealer_id: user.id,
        branch_id: activeBranch?.id,
        farmer_id: farmerId,
        farmer_name_snapshot: farmerName,
        bill_date: new Date().toISOString().slice(0, 10),
        subtotal: totals.subtotal,
        gst_amount: totals.gstAmount,
        cgst_amount: totals.gstAmount / 2,
        sgst_amount: totals.gstAmount / 2,
        igst_amount: 0,
        discount_amount: totals.overallDiscount,
        total: totals.total,
        amount_paid: amountPaid,
        payment_type: amountPaid > 0 ? paymentType : null,
        credit_override_used: exceedsCreditLimit,
        credit_override_reason: exceedsCreditLimit ? 'Dealer override from checkout' : null,
        items: items.map(
          ({ inventory_id, product_id, product_name, hsn_code, quantity, base_unit_price, discount_percentage, gst_rate }) => ({
            inventory_id,
            product_id,
            product_name,
            hsn_code,
            quantity,
            unit_price: Number((base_unit_price * (1 - discount_percentage / 100)).toFixed(2)),
            gst_rate: gstEnabled ? gst_rate : 0,
          })
        ),
      });
      toast.success(t('billing.success', 'Bill created successfully.'));
      clearCart();
      if (result?.bill_id) {
        navigate(`/bills/${result.bill_id}`);
      }
    } catch (error: any) {
      toast.error(error.message || t('common.error', 'Something went wrong.'));
    }
  };

  return (
    <SectionCard
      title={t('billing.cartSummary', 'Cart summary')}
      description={t('billing.cartSummaryDescription', 'Review quantities, discounts, and how much is paid now.')}
      headerAction={
        items.length ? (
          <button type="button" onClick={clearCart} className="text-sm font-bold text-danger hover:text-red-700">
            {t('common.clear', 'Clear')}
          </button>
        ) : null
      }
      className="space-y-4 lg:sticky lg:top-6"
    >
      <div className="rounded-2xl bg-surface px-4 py-3 text-sm">
        <div className="text-xs font-bold uppercase tracking-[0.1em] text-text-muted">{t('billing.customer', 'Customer')}</div>
        <div className="mt-1 text-sm font-bold text-text-primary">{farmerName || 'Walk-in Customer'}</div>
        {farmerId ? (
          <div className="mt-2 flex items-center justify-between text-xs text-text-secondary">
            <span>Current due: {formatCurrency(farmerTotalDue)}</span>
            <span>Limit: {farmerCreditLimit > 0 ? formatCurrency(farmerCreditLimit) : 'No limit'}</span>
          </div>
        ) : null}
      </div>

      {items.length ? (
        <div className="space-y-3">
          {items.map((item) => {
            const discountedUnitPrice = Number((item.base_unit_price * (1 - item.discount_percentage / 100)).toFixed(2));
            const lineTotal = discountedUnitPrice * item.quantity;

            return (
              <div key={item.inventory_id} className="rounded-2xl border border-border bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold text-text-primary">{item.product_name}</h3>
                    <p className="mt-1 text-sm text-text-secondary">
                      {formatCurrency(discountedUnitPrice)} x {item.quantity} {item.unit}
                    </p>
                    {item.discount_percentage > 0 ? (
                      <p className="mt-1 text-xs font-semibold text-success">
                        {item.discount_percentage}% off medicine price
                      </p>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-extrabold text-text-primary">{formatCurrency(lineTotal)}</div>
                    <button type="button" onClick={() => removeItem(item.inventory_id)} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-danger">
                      <Trash2 className="h-3.5 w-3.5" />
                      {t('common.delete', 'Delete')}
                    </button>
                  </div>
                </div>

                {item.product_type === 'medicine' ? (
                  <div className="mt-3">
                    <Input
                      type="number"
                      label={t('billing.itemDiscountPercentage', 'Discount %')}
                      value={item.discount_percentage || ''}
                      onChange={(event) => updateItemDiscount(item.inventory_id, Number(event.target.value))}
                      placeholder="0"
                      inputSize="sm"
                    />
                  </div>
                ) : null}

                <div className="mt-4 flex items-center justify-between">
                  <div className="inline-flex items-center rounded-2xl border border-border bg-surface">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.inventory_id, item.quantity - 1)}
                      aria-label={t('billing.decreaseQuantity', 'Decrease quantity')}
                      className="focus-ring flex h-10 w-10 items-center justify-center text-text-secondary hover:text-text-primary"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-10 text-center text-sm font-bold text-text-primary">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.inventory_id, item.quantity + 1)}
                      disabled={item.quantity >= item.max_quantity}
                      aria-label={t('billing.increaseQuantity', 'Increase quantity')}
                      className="focus-ring flex h-10 w-10 items-center justify-center text-text-secondary hover:text-text-primary disabled:opacity-45"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="text-xs font-medium text-text-secondary">{t('billing.stockAvailable', 'Available')} {item.max_quantity}</div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={Receipt}
          title={t('billing.emptyCart', 'Your cart is empty')}
          description={t('billing.emptyCartDescription', 'Add products from your inventory to start building this bill.')}
          className="py-8"
        />
      )}

      <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between rounded-2xl bg-white px-3 py-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.1em] text-text-muted">{t('billing.gstMode', 'GST billing')}</div>
            <div className="mt-1 text-sm font-semibold text-text-primary">{gstEnabled ? t('billing.gstOn', 'GST on') : t('billing.gstOff', 'GST off')}</div>
          </div>
          <button
            type="button"
            onClick={() => setGstEnabled(!gstEnabled)}
            className={gstEnabled ? 'billing-toggle billing-toggle--active' : 'billing-toggle'}
            aria-pressed={gstEnabled}
          >
            <span className="billing-toggle__thumb" />
          </button>
        </div>
        {totals.originalSubtotal !== totals.subtotal ? (
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">{t('billing.originalSubtotal', 'Original subtotal')}</span>
            <span className="font-bold text-text-primary">{formatCurrency(totals.originalSubtotal)}</span>
          </div>
        ) : null}
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-secondary">{t('billing.subtotal', 'Subtotal')}</span>
          <span className="font-bold text-text-primary">{formatCurrency(totals.subtotal)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-secondary">{t('billing.gstAmount', 'GST amount')}</span>
          <span className="font-bold text-text-primary">{formatCurrency(totals.gstAmount)}</span>
        </div>
        {totals.itemDiscountAmount > 0 ? (
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">{t('billing.medicineDiscounts', 'Medicine discounts')}</span>
            <span className="font-bold text-success">-{formatCurrency(totals.itemDiscountAmount)}</span>
          </div>
        ) : null}
        <Input
          type="number"
          label={t('billing.discount', 'Discount')}
          value={discountAmount || ''}
          onChange={(event) => setDiscount(Number(event.target.value))}
          placeholder="0"
          inputSize="sm"
        />
        <div className="flex items-center justify-between border-t border-border pt-3">
          <span className="text-base font-bold text-text-primary">{t('billing.total', 'Total')}</span>
          <span className="text-xl font-extrabold tracking-[-0.04em] text-primary">{formatCurrency(totals.total)}</span>
        </div>
      </div>

      <div className="space-y-3">
        <Input type="number" label={t('billing.amountPaidNow', 'Amount paid now')} value={amountPaid || ''} onChange={(event) => setAmountPaid(Number(event.target.value))} placeholder="0" />
        {amountPaid > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {['cash', 'upi', 'bank'].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setPaymentType(type)}
                className={
                  paymentType === type
                    ? 'focus-ring rounded-2xl border border-primary bg-primary px-3 py-3 text-xs font-bold uppercase tracking-[0.12em] text-white transition-all duration-200'
                    : 'focus-ring rounded-2xl border border-border bg-surface px-3 py-3 text-xs font-bold uppercase tracking-[0.12em] text-text-secondary hover:bg-slate-100 transition-all duration-200'
                }
              >
                {type}
              </button>
            ))}
          </div>
        ) : null}
        <div className="flex items-center justify-between rounded-2xl bg-danger-light/55 px-4 py-3 text-sm font-bold text-danger">
          <span>{t('billing.balanceDue', 'Balance due')}</span>
          <span>{formatCurrency(Math.max(0, totals.total - amountPaid))}</span>
        </div>
        {exceedsCreditLimit ? (
          <div className="rounded-2xl border border-warning/30 bg-warning-light px-4 py-3 text-sm font-semibold text-warning">
            Credit limit warning: projected due becomes {formatCurrency(projectedDue)}.
          </div>
        ) : null}
        <Button type="button" size="lg" fullWidth disabled={!items.length} loading={isPending} onClick={handleCheckout}>
          {t('billing.checkout', 'Checkout')}
        </Button>
      </div>
    </SectionCard>
  );
};

export default CartSidebar;
