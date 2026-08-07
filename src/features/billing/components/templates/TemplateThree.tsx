import React from 'react';
import { BillTemplateProps } from './types';
import { formatCurrency, formatDate } from '@/lib/utils';
import SignatureRenderer from '../SignatureRenderer';
import { Phone, Mail, MapPin } from 'lucide-react';

export const TemplateThree: React.FC<BillTemplateProps> = ({ bill, dealer, settings, type = 'bill', billSignature }) => {
  const isStatement = type === 'statement';

  return (
    <div className="w-full min-h-[1123px] flex flex-col bg-white p-12 text-slate-800 font-sans text-sm relative" id="print-content">
      {/* Header section with accent color background */}
      <div className="bg-blue-600 text-white p-8 -mx-12 -mt-12 mb-8 flex justify-between items-center rounded-b-3xl">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-extrabold tracking-wider">{isStatement ? 'STATEMENT' : bill?.is_estimate ? 'ESTIMATE' : 'INVOICE'}</h1>
            {bill?.is_estimate && (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-800 ring-1 ring-amber-200">
                Price Quote
              </span>
            )}
          </div>
          <p className="mt-2 text-blue-100">{isStatement ? formatDate(new Date().toISOString()) : `No: ${bill?.bill_number}`}</p>
        </div>
        <div className="text-right">
          {settings.showLogo && dealer?.avatar_url && (
            <img src={dealer.avatar_url} alt="Logo" className="h-16 w-auto mb-2 object-contain ml-auto bg-white p-2 rounded" />
          )}
          <h2 className="text-xl font-bold">{dealer?.shop_name || dealer?.name}</h2>
          {dealer?.phone && <p className="text-blue-100 text-xs mt-1">{dealer.phone}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8 mb-10">
        <div>
          <h3 className="text-blue-600 font-bold mb-2 border-b-2 border-blue-100 pb-1 inline-block">Invoice To</h3>
          <p className="font-bold text-lg">{(bill?.farmer_name_snapshot || bill?.farmer?.name) || 'Walk-in Customer'}</p>
          {(bill?.farmer_phone_snapshot || bill?.farmer?.phone) && <p className="text-slate-600 mt-1">{bill.farmer.phone}</p>}
          {(bill?.farmer_village_snapshot || bill?.farmer?.address) && <p className="text-slate-600">{bill.farmer.address}</p>}
        </div>
        <div className="text-right">
          <h3 className="text-blue-600 font-bold mb-2 border-b-2 border-blue-100 pb-1 inline-block">Company Info</h3>
          {dealer?.address && <p className="text-slate-600">{dealer.address}</p>}
          {dealer?.email && <p className="text-slate-600">{dealer.email}</p>}
          {settings.showTax && dealer?.gstin && <p className="text-slate-600 mt-1 font-semibold">GSTIN: {dealer.gstin}</p>}
          {!isStatement && (
             <p className="text-slate-600 mt-1"><span className="font-semibold">Date:</span> {formatDate(bill?.bill_date)}</p>
          )}
        </div>
      </div>

      {/* Items Table */}
      {!isStatement && (
        <div className="mb-10">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-blue-600 text-blue-600">
                <th className="py-2 font-bold w-12 text-center">#</th>
                <th className="py-2 font-bold">Item</th>
                <th className="py-2 font-bold text-right">Qty</th>
                <th className="py-2 font-bold text-left px-2">Unit</th>
                <th className="py-2 font-bold text-right">MRP</th>
                <th className="py-2 font-bold text-right">Disc.</th>
                <th className="py-2 font-bold text-right">Rate</th>
                <th className="py-2 font-bold text-right px-2">Tax</th>
                <th className="py-2 font-bold text-right w-32">Amount</th>
              </tr>
            </thead>
            <tbody>
              {bill?.bill_items?.map((item: any, index: number) => (
                <tr key={item.id || index} className="border-b border-slate-200">
                  <td className="py-4 text-slate-500 text-center">{index + 1}</td>
                  <td className="py-4 font-medium">
                    {item.product_name_snapshot}
                    {item.batch_number && <p className="text-xs text-slate-500 font-normal">Batch: {item.batch_number}</p>}
                  </td>
                  <td className="py-4 text-right">{item.quantity}</td>
                  <td className="py-4 text-left px-2 text-slate-500">{item.unit || item.products?.unit || '-'}</td>
                  <td className="py-4 text-right text-slate-500">{item.mrp ? formatCurrency(item.mrp) : '-'}</td>
                  <td className="py-4 text-right text-slate-500">
                    {item.discount_percentage != null 
                      ? `${item.discount_percentage}%` 
                      : (item.mrp > 0 && item.mrp > item.unit_price) 
                        ? `${Number((((item.mrp - item.unit_price) / item.mrp) * 100).toFixed(2))}%` 
                        : '-'}
                  </td>
                  <td className="py-4 text-right">{formatCurrency(item.unit_price)}</td>
                  <td className="py-4 text-right px-2 text-slate-500">
                    {item.tax_amount ? `${formatCurrency(item.tax_amount)} (${item.gst_rate}%)` : '-'}
                  </td>
                  <td className="py-4 text-right font-bold text-slate-800">{formatCurrency(item.total_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Totals Section */}
      {!isStatement && (
        <div className="flex justify-between items-start">
          <div className="w-1/2">
             {/* Left side below table */}
          </div>
          <div className="w-72">
            <div className="flex justify-between py-2 text-slate-600">
              <p>Subtotal:</p>
              <p className="font-medium">{formatCurrency(bill?.total_amount)}</p>
            </div>
            {settings.showTax && (
              <div className="flex justify-between py-2 text-slate-600 border-b border-slate-200">
                <p>Tax:</p>
                <p className="font-medium">{formatCurrency(0)}</p>
              </div>
            )}
            {bill?.settlement_discount_amount > 0 && (
              <div className="flex justify-between py-2 text-emerald-600">
                <p>Settlement Discount:</p>
                <p className="font-medium">-{formatCurrency(bill.settlement_discount_amount)}</p>
              </div>
            )}
            <div className="flex justify-between py-2 text-slate-600">
              <p>Payment Mode:</p>
              <p className="font-bold uppercase">{bill?.payment_type || (bill?.amount_paid === 0 ? 'Credit' : 'Cash')}</p>
            </div>
            <div className="flex justify-between py-2 text-slate-600">
              <p>Paid:</p>
              <p className="font-medium">{formatCurrency(bill?.amount_paid)}</p>
            </div>
            <div className="flex justify-between py-3 mt-2 bg-blue-50 px-4 rounded-lg text-blue-800 font-bold text-lg">
              <p>Balance Due:</p>
              <p>{formatCurrency(bill?.balance_due)}</p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-auto pt-8 flex justify-between items-end text-xs text-slate-500">
        <div className="space-y-4 w-1/3">
          {false && (
            <div>
              <h4 className="font-bold text-slate-800 uppercase tracking-wider mb-1">Payment Details</h4>
              <p>Bank: HDFC Bank | A/C: XXXX-XXXX | IFSC: HDFC0000XXX</p>
            </div>
          )}
          {false && (
            <div>
              <h4 className="font-bold text-slate-800 uppercase tracking-wider mb-1">Terms</h4>
              <p>Payment due upon receipt. Subject to local jurisdiction.</p>
            </div>
          )}
        </div>
        
        <div className="w-1/3 flex justify-center">
          <div className="text-center">
            <div className="w-40 border-b-2 border-slate-300 mb-2 h-16 flex items-end justify-center pb-1">
              {billSignature?.signature_data ? (
                <SignatureRenderer strokes={billSignature.signature_data} className="h-full w-full" captureWidth={billSignature.canvas_width} captureHeight={billSignature.canvas_height} />
              ) : null}
            </div>
            <p className="font-bold text-slate-800">Customer Signature</p>
          </div>
        </div>

        <div className="w-1/3 flex justify-end">
          <div className="text-center">
            <div className="w-40 border-b-2 border-slate-300 mb-2 h-16 flex items-end justify-center pb-1">
              {Array.isArray(dealer?.authorized_signatory_data) && dealer.authorized_signatory_data.length > 0 ? (
                <SignatureRenderer strokes={dealer.authorized_signatory_data} className="h-full w-full" />
              ) : null}
            </div>
            <p className="font-bold text-slate-800">Authorized Signatory</p>
          </div>
        </div>
      </div>
    </div>
  );
};
