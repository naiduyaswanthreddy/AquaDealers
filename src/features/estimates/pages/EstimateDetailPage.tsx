import React, { useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Printer, FileText } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { PageShell } from '@/components/layout/PageShell';
import { PageHeader } from '@/components/layout/PageHeader';
import Button from '@/components/ui/Button';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useEstimateDetail } from '../hooks/useEstimate';

export const EstimateDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const printRef = useRef<HTMLDivElement>(null);

  const { data: estimate, isLoading } = useEstimateDetail(user?.id ?? '', id ?? '');

  const handlePrint = () => {
    if (!printRef.current) return;
    const content = printRef.current.innerHTML;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>${estimate?.estimate_number ?? 'Estimate'}</title>
      <style>body{font-family:sans-serif;margin:24px}table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5}
      .total-row{font-weight:bold}</style>
      </head><body>${content}</body></html>
    `);
    win.document.close();
    win.print();
  };

  if (isLoading) {
    return (
      <PageShell>
        <PageHeader title="Estimate" onBack={() => navigate('/estimates')} />
        <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Loading...</div>
      </PageShell>
    );
  }

  if (!estimate) {
    return (
      <PageShell>
        <PageHeader title="Estimate" onBack={() => navigate('/estimates')} />
        <div className="flex items-center justify-center py-16 text-gray-500 text-sm">
          Estimate not found.
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title={estimate.estimate_number}
        onBack={() => navigate('/estimates')}
        action={
          <Button size="sm" variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1" />
            Print
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4">
        {/* Estimate banner */}
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-4 flex items-center gap-2">
          <FileText className="h-4 w-4 text-amber-600 shrink-0" />
          <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold bg-amber-100 text-amber-700 ring-1 ring-amber-300">
            ESTIMATE
          </span>
          <span className="text-sm text-amber-700 font-medium">Price Quote · Not a Bill</span>
        </div>

        {/* Printable area */}
        <div ref={printRef} className="rounded-xl border bg-white p-4 space-y-4">
          {/* Meta */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-gray-500">Estimate Number</p>
              <p className="font-semibold">{estimate.estimate_number}</p>
            </div>
            <div>
              <p className="text-gray-500">Date</p>
              <p className="font-semibold">{formatDate(estimate.estimate_date)}</p>
            </div>
            <div>
              <p className="text-gray-500">Farmer</p>
              <p className="font-semibold">{estimate.farmer_name_snapshot ?? '—'}</p>
            </div>
            {estimate.branch_name_snapshot && (
              <div>
                <p className="text-gray-500">Branch</p>
                <p className="font-semibold">{estimate.branch_name_snapshot}</p>
              </div>
            )}
          </div>

          {/* Items table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-xs font-medium text-gray-500 uppercase">
                  <th className="py-2 px-2 text-left">Item</th>
                  <th className="py-2 px-2 text-right">Qty</th>
                  <th className="py-2 px-2 text-right">Rate</th>
                  <th className="py-2 px-2 text-right">Disc%</th>
                  <th className="py-2 px-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {estimate.items.map(item => (
                  <tr key={item.id}>
                    <td className="py-2 px-2 font-medium text-gray-900">{item.product_name}</td>
                    <td className="py-2 px-2 text-right text-gray-700">{item.quantity}</td>
                    <td className="py-2 px-2 text-right text-gray-700">{formatCurrency(item.unit_price)}</td>
                    <td className="py-2 px-2 text-right text-gray-500">{item.discount_percentage}%</td>
                    <td className="py-2 px-2 text-right font-semibold text-gray-900">
                      {formatCurrency(item.total_price)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="border-t pt-3 space-y-1 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span><span>{formatCurrency(estimate.subtotal)}</span>
            </div>
            {estimate.discount_amount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Discount</span><span>-{formatCurrency(estimate.discount_amount)}</span>
              </div>
            )}
            {estimate.gst_amount > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>GST</span><span>{formatCurrency(estimate.gst_amount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base border-t pt-2 text-gray-900">
              <span>Total</span><span>{formatCurrency(estimate.total)}</span>
            </div>
          </div>

          {estimate.notes && (
            <div className="border-t pt-3 text-sm text-gray-600">
              <p className="font-medium text-gray-700 mb-1">Notes</p>
              <p>{estimate.notes}</p>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
};

export default EstimateDetailPage;
