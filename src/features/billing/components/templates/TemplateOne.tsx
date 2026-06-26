import React from 'react';
import { BillTemplateProps } from './types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Phone, Mail, MapPin } from 'lucide-react';
import SignatureRenderer from '../SignatureRenderer';

export const TemplateOne: React.FC<BillTemplateProps> = ({ bill, dealer, settings, type = 'bill', billSignature }) => {
  const isStatement = type === 'statement';

  return (
    <div className="w-full min-h-[1123px] bg-white p-8 sm:p-12 text-slate-800 font-sans text-sm relative flex flex-col" id="print-content">
      {/* Header section */}
      <div className="flex justify-between items-start border-b-2 border-slate-200 pb-6 mb-8 shrink-0">
        <div className="flex-1">
          <h1 className="text-4xl font-bold text-slate-900 mb-2 uppercase tracking-tight">
            {isStatement ? 'Statement' : 'Invoice'}
          </h1>
          {settings.showLogo && dealer?.avatar_url && (
            <img src={dealer.avatar_url} alt="Logo" className="h-16 w-auto mt-4 object-contain" />
          )}
        </div>
        
        <div className="text-right flex-1">
          <h2 className="text-2xl font-bold text-slate-800 mb-2">{dealer?.shop_name || dealer?.name}</h2>
          <div className="text-slate-600 space-y-1 flex flex-col items-end">
            {dealer?.address && (
              <div className="flex items-start gap-1 justify-end text-right max-w-xs">
                <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{dealer.address}</span>
              </div>
            )}
            {dealer?.phone && (
              <div className="flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" />
                <span>{dealer.phone}</span>
              </div>
            )}
            {dealer?.email && (
              <div className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5" />
                <span>{dealer.email}</span>
              </div>
            )}
            {dealer?.gstin && (
              <div className="font-semibold text-slate-800 mt-2 border border-slate-200 px-2 py-1 rounded inline-block bg-slate-50">
                GSTIN: {dealer.gstin}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bill Info & Customer section */}
      <div className="flex justify-between mb-8 shrink-0">
        <div className="bg-slate-50 p-4 rounded-lg w-1/2 mr-4 border border-slate-100">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Bill To</h3>
          <p className="font-bold text-lg text-slate-800 mb-1">
            {(bill?.farmer_name_snapshot || bill?.farmer?.name) || 'Walk-in Customer'}
          </p>
          {bill?.farmer_gstin && (
            <p className="text-slate-600 text-sm mt-1">GSTIN: <span className="font-medium text-slate-800">{bill.farmer_gstin}</span></p>
          )}
        </div>
        
        <div className="w-1/3 space-y-3 shrink-0">
          <div className="flex justify-between border-b border-slate-100 pb-2">
            <span className="text-slate-500">{isStatement ? 'Statement Date:' : 'Invoice Date:'}</span>
            <span className="font-bold text-slate-800">{formatDate(bill?.bill_date || bill?.created_at)}</span>
          </div>
          <div className="flex justify-between border-b border-slate-100 pb-2">
            <span className="text-slate-500">{isStatement ? 'Statement #:' : 'Invoice #:'}</span>
            <span className="font-bold text-slate-800">{bill?.bill_number || '-'}</span>
          </div>
        </div>
      </div>

      {/* Items Table */}
      {!isStatement && (
        <div className="mb-8 shrink-0">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="py-3 px-4 font-semibold text-sm rounded-tl-lg w-12">#</th>
                <th className="py-3 px-4 font-semibold text-sm">Item</th>
                <th className="py-3 px-4 font-semibold text-sm text-right">Qty</th>
                <th className="py-3 px-4 font-semibold text-sm text-left">Unit</th>
                <th className="py-3 px-4 font-semibold text-sm text-right">MRP</th>
                <th className="py-3 px-4 font-semibold text-sm text-right">Disc.</th>
                <th className="py-3 px-4 font-semibold text-sm text-right">Rate</th>
                <th className="py-3 px-4 font-semibold text-sm text-right">Tax</th>
                <th className="py-3 px-4 font-semibold text-sm text-right rounded-tr-lg">Amount</th>
              </tr>
            </thead>
            <tbody className="border-b border-slate-200">
              {bill?.bill_items?.map((item: any, index: number) => (
                <tr key={item.id || index} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="py-3 px-4 text-slate-500">{index + 1}</td>
                  <td className="py-3 px-4">
                    <p className="font-medium text-slate-800">{item.product_name_snapshot}</p>
                    {item.batch_number && <p className="text-xs text-slate-500">Batch: {item.batch_number}</p>}
                  </td>
                  <td className="py-3 px-4 text-right">{item.quantity}</td>
                  <td className="py-3 px-4 text-left text-slate-500">{item.unit || '-'}</td>
                  <td className="py-3 px-4 text-right text-slate-500">{item.mrp ? formatCurrency(item.mrp) : '-'}</td>
                  <td className="py-3 px-4 text-right text-slate-500">{item.discount_percentage ? `${item.discount_percentage}%` : '-'}</td>
                  <td className="py-3 px-4 text-right">{formatCurrency(item.unit_price)}</td>
                  <td className="py-3 px-4 text-right text-slate-500">
                    {item.tax_amount ? `${formatCurrency(item.tax_amount)} (${item.gst_rate}%)` : '-'}
                  </td>
                  <td className="py-3 px-4 text-right font-medium">{formatCurrency(item.total_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Totals Section */}
      {!isStatement && (
        <div className="flex justify-end mb-8 shrink-0">
          <div className="w-80 bg-slate-50 p-6 rounded-xl border border-slate-100">
            <div className="flex justify-between mb-3 text-slate-600">
              <p>Subtotal</p>
              <p className="font-medium">{formatCurrency(bill?.subtotal || bill?.total_amount)}</p>
            </div>
            <div className="flex justify-between mb-3 text-slate-600">
              <p>Discount</p>
              <p className="font-medium">{bill?.discount_amount > 0 ? `-${formatCurrency(bill.discount_amount)}` : formatCurrency(0)}</p>
            </div>
            <div className="flex justify-between mb-3 text-slate-600">
              <p>Tax (CGST/SGST)</p>
              <p className="font-medium">{formatCurrency((bill?.cgst_amount || 0) + (bill?.sgst_amount || 0))}</p>
            </div>

            <div className="flex justify-between text-lg font-bold pt-3 border-t border-slate-200 mt-3">
              <p>Grand Total</p>
              <p className="text-slate-800">
                {formatCurrency(bill?.total || bill?.total_amount)}
              </p>
            </div>
            <div className="flex justify-between text-slate-600 pt-3 mt-3 border-t border-slate-200 text-sm">
              <p>Amount Paid</p>
              <p className="font-medium text-green-600">{formatCurrency(bill?.amount_paid)}</p>
            </div>
            {bill?.balance_due > 0 && (
              <div className="flex justify-between text-red-600 text-sm mt-2">
                <p>Balance Due</p>
                <p className="font-bold">
                  {formatCurrency(bill?.balance_due)}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer Area */}
      <div className="flex justify-between items-end text-sm text-slate-600 mt-auto pt-8">
        <div className="flex flex-col items-start justify-end w-1/3">
          {billSignature?.signature_data?.length ? (
            <div className="h-16 w-32 mb-2">
              <SignatureRenderer strokes={billSignature.signature_data} className="h-full w-full" />
            </div>
          ) : (
            <div className="border-b border-slate-400 w-32 mb-2"></div>
          )}
          <p className="font-bold text-slate-800">Customer Signature</p>
        </div>

        <div className="flex flex-col items-end justify-end w-1/3 text-right">
          {Array.isArray(dealer?.authorized_signatory_data) && dealer.authorized_signatory_data.length > 0 ? (
            <div className="h-16 w-32 mb-2">
              <SignatureRenderer strokes={dealer.authorized_signatory_data} className="h-full w-full" />
            </div>
          ) : (
            <div className="h-16 mb-2"></div>
          )}
          <p className="font-bold text-slate-800">Authorized Signatory</p>
          <p className="text-xs text-slate-500 mt-1">For {dealer?.shop_name || dealer?.name}</p>
        </div>
      </div>
    </div>
  );
};
