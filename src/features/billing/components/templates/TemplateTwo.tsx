import React from 'react';
import { BillTemplateProps } from './types';
import { formatCurrency, formatDate } from '@/lib/utils';
import SignatureRenderer from '../SignatureRenderer';
import { Phone, Mail, MapPin } from 'lucide-react';

export const TemplateTwo: React.FC<BillTemplateProps> = ({ bill, dealer, settings, type = 'bill', billSignature }) => {
  const isStatement = type === 'statement';

  return (
    <div className="w-full min-h-[1123px] bg-white p-8 sm:p-12 text-slate-800 font-serif text-sm relative border-8 border-double border-slate-100 flex flex-col" id="print-content">
      {/* Header section */}
      <div className="text-center border-b border-slate-400 pb-6 mb-6">
        {settings.showLogo && dealer?.avatar_url && (
          <img src={dealer.avatar_url} alt="Logo" className="h-20 w-auto mx-auto mb-4 object-contain" />
        )}
        <h2 className="text-3xl font-bold text-slate-900 mb-1">{dealer?.shop_name || dealer?.name}</h2>
        <div className="text-slate-600 space-y-1 text-xs">
          {dealer?.address && <p>{dealer.address}</p>}
          <p>Ph: {dealer?.phone} {dealer?.email && `| Email: ${dealer.email}`}</p>
          {settings.showTax && dealer?.gstin && <p className="font-semibold">GSTIN: {dealer.gstin}</p>}
        </div>
        <h1 className="text-2xl font-bold mt-4 uppercase tracking-widest border border-slate-400 inline-block px-6 py-1">
          {isStatement ? 'STATEMENT OF ACCOUNT' : 'TAX INVOICE'}
        </h1>
      </div>

      {/* Bill/Statement Details */}
      <div className="flex justify-between mb-8 border border-slate-300 p-4">
        <div className="w-1/2 border-r border-slate-300 pr-4">
          <p className="text-slate-500 font-bold mb-1 underline">Billed To:</p>
          <p className="font-bold text-base text-slate-800">{(bill?.farmer_name_snapshot || bill?.farmer?.name) || 'Walk-in Customer'}</p>
          {(bill?.farmer_phone_snapshot || bill?.farmer?.phone) && <p className="text-slate-600">{bill.farmer.phone}</p>}
          {(bill?.farmer_village_snapshot || bill?.farmer?.address) && <p className="text-slate-600 mt-1">{bill.farmer.address}</p>}
        </div>
        
        <div className="w-1/2 pl-4">
          <table className="w-full text-sm">
            <tbody>
              <tr>
                <td className="text-slate-500 font-bold py-1 w-24">{isStatement ? 'Date:' : 'Invoice No:'}</td>
                <td className="font-medium text-right">{isStatement ? formatDate(new Date().toISOString()) : bill?.bill_number}</td>
              </tr>
              {!isStatement && (
                <tr>
                  <td className="text-slate-500 font-bold py-1">Date:</td>
                  <td className="font-medium text-right">{formatDate(bill?.bill_date)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Items Table */}
      {!isStatement && (
        <div className="mb-8">
          <table className="w-full text-left border border-slate-400">
            <thead>
              <tr className="bg-slate-100 text-slate-800 border-b border-slate-400">
                <th className="py-2 px-3 font-bold border-r border-slate-400 w-12 text-center">S.No</th>
                <th className="py-2 px-3 font-bold border-r border-slate-400">Item</th>
                <th className="py-2 px-3 font-bold border-r border-slate-400 text-right w-16">Qty</th>
                <th className="py-2 px-3 font-bold border-r border-slate-400 text-left w-16">Unit</th>
                <th className="py-2 px-3 font-bold border-r border-slate-400 text-right w-20">MRP</th>
                <th className="py-2 px-3 font-bold border-r border-slate-400 text-right w-20">Disc.</th>
                <th className="py-2 px-3 font-bold border-r border-slate-400 text-right w-20">Rate</th>
                <th className="py-2 px-3 font-bold border-r border-slate-400 text-right w-20">Tax</th>
                <th className="py-2 px-3 font-bold text-right w-24">Amount</th>
              </tr>
            </thead>
            <tbody>
              {bill?.bill_items?.map((item: any, index: number) => (
                <tr key={item.id || index} className="border-b border-slate-300 last:border-b-0">
                  <td className="py-2 px-3 border-r border-slate-400 text-center">{index + 1}</td>
                  <td className="py-2 px-3 border-r border-slate-400">
                    <p className="font-medium">{item.product_name_snapshot}</p>
                    {item.batch_number && <p className="text-xs text-slate-500">Batch: {item.batch_number}</p>}
                  </td>
                  <td className="py-2 px-3 text-right border-r border-slate-400">{item.quantity}</td>
                  <td className="py-2 px-3 text-left border-r border-slate-400">{item.unit || '-'}</td>
                  <td className="py-2 px-3 text-right border-r border-slate-400">{item.mrp ? formatCurrency(item.mrp) : '-'}</td>
                  <td className="py-2 px-3 text-right border-r border-slate-400">{item.discount_percentage ? `${item.discount_percentage}%` : '-'}</td>
                  <td className="py-2 px-3 text-right border-r border-slate-400">{formatCurrency(item.unit_price)}</td>
                  <td className="py-2 px-3 text-right border-r border-slate-400">
                    {item.tax_amount ? `${formatCurrency(item.tax_amount)} (${item.gst_rate}%)` : '-'}
                  </td>
                  <td className="py-2 px-3 text-right font-medium">{formatCurrency(item.total_price)}</td>
                </tr>
              ))}
              {/* Empty rows to fill space could go here */}
            </tbody>
          </table>
        </div>
      )}

      {/* Totals Section */}
      {!isStatement && (
        <div className="flex justify-end mb-8">
          <table className="w-80 border border-slate-400">
            <tbody>
              <tr className="border-b border-slate-300">
                <td className="py-2 px-3 text-slate-600 font-bold">Subtotal</td>
                <td className="py-2 px-3 text-right font-medium">{formatCurrency(bill?.subtotal || bill?.total_amount)}</td>
              </tr>
              <tr className="border-b border-slate-300">
                <td className="py-2 px-3 text-slate-600 font-bold">Discount</td>
                <td className="py-2 px-3 text-right font-medium">{bill?.discount_amount > 0 ? `-${formatCurrency(bill.discount_amount)}` : formatCurrency(0)}</td>
              </tr>
              <tr className="border-b border-slate-300">
                <td className="py-2 px-3 text-slate-600 font-bold">Tax (CGST/SGST)</td>
                <td className="py-2 px-3 text-right font-medium">{formatCurrency((bill?.cgst_amount || 0) + (bill?.sgst_amount || 0))}</td>
              </tr>

              <tr className="bg-slate-100 border-b border-slate-400">
                <td className="py-2 px-3 font-bold text-lg">Grand Total</td>
                <td className="py-2 px-3 text-right font-bold text-lg">{formatCurrency(bill?.total || bill?.total_amount)}</td>
              </tr>
              <tr className="border-b border-slate-300">
                <td className="py-2 px-3 text-slate-600 font-bold text-sm">Amount Paid</td>
                <td className="py-2 px-3 text-right font-medium text-green-600 text-sm">{formatCurrency(bill?.amount_paid)}</td>
              </tr>
              {bill?.balance_due > 0 && (
                <tr>
                  <td className="py-2 px-3 text-red-600 font-bold text-sm">Balance Due</td>
                  <td className="py-2 px-3 text-right font-bold text-red-600 text-sm">{formatCurrency(bill?.balance_due)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer Area */}
      <div className="flex justify-between items-end border-t border-slate-400 pt-6 mt-auto">
        <div className="text-center w-1/3">
          {billSignature?.signature_data?.length ? (
            <div className="h-16 w-32 mx-auto mb-2">
              <SignatureRenderer strokes={billSignature.signature_data} className="h-full w-full" />
            </div>
          ) : (
            <div className="border-b border-slate-400 w-32 mx-auto mb-2"></div>
          )}
          <p className="pt-1 text-xs font-bold">Customer Signature</p>
        </div>
        
        <div className="text-center w-1/3">
          <p className="font-bold text-xs mb-2">For {dealer?.shop_name || dealer?.name}</p>
          {Array.isArray(dealer?.authorized_signatory_data) && dealer.authorized_signatory_data.length > 0 ? (
            <div className="h-16 w-32 mx-auto mb-2">
              <SignatureRenderer strokes={dealer.authorized_signatory_data} className="h-full w-full" />
            </div>
          ) : (
            <div className="h-16 mb-2"></div>
          )}
          <p className="border-t border-slate-400 pt-1 text-xs font-bold">Authorized Signatory</p>
        </div>
      </div>
    </div>
  );
};
