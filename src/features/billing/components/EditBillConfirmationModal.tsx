import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Bill } from '@/types/database';
import { formatCurrency } from '@/lib/utils';
import { AlertCircle, ArrowRight, Loader2, Save } from 'lucide-react';
import { billingService } from '../services/billingService';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';

interface EditBillConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  bill: Bill;
  edits: any[];
  billDate?: string;
  payment?: { amount_paid: number; payment_type: string | null };
  onSuccess: () => void;
}

export const EditBillConfirmationModal: React.FC<EditBillConfirmationModalProps> = ({
  isOpen,
  onClose,
  bill,
  edits,
  billDate: editedBillDate,
  payment,
  onSuccess
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const billDate = editedBillDate || bill.bill_date || '';
  const dealerId = useAuthStore(state => state.user?.id);

  const calculateFinancialImpact = () => {
    let diffTotal = 0;
    edits.forEach(edit => {
      const oldLineSubtotal = edit.old_quantity * edit.old_unit_price;
      const newLineSubtotal = edit.quantity * edit.unit_price;
      
      // We need original GST rate to accurately calculate, but roughly:
      // Let's assume we show the user the rough estimate, but the backend will be exact.
      diffTotal += (newLineSubtotal - oldLineSubtotal);
    });
    // This is just for display summary, exact diff is returned by backend.
    return diffTotal;
  };

  const handleConfirm = async () => {
    if (!dealerId) return;
    
    setIsSubmitting(true);
    try {
      const dateChanged = billDate && billDate !== bill.bill_date;
      if (edits.length > 0 || dateChanged) await billingService.editBill({
        bill_id: bill.id,
        dealer_id: dealerId,
        bill_date: billDate || undefined,
        edits: edits.map(e => ({
          bill_item_id: e.bill_item_id,
          quantity: e.quantity,
          unit_price: e.unit_price
        }))
      });
      if (payment && (payment.amount_paid !== Number(bill.amount_paid) || payment.payment_type !== bill.payment_type)) await billingService.editBillPayment({ bill_id: bill.id, ...payment });
      
      toast.success('Bill successfully updated!');
      onSuccess();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Failed to update bill');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={isSubmitting ? () => {} : onClose} title="Confirm Bill Edits">
      <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl mb-6 flex gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
        <div className="text-sm text-blue-900">
          <p className="font-bold mb-1">Please review these changes carefully</p>
          <p>These edits will permanently alter the bill, adjust inventory levels, and modify the farmer's outstanding balance.</p>
        </div>
      </div>

      <div className="space-y-4 mb-8">
        {payment && (payment.amount_paid !== Number(bill.amount_paid) || payment.payment_type !== bill.payment_type) ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <div className="text-[10px] font-bold uppercase text-emerald-700">Payment change</div>
            <div className="mt-1 grid gap-2 text-sm sm:grid-cols-2">
              <div><span className="text-slate-500">Amount received: </span><span className="line-through text-slate-500">{formatCurrency(Number(bill.amount_paid || 0))}</span><ArrowRight className="mx-1 inline h-3.5 w-3.5 text-slate-400" /><span className="font-bold text-emerald-700">{formatCurrency(payment.amount_paid)}</span></div>
              <div><span className="text-slate-500">Method: </span><span className="line-through text-slate-500">{bill.payment_type || 'None'}</span><ArrowRight className="mx-1 inline h-3.5 w-3.5 text-slate-400" /><span className="font-bold capitalize text-emerald-700">{payment.payment_type || 'None'}</span></div>
            </div>
          </div>
        ) : null}
        {billDate !== bill.bill_date ? (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <div className="text-[10px] font-bold uppercase text-blue-600">Bill date change</div>
            <div className="mt-1 flex items-center gap-2 text-sm"><span className="text-slate-500">{bill.bill_date}</span><ArrowRight className="h-3.5 w-3.5 text-slate-400" /><span className="font-bold text-blue-700">{billDate}</span></div>
          </div>
        ) : null}
        <h4 className="font-bold text-slate-800 text-sm border-b pb-2">Item Changes</h4>
        {edits.map((edit, idx) => {
          const qtyChanged = edit.quantity !== edit.old_quantity;
          const priceChanged = edit.unit_price !== edit.old_unit_price;

          return (
            <div key={idx} className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div className="font-bold text-sm text-slate-800 mb-2">{edit.product_name}</div>
              <div className="grid grid-cols-2 gap-4">
                {qtyChanged && (
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Quantity</div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="line-through text-slate-500">{edit.old_quantity}</span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                      <span className="font-bold text-blue-600">{edit.quantity}</span>
                      <span className="text-xs text-slate-500">
                        ({edit.quantity > edit.old_quantity ? 'Stock will decrease' : 'Stock will increase'})
                      </span>
                    </div>
                  </div>
                )}
                {priceChanged && (
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Unit Price</div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="line-through text-slate-500">{formatCurrency(edit.old_unit_price)}</span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                      <span className="font-bold text-emerald-600">{formatCurrency(edit.unit_price)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          onClick={onClose}
          disabled={isSubmitting}
          className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          Go Back
        </button>
        <button
          onClick={handleConfirm}
          disabled={isSubmitting}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {isSubmitting ? 'Saving Changes...' : 'Confirm & Save'}
        </button>
      </div>
    </Modal>
  );
};
