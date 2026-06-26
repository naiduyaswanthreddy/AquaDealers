import React from 'react';
import { BillTemplateProps } from './types';
import { formatCurrency, formatDate } from '@/lib/utils';
import SignatureRenderer from '../SignatureRenderer';
import { Phone, Mail, MapPin } from 'lucide-react';

export const TemplateFour: React.FC<BillTemplateProps> = ({ bill, dealer, settings, type = 'bill', billSignature }) => {
  const isStatement = type === 'statement';

  return (
    <div className="w-full min-h-[1123px] bg-slate-50 p-10 text-slate-800 font-sans text-sm relative flex flex-col" id="print-content">
      <div className="bg-white shadow-sm border border-slate-200 rounded-xl overflow-hidden flex-1 flex flex-col relative">
        {/* Header section */}
        <div className="flex justify-between items-center p-8 bg-slate-900 text-white">
          <div className="flex items-center gap-4">
            {settings.showLogo && dealer?.avatar_url && (
              <div className="bg-white p-2 rounded-lg">
                <img src={dealer.avatar_url} alt="Logo" className="h-12 w-auto object-contain" />
              </div>
            )}
            <div>
              <h2 className="text-2xl font-bold">{dealer?.shop_name || dealer?.name}</h2>
              {dealer?.phone && <p className="text-slate-400 text-sm">{dealer.phone}</p>}
            </div>
          </div>
          <div className="text-right">
            <h1 className="text-3xl font-light tracking-widest">{isStatement ? 'STATEMENT' : 'INVOICE'}</h1>
            <p className="text-slate-400 mt-1">{isStatement ? formatDate(new Date().toISOString()) : `#${bill?.bill_number}`}</p>
          </div>
        </div>

        <div className="p-8 flex-1">
          <div className="flex justify-between mb-8">
            <div className="w-1/2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Billed To</h3>
              <p className="font-bold text-lg text-slate-800">{(bill?.farmer_name_snapshot || bill?.farmer?.name) || 'Walk-in Customer'}</p>
              {(bill?.farmer_phone_snapshot || bill?.farmer?.phone) && <p className="text-slate-600">{bill.farmer.phone}</p>}
              {(bill?.farmer_village_snapshot || bill?.farmer?.address) && <p className="text-slate-600">{bill.farmer.address}</p>}
            </div>
            
            <div className="w-1/3 text-right">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Invoice Details</h3>
              <div className="space-y-1 text-slate-600">
                {!isStatement && <p><span className="font-medium mr-2">Date:</span>{formatDate(bill?.bill_date)}</p>}
                {settings.showTax && dealer?.gstin && <p><span className="font-medium mr-2">GSTIN:</span>{dealer.gstin}</p>}
              </div>
            </div>
          </div>

          {/* Items Table */}
          {!isStatement && (
            <div className="mb-8 overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-left">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="py-3 px-4 font-bold text-slate-700 text-xs uppercase">Description</th>
                    <th className="py-3 px-4 font-bold text-slate-700 text-xs uppercase text-center w-24">Qty</th>
                    <th className="py-3 px-4 font-bold text-slate-700 text-xs uppercase text-right w-28">Rate</th>
                    <th className="py-3 px-4 font-bold text-slate-700 text-xs uppercase text-right w-32">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {bill?.bill_items?.map((item: any, index: number) => (
                    <tr key={item.id || index}>
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-800">{item.product_name_snapshot}</p>
                      </td>
                      <td className="py-3 px-4 text-center text-slate-600">{item.quantity}</td>
                      <td className="py-3 px-4 text-right text-slate-600">{formatCurrency(item.unit_price)}</td>
                      <td className="py-3 px-4 text-right font-medium text-slate-800">{formatCurrency(item.total_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Totals Section */}
          {!isStatement && (
            <div className="flex justify-end mb-8">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-medium">{formatCurrency(bill?.total_amount)}</span>
                </div>
                {settings.showTax && (
                  <div className="flex justify-between text-slate-600">
                    <span>Tax</span>
                    <span className="font-medium">{formatCurrency(0)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <span>Amount Paid</span>
                  <span className="font-medium">{formatCurrency(bill?.amount_paid)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold text-slate-900 pt-2 border-t border-slate-200">
                  <span>Balance Due</span>
                  <span>{formatCurrency(bill?.balance_due)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Area */}
        <div className="mt-auto p-8 border-t border-slate-200 bg-slate-50 flex justify-between items-end">
          <div className="space-y-4 w-1/3">
            {false && (
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Bank Information</h4>
                <p className="text-xs text-slate-600">HDFC Bank • A/C: XXXX-XXXX • IFSC: HDFC0000XXX</p>
              </div>
            )}
            {false && (
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Terms</h4>
                <p className="text-xs text-slate-600">Goods once sold will not be taken back. Subject to local jurisdiction.</p>
              </div>
            )}
          </div>

          <div className="text-center w-1/3 flex flex-col items-center">
            <div className="w-40 border-b border-slate-400 mb-2 h-16 flex items-end justify-center pb-1">
              {billSignature?.signature_data ? (
                <SignatureRenderer strokes={billSignature.signature_data} className="h-full w-full" />
              ) : null}
            </div>
            <p className="text-xs text-slate-600 font-medium">Customer Signature</p>
          </div>

          <div className="text-center w-1/3 flex flex-col items-end">
            <div className="w-40 border-b border-slate-400 mb-2 h-16 flex items-end justify-center pb-1">
              {Array.isArray(dealer?.authorized_signatory_data) && dealer.authorized_signatory_data.length > 0 ? (
                <SignatureRenderer strokes={dealer.authorized_signatory_data} className="h-full w-full" />
              ) : null}
            </div>
            <p className="text-xs text-slate-600 font-medium">Authorized Signatory</p>
          </div>
        </div>
      </div>
    </div>
  );
};
