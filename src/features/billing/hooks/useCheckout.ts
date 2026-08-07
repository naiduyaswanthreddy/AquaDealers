import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { useBranchStore } from '@/stores/branchStore';
import { useOfflineBillStore, generateTempBillNumber, isNetworkError } from '../offline/offlineBillStore';
import { useCartStore } from '../stores/cartStore';
import { useCreateBill } from './useBilling';
import { billingService } from '../services/billingService';

import { BillingPayload } from '../types';
import type { SignatureStroke } from '@/types/database';
import { supabase } from '@/lib/supabase';
import { getLocalDateString } from '@/lib/utils';
import { upsertFarmerProductDiscount } from '@/features/farmers/services/farmerService';

interface CheckoutOptions {
  totals: {
    subtotal: number;
    gstAmount: number;
    total: number;
  };
  signatureStrokes?: SignatureStroke[];
  sigCanvasDims?: { w: number; h: number };
  ignoreCreditLimitWarning?: boolean;
  ignoreDuplicateWarning?: boolean;
  mode?: 'sign' | 'transport' | 'in_person';
  onSuccess: (data: {
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

export const useCheckout = () => {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { activeBranch } = useBranchStore();
  const { mutateAsync: createBill, isPending: isSubmitting } = useCreateBill();
  const queueOfflineBill = useOfflineBillStore((s) => s.queueBill);
  const idempotencyKeyRef = useRef<string | null>(null);
  const [isSavingSignature, setIsSavingSignature] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<{ show: boolean; farmerName: string; amount: number } | null>(null);
  const [creditLimitWarning, setCreditLimitWarning] = useState<{ show: boolean; farmerName: string; projectedDue: number; creditLimit: number } | null>(null);

  const {
    items,
    farmerId,
    farmerName,
    farmerTotalDue,
    farmerCreditLimit,
    gstEnabled,
    discountAmount,
    settlementDiscountAmount,
    amountPaid,
    paymentType,
    upiRef,
    chequeNumber,
    notes,
    billDate,
    isEstimate,
  } = useCartStore();

  // Send a plain local calendar date (YYYY-MM-DD). The RPC casts bill_date to
  // ::DATE, so a bare date is unambiguous. Appending 'T00:00:00.000Z' (UTC
  // midnight) used to risk the date shifting a day in some timezones. Fall back
  // to today's local date if the cart's billDate is somehow empty.
  const effectiveBillDate = billDate || getLocalDateString();

  const generateIdempotencyKey = () => {
    const key = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    idempotencyKeyRef.current = key;
    return key;
  };

  const buildPayload = useCallback((overrideTotals: {
    subtotal: number;
    gstAmount: number;
    total: number;
  }): BillingPayload | null => {
    if (!user?.id) return null;

    const { subtotal, gstAmount, total } = overrideTotals;
    const effectiveTotal = Math.max(0, total - (settlementDiscountAmount || 0));
    const projectedDue = Math.max(0, farmerTotalDue + effectiveTotal - amountPaid);
    const exceedsCreditLimit = !!farmerId && farmerCreditLimit > 0 && projectedDue > farmerCreditLimit;

    return {
      dealer_id: user.id,
      branch_id: activeBranch?.id,
      farmer_id: farmerId,
      farmer_name_snapshot: farmerName,
      bill_date: effectiveBillDate,
      subtotal,
      gst_amount: gstAmount,
      cgst_amount: gstAmount / 2,
      sgst_amount: gstAmount / 2,
      igst_amount: 0,
      discount_amount: discountAmount,
      settlement_discount_amount: settlementDiscountAmount || undefined,
      total,
      amount_paid: amountPaid,
      payment_type: amountPaid > 0 ? paymentType : null,
      credit_override_used: exceedsCreditLimit,
      credit_override_reason: exceedsCreditLimit ? 'Dealer override from checkout' : null,
      upi_ref: paymentType === 'upi' ? upiRef : null,
      cheque_number: paymentType === 'other' ? chequeNumber : null,
      notes: notes || null,
      is_estimate: isEstimate || undefined,
      reduce_stock: isEstimate ? false : undefined,
      items: items.map(
        ({ inventory_id, product_id, product_name, hsn_code, quantity, base_unit_price, discount_percentage, gst_rate, mrp, discount_source, discount_label, default_discount_percentage, farmer_discount_percentage }) => ({
          inventory_id,
          product_id,
          product_name,
          hsn_code,
          quantity,
          base_unit_price,
          mrp,
          unit_price: Number((base_unit_price * (1 - discount_percentage / 100)).toFixed(2)),
          discount_percentage,
          discount_source,
          discount_label,
          default_discount_percentage,
          farmer_discount_percentage,
          gst_rate: gstEnabled ? gst_rate : 0,
        })
      ),
    };
  }, [activeBranch?.id, amountPaid, chequeNumber, discountAmount, settlementDiscountAmount, farmerCreditLimit, farmerId, farmerName, farmerTotalDue, gstEnabled, isEstimate, items, notes, paymentType, effectiveBillDate, upiRef, user?.id]);

  const handleCheckout = async (options: CheckoutOptions) => {
    const { totals, signatureStrokes = [], sigCanvasDims, ignoreCreditLimitWarning = false, ignoreDuplicateWarning = false, mode = 'sign', onSuccess } = options;
    const effectiveTotal = Math.max(0, totals.total - (settlementDiscountAmount || 0));
    const balanceDue = Math.max(0, effectiveTotal - amountPaid);

    if (!items.length || !user?.id) return;

    // Guard: verify the Supabase session is still alive before calling the
    // RPC. An expired JWT causes "Dealer access denied" from auth.uid()=NULL.
    const { data: { session: liveSession } } = await supabase.auth.getSession();
    if (!liveSession) {
      toast.error('Your session has expired. Please log in again.');
      useAuthStore.getState().clearSession();
      useAuthStore.getState().setUser(null);
      return;
    }

    if (amountPaid > totals.total) {
      toast.error(t('billing.errorOverpaid', 'Amount paid cannot exceed the total.'));
      return;
    }
    if (farmerId === null && amountPaid < effectiveTotal) {
      toast.error(t('billing.walkinFullPayment', 'Walk-in bills must be paid in full.'));
      return;
    }
    
    const signatureEnabled = user?.bill_signature_enabled ?? true;
    const signatureRequired = signatureEnabled && (paymentType === 'credit' || balanceDue > 0);
    if (signatureRequired && mode === 'sign' && signatureStrokes.length === 0) {
      toast.error('Customer signature is required for credit or pending bills.');
      return;
    }

    const projectedDue = Math.max(0, farmerTotalDue + effectiveTotal - amountPaid);
    const overLimit = !!farmerId && farmerCreditLimit > 0 && projectedDue > farmerCreditLimit;
    if (!ignoreCreditLimitWarning && overLimit) {
      setCreditLimitWarning({
        show: true,
        farmerName: farmerName || 'this farmer',
        projectedDue,
        creditLimit: farmerCreditLimit,
      });
      return;
    }

    if (!ignoreDuplicateWarning && farmerId && navigator.onLine) {
      try {
        const billStart = new Date(`${billDate}T00:00:00.000Z`);
        const billEnd = new Date(`${billDate}T23:59:59.999Z`);
        
        const { data: recentBills } = await supabase
          .from('bills')
          .select('total, created_at')
          .eq('farmer_id', farmerId)
          .eq('dealer_id', user.id)
          .gte('created_at', billStart.toISOString())
          .lte('created_at', billEnd.toISOString());

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

    const payload = buildPayload(totals);
    if (!payload) return;

    payload.idempotency_key = generateIdempotencyKey();
    
    if (mode === 'transport') {
      payload.is_verified = false;
      payload.verification_method = 'pin';
      payload.delivery_pin = Math.floor(1000 + Math.random() * 9000).toString();
    } else {
      payload.is_verified = true;
      payload.verification_method = signatureEnabled && signatureStrokes.length > 0 ? 'signature' : 'in_person';
    }

    if (navigator.vibrate) navigator.vibrate(50);

    const saveOffline = async () => {
      const clientRef = crypto.randomUUID();
      const tempBillNumber = generateTempBillNumber();
      await queueOfflineBill({
        clientRef,
        tempBillNumber,
        payload,
        signatureStrokes: signatureEnabled && signatureStrokes.length > 0 ? signatureStrokes : null,
        signerName: farmerName || 'Walk-in Customer',
        farmerName,
        total: totals.total,
        amountPaid,
        balanceDue,
      });
      toast.success(t('billing.savedOffline', 'No internet — bill saved on this device and will sync automatically.'));
      onSuccess({
        billId: clientRef,
        billNumber: tempBillNumber,
        total: totals.total,
        amountPaid,
        balanceDue,
        farmerName,
        billDate: effectiveBillDate,
        isOffline: true,
      });
    };

    if (!navigator.onLine) {
      try {
        await saveOffline();
      } catch (error: any) {
        toast.error(error.message || t('common.error', 'Something went wrong.'));
      }
      return;
    }

    try {
      const result = await createBill(payload);

      if (signatureEnabled && signatureStrokes.length > 0) {
        setIsSavingSignature(true);
        await billingService.saveBillSignature({
          dealerId: user.id,
          branchId: activeBranch?.id,
          billId: result.bill_id,
          signerName: farmerName || 'Walk-in Customer',
          signatureData: signatureStrokes,
          canvasWidth: sigCanvasDims?.w,
          canvasHeight: sigCanvasDims?.h,
        });
      }

      // Write back manually-set or farmer-specific discounts so next bill auto-populates them
      if (farmerId && user.farmer_product_discounts_enabled) {
        const medicineItems = items.filter(i => i.product_type === 'medicine' && i.product_id);
        if (medicineItems.length > 0) {
          Promise.all(
            medicineItems.map(item =>
              upsertFarmerProductDiscount({
                dealerId: user.id,
                farmerId,
                productId: item.product_id,
                discountPercentage: item.discount_percentage,
              })
            )
          ).catch(err => console.error('Failed to save farmer discounts:', err));
        }
      }

      toast.success(t('billing.success', 'Bill created successfully.'));
      onSuccess({
        billId: result.bill_id,
        billNumber: result.bill_number,
        total: totals.total,
        amountPaid,
        balanceDue,
        farmerName,
        billDate: effectiveBillDate,
      });
    } catch (error: any) {
      if (isNetworkError(error)) {
        try {
          await saveOffline();
          return;
        } catch (offlineError) {
          console.error('Failed to save bill offline:', offlineError);
        }
      }
      toast.error(error.message || t('common.error', 'Something went wrong.'));
    } finally {
      setIsSavingSignature(false);
    }
  };

  return {
    handleCheckout,
    buildPayload,
    isSubmitting,
    isSavingSignature,
    duplicateWarning,
    setDuplicateWarning,
    creditLimitWarning,
    setCreditLimitWarning,
  };
};
