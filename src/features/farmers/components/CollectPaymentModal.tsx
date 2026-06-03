import React, { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useBranchStore } from '@/stores/branchStore';
import { useCollectPayment, useFarmerOpenBills } from '../hooks/useFarmerLedger';
import { Modal, Input, Select, Textarea, Button } from '@/components/ui';
import { PAYMENT_METHODS } from '@/lib/constants';
import { formatCurrency } from '@/lib/utils';
import { IndianRupee } from 'lucide-react';
import { toast } from 'sonner';

interface CollectPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  farmerId: string;
  farmerName: string;
  totalDue: number;
}

export const CollectPaymentModal: React.FC<CollectPaymentModalProps> = ({
  isOpen,
  onClose,
  farmerId,
  farmerName,
  totalDue,
}) => {
  const user = useAuthStore((s) => s.user);
  const activeBranchId = useBranchStore((s) => s.getActiveBranchId());
  const { mutateAsync: collectPayment, isPending } = useCollectPayment();
  const { data: openBills = [] } = useFarmerOpenBills(isOpen ? farmerId : '');

  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [allocationMode, setAllocationMode] = useState<'oldest_first' | 'specific_bill'>('oldest_first');
  const [targetBillId, setTargetBillId] = useState('');
  const [upiRef, setUpiRef] = useState('');
  const [chequeNo, setChequeNo] = useState('');
  const [notes, setNotes] = useState('');

  const paymentOptions = PAYMENT_METHODS.map((m) => ({ value: m.value, label: m.label }));
  const allocationOptions = [
    { value: 'oldest_first', label: 'Adjust oldest bills first' },
    { value: 'specific_bill', label: 'Adjust a specific bill' },
  ];
  const billOptions = openBills.map((bill) => ({
    value: bill.id,
    label: `${bill.bill_number} • ${formatCurrency(bill.balance_due)}`,
  }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (allocationMode === 'specific_bill' && !targetBillId) {
      toast.error('Please select a bill to adjust this payment against');
      return;
    }

    try {
      await collectPayment({
        dealerId: user!.id,
        branchId: activeBranchId,
        farmerId,
        amount: Number(amount),
        method,
        allocationMode,
        targetBillId: allocationMode === 'specific_bill' ? targetBillId : undefined,
        upiRef: method === 'upi' ? upiRef : undefined,
        chequeNo: method === 'cheque' ? chequeNo : undefined,
        notes,
      });
      toast.success('Payment recorded successfully!');
      onClose();
      // Reset form
      setAmount('');
      setMethod('cash');
      setAllocationMode('oldest_first');
      setTargetBillId('');
      setUpiRef('');
      setChequeNo('');
      setNotes('');
    } catch (err) {
      // Error is handled in the hook
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Collect Payment">
      <div className="mb-4 bg-slate-50 border border-border rounded-xl p-3 text-center">
        <div className="text-sm font-semibold text-text-secondary">Current Balance</div>
        <div className="text-xl font-extrabold text-danger mt-0.5">
          {formatCurrency(totalDue)}
        </div>
        <div className="text-xs font-bold text-text-primary mt-1">{farmerName}</div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <Input
            label="Amount Received *"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 50000"
            className="pl-8 text-lg font-bold"
            required
            autoFocus
          />
          <IndianRupee className="absolute left-3 top-[34px] w-4 h-4 text-text-muted" />
        </div>

        <Select
          label="Payment Method"
          options={paymentOptions}
          value={method}
          onChange={(e) => setMethod(e.target.value)}
        />

        {openBills.length > 0 ? (
          <>
            <Select
              label="Adjust Payment Against"
              options={allocationOptions}
              value={allocationMode}
              onChange={(e) => setAllocationMode(e.target.value as 'oldest_first' | 'specific_bill')}
            />

            {allocationMode === 'specific_bill' ? (
              <Select
                label="Select Bill"
                options={billOptions}
                value={targetBillId}
                onChange={(e) => setTargetBillId(e.target.value)}
                placeholder="Choose an open bill"
              />
            ) : null}
          </>
        ) : null}

        {method === 'upi' && (
          <Input
            label="UPI Reference No. (Optional)"
            placeholder="e.g. 123456789012"
            value={upiRef}
            onChange={(e) => setUpiRef(e.target.value)}
          />
        )}

        {method === 'cheque' && (
          <Input
            label="Cheque Number (Optional)"
            placeholder="e.g. 000123"
            value={chequeNo}
            onChange={(e) => setChequeNo(e.target.value)}
          />
        )}

        <Textarea
          label="Notes (Optional)"
          placeholder="Any details about this payment..."
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <div className="pt-2 flex gap-3">
          <Button type="button" variant="outline" fullWidth onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="success" fullWidth loading={isPending}>
            Record Payment
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default CollectPaymentModal;
