import React from 'react';
import { Modal } from '@/components/ui';
import Button from '@/components/ui/Button';
import { useTranslation } from 'react-i18next';
import { formatCurrency, formatDate } from '@/lib/utils';
import { format } from 'date-fns';

interface PurchasePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
  data: any; // PurchaseForm
  supplierName?: string;
  branchName?: string;
  productNames: Record<string, string>;
}

export const PurchasePreviewModal: React.FC<PurchasePreviewModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isSubmitting,
  data,
  supplierName,
  branchName,
  productNames,
}) => {
  const { t } = useTranslation();

  if (!data) return null;

  // Calculate totals
  const itemsTotal = data.items.reduce((acc: number, item: any) => acc + ((item.quantity || 0) * (item.cost_price_per_unit || 0)), 0);
  const gstTotal = data.items.reduce((acc: number, item: any) => acc + (item.gst_amount || 0), 0);
  const totalQuantity = data.items.reduce((acc: number, item: any) => acc + (Number(item.quantity) || 0), 0);
  const grandTotal = itemsTotal + gstTotal + (Number(data.additional_charges) || 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <>
          Preview Purchase for{' '}
          <span className="font-black text-blue-600">{branchName || 'Selected'}</span>{' '}
          Branch
        </>
      }
      className="max-w-4xl"
    >
      <div className="space-y-6 text-sm">
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <p className="text-slate-500 font-medium mb-1">Supplier</p>
            <p className="font-bold text-slate-800">{supplierName || 'Unknown'}</p>
          </div>
          <div>
            <p className="text-slate-500 font-medium mb-1">Invoice Number</p>
            <p className="font-bold text-slate-800">{data.invoice_number || 'N/A'}</p>
          </div>
          <div>
            <p className="text-slate-500 font-medium mb-1">Purchase Date</p>
            <p className="font-bold text-slate-800">{data.purchase_date ? formatDate(data.purchase_date) : 'N/A'}</p>
          </div>
          <div>
            <p className="text-slate-500 font-medium mb-1">Total Quantity</p>
            <p className="font-bold text-slate-800">{totalQuantity}</p>
          </div>
          <div>
            <p className="text-slate-500 font-medium mb-1">Grand Total</p>
            <p className="font-bold text-emerald-600">{formatCurrency(grandTotal)}</p>
          </div>
        </div>

        <div>
          <h4 className="font-bold text-slate-800 mb-3 border-b pb-2">Items to Add</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="py-2 pr-4 font-semibold">Product</th>
                  <th className="py-2 px-4 font-semibold">Batch / Exp</th>
                  <th className="py-2 px-4 font-semibold text-right">Qty</th>
                  <th className="py-2 px-4 font-semibold text-right">MRP</th>
                  <th className="py-2 px-4 font-semibold text-right">Cost/Unit</th>
                  <th className="py-2 px-4 font-semibold text-right">GST</th>
                  <th className="py-2 pl-4 font-semibold text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.items.map((item: any, index: number) => {
                  const lineTotal = ((item.quantity || 0) * (item.cost_price_per_unit || 0)) + (item.gst_amount || 0);
                  return (
                    <tr key={index} className="hover:bg-slate-50/50">
                      <td className="py-3 pr-4 font-medium text-slate-800">
                        {productNames[item.product_id] || 'Unknown Product'}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {item.batch_number || '-'}
                        {item.expiry_date && <span className="block text-xs text-slate-400">Exp: {format(new Date(item.expiry_date), 'MMM yyyy')}</span>}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-slate-700">{item.quantity}</td>
                      <td className="py-3 px-4 text-right text-slate-600">{formatCurrency(item.mrp || 0)}</td>
                      <td className="py-3 px-4 text-right text-slate-600">{formatCurrency(item.cost_price_per_unit || 0)}</td>
                      <td className="py-3 px-4 text-right text-slate-600">{formatCurrency(item.gst_amount || 0)}</td>
                      <td className="py-3 pl-4 text-right font-bold text-slate-800">{formatCurrency(lineTotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 flex justify-between items-center mt-4">
          <div>
            <p className="text-emerald-800 font-bold">Payment Details</p>
            <p className="text-emerald-700/70 text-xs mt-0.5">
              {data.is_paid ? 'Paid in full' : `Paid: ${formatCurrency(data.amount_paid || 0)}`} via {data.payment_method?.toUpperCase()}
            </p>
          </div>
          <div className="text-right">
            <p className="text-emerald-800 text-xs font-bold uppercase tracking-wider mb-1">Balance Due</p>
            <p className="text-xl font-black text-emerald-600">
              {formatCurrency(data.is_paid ? 0 : Math.max(0, grandTotal - (data.amount_paid || 0)))}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100">
        <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
          Edit Details
        </Button>
        <Button onClick={onConfirm} loading={isSubmitting}>
          Confirm & Save Purchase
        </Button>
      </div>
    </Modal>
  );
};
