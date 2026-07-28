import React from 'react';
import { Modal } from '@/components/ui';
import Button from '@/components/ui/Button';
import { formatDate, formatQuantity } from '@/lib/utils';
import { ArrowRight } from 'lucide-react';

interface TransferPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
  data: {
    fromBranchName: string;
    toBranchName: string;
    transferDate: string;
    notes: string;
    rows: { product_id: string; quantity: string; name: string; unit: string }[];
  } | null;
}

export const TransferPreviewModal: React.FC<TransferPreviewModalProps> = ({
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
      title="Preview Stock Transfer"
      className="max-w-2xl"
    >
      <div className="space-y-6 text-sm">
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-slate-500 font-medium mb-1 text-xs uppercase tracking-wider">From Branch</p>
              <p className="font-bold text-slate-800 text-lg">{data.fromBranchName}</p>
            </div>
            <ArrowRight className="text-slate-300 h-6 w-6 mt-4" />
            <div>
              <p className="text-slate-500 font-medium mb-1 text-xs uppercase tracking-wider">To Branch</p>
              <p className="font-bold text-slate-800 text-lg">{data.toBranchName}</p>
            </div>
          </div>
          <div className="md:text-right flex flex-col justify-center">
            <p className="text-slate-500 font-medium mb-1 text-xs uppercase tracking-wider">Transfer Date</p>
            <p className="font-bold text-slate-800">{formatDate(data.transferDate)}</p>
          </div>
        </div>

        <div>
          <h4 className="font-bold text-slate-800 mb-3 border-b pb-2">Products to Transfer</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="py-2 pr-4 font-semibold">Product</th>
                  <th className="py-2 pl-4 font-semibold text-right">Transfer Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.rows.map((row, index) => (
                  <tr key={index} className="hover:bg-slate-50/50">
                    <td className="py-3 pr-4 font-medium text-slate-800">
                      {row.name}
                    </td>
                    <td className="py-3 pl-4 text-right font-bold text-slate-800">
                      {formatQuantity(Number(row.quantity), row.unit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {data.notes && (
          <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100">
            <p className="text-amber-800 font-bold mb-1">Notes</p>
            <p className="text-amber-700/80 text-sm whitespace-pre-wrap">{data.notes}</p>
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100">
        <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
          Edit Details
        </Button>
        <Button onClick={onConfirm} loading={isSubmitting}>
          Confirm Transfer
        </Button>
      </div>
    </Modal>
  );
};
