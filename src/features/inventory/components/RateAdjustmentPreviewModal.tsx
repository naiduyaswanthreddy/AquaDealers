import React from 'react';
import { Modal } from '@/components/ui';
import Button from '@/components/ui/Button';
import { formatCurrency } from '@/lib/utils';
import { Calculator } from 'lucide-react';

interface RateAdjustmentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
  data: {
    productName: string;
    rateDifference: number;
    totalBags: number;
    totalAmount: number;
    targetCount: number;
  } | null;
}

export const RateAdjustmentPreviewModal: React.FC<RateAdjustmentPreviewModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isSubmitting,
  data,
}) => {
  if (!data) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Preview Rate Adjustment"
      className="max-w-md"
    >
      <div className="space-y-6 text-sm">
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
          <p className="text-slate-500 font-medium mb-1">Product</p>
          <p className="font-bold text-slate-800 text-lg">{data.productName}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
            <p className="text-blue-800 font-medium text-xs uppercase tracking-wider mb-1">Rate Diff per Bag</p>
            <p className="font-bold text-blue-700 text-xl">+{formatCurrency(data.rateDifference)}</p>
          </div>
          <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
            <p className="text-blue-800 font-medium text-xs uppercase tracking-wider mb-1">Affected Bags</p>
            <p className="font-bold text-blue-700 text-xl">{data.totalBags}</p>
          </div>
        </div>

        <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200 text-amber-900 flex flex-col gap-2">
          <p className="font-bold">Summary of Action</p>
          <p>
            You are about to add a total of <b>{formatCurrency(data.totalAmount)}</b> in new charges to <b>{data.targetCount} farmer(s)</b>. 
          </p>
          <p className="text-xs text-amber-700/80 mt-1">
            This will update their ledgers and outstanding balances immediately.
          </p>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100">
        <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button onClick={onConfirm} loading={isSubmitting} leftIcon={<Calculator className="w-4 h-4" />}>
          Confirm & Update Ledgers
        </Button>
      </div>
    </Modal>
  );
};
