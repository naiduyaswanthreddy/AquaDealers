import React from 'react';
import { BillTemplateProps } from './types';
import { formatCurrency, formatDate } from '@/lib/utils';
import SignatureRenderer from '../SignatureRenderer';
import { Phone, Mail, MapPin } from 'lucide-react';

export const TemplateFive: React.FC<BillTemplateProps> = ({ bill, dealer, settings, type = 'bill', billSignature }) => {
  const isStatement = type === 'statement';

  return (
    <div className="w-full min-h-[1123px] bg-white p-12 text-black font-mono text-sm relative flex flex-col" id="print-content">
      {/* Header section */}
      <div className="flex flex-col items-center justify-center text-center border-b border-black pb-8 mb-8">
        {settings.showLogo && dealer?.avatar_url && (
          <img src={dealer.avatar_url} alt="Logo" className="h-16 w-auto mb-4 object-contain grayscale" />
        )}
        <h1 className="text-3xl font-bold tracking-widest uppercase mb-2">{dealer?.shop_name || dealer?.name}</h1>
        <div className="text-xs uppercase tracking-wider space-y-1">
          {dealer?.address && <p>{dealer.address}</p>}
          <p>PH: {dealer?.phone} {dealer?.email && `// EM: ${dealer.email}`}</p>
          {settings.showTax && dealer?.gstin && <p>GSTIN: {dealer.gstin}</p>}
        </div>
      </div>

      <div className="flex justify-between items-start mb-12 uppercase tracking-wide text-xs">
        <div>
          <p className="font-bold border-b border-black inline-block mb-2">BILL TO</p>
          <p className="font-bold text-base">{(bill?.farmer_name_snapshot || bill?.farmer?.name) || 'WALK-IN'}</p>
          {(bill?.farmer_phone_snapshot || bill?.farmer?.phone) && <p>{bill.farmer.phone}</p>}
          {(bill?.farmer_village_snapshot || bill?.farmer?.address) && <p>{bill.farmer.address}</p>}
        </div>
        
        <div className="text-right">
          <div className="flex items-center gap-2 mb-2">
            <p className="font-bold border-b border-black inline-block">{isStatement ? 'STATEMENT' : bill?.is_estimate ? 'ESTIMATE' : 'INVOICE'}</p>
            {bill?.is_estimate && (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-800 ring-1 ring-amber-200">
                Price Quote
              </span>
            )}
          </div>
          <p><span className="mr-4">NO:</span>{isStatement ? formatDate(new Date().toISOString()) : bill?.bill_number}</p>
          {!isStatement && (
            <p><span className="mr-4">DT:</span>{formatDate(bill?.bill_date)}</p>
          )}
        </div>
      </div>

      {/* Items Table */}
      {!isStatement && (
        <div className="mb-12 border-t border-b border-black py-2">
          <table className="w-full text-left uppercase tracking-wide text-xs">
            <thead>
              <tr className="border-b border-black">
                <th className="py-2 text-center w-8">#</th>
                <th className="py-2">ITEM</th>
                <th className="py-2 text-right">QTY</th>
                <th className="py-2 text-left pl-2">UNIT</th>
                <th className="py-2 text-right">MRP</th>
                <th className="py-2 text-right">DISC.</th>
                <th className="py-2 text-right">RATE</th>
                <th className="py-2 text-right pr-2">TAX</th>
                <th className="py-2 text-right w-24">AMT</th>
              </tr>
            </thead>
            <tbody>
              {bill?.bill_items?.map((item: any, index: number) => (
                <tr key={item.id || index} className="border-b border-dashed border-black last:border-b-0">
                  <td className="py-3 text-center">{index + 1}</td>
                  <td className="py-3 font-bold">
                    {item.product_name_snapshot}
                    {item.batch_number && <div className="text-[10px] font-normal">BATCH: {item.batch_number}</div>}
                  </td>
                  <td className="py-3 text-right">{item.quantity}</td>
                  <td className="py-3 text-left pl-2">{item.unit || item.products?.unit || '-'}</td>
                  <td className="py-3 text-right">{item.mrp ? formatCurrency(item.mrp) : '-'}</td>
                  <td className="py-3 text-right">
                    {item.discount_percentage != null 
                      ? `${item.discount_percentage}%` 
                      : (item.mrp > 0 && item.mrp > item.unit_price) 
                        ? `${Number((((item.mrp - item.unit_price) / item.mrp) * 100).toFixed(2))}%` 
                        : '-'}
                  </td>
                  <td className="py-3 text-right">{formatCurrency(item.unit_price)}</td>
                  <td className="py-3 text-right pr-2">
                    {item.tax_amount ? `${formatCurrency(item.tax_amount)} (${item.gst_rate}%)` : '-'}
                  </td>
                  <td className="py-3 text-right font-bold">{formatCurrency(item.total_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Totals Section */}
      {!isStatement && (
        <div className="flex justify-end mb-16 uppercase tracking-wide text-xs">
          <div className="w-64">
            <div className="flex justify-between py-1 border-b border-dashed border-black">
              <span>SUB:</span>
              <span>{formatCurrency(bill?.total_amount)}</span>
            </div>
            {settings.showTax && (
              <div className="flex justify-between py-1 border-b border-dashed border-black">
                <span>TAX:</span>
                <span>{formatCurrency(0)}</span>
              </div>
            )}
            {bill?.settlement_discount_amount > 0 && (
              <div className="flex justify-between py-1 border-b border-dashed border-black text-emerald-700">
                <span>DISCOUNT:</span>
                <span>-{formatCurrency(bill.settlement_discount_amount)}</span>
              </div>
            )}
            <div className="flex justify-between py-1 border-b border-dashed border-black">
              <span>PAYMENT:</span>
              <span className="uppercase">{bill?.payment_type || (bill?.amount_paid === 0 ? 'Credit' : 'Cash')}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-dashed border-black">
              <span>PAID:</span>
              <span>{formatCurrency(bill?.amount_paid)}</span>
            </div>
            <div className="flex justify-between py-2 border-b-2 border-black font-bold text-base mt-2">
              <span>BAL:</span>
              <span>{formatCurrency(bill?.balance_due)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Footer Area */}
      <div className="mt-auto pt-8 flex justify-between items-end uppercase tracking-wide text-[10px]">
        <div className="w-1/3 space-y-4">
          {false && (
            <div>
              <p className="font-bold mb-1 border-b border-black inline-block">BANK INFO</p>
              <p>HDFC BANK // AC: XXXX // IFSC: HDFC0000XXX</p>
            </div>
          )}
          {false && (
            <div>
              <p className="font-bold mb-1 border-b border-black inline-block">TERMS</p>
              <p>GOODS ONCE SOLD WILL NOT BE TAKEN BACK. E&OE.</p>
            </div>
          )}
        </div>
        
        <div className="w-1/3 flex justify-center">
          <div className="text-center">
            <div className="w-40 border-b border-black mb-2 h-16 flex items-end justify-center pb-1">
              {billSignature?.signature_data ? (
                <SignatureRenderer strokes={billSignature.signature_data} className="h-full w-full" captureWidth={billSignature.canvas_width} captureHeight={billSignature.canvas_height} />
              ) : null}
            </div>
            <p className="font-bold">CUSTOMER SIGN</p>
          </div>
        </div>

        <div className="w-1/3 flex justify-end">
          <div className="text-center">
            <div className="w-40 border-b border-black mb-2 h-16 flex items-end justify-center pb-1">
              {Array.isArray(dealer?.authorized_signatory_data) && dealer.authorized_signatory_data.length > 0 ? (
                <SignatureRenderer strokes={dealer.authorized_signatory_data} className="h-full w-full" />
              ) : null}
            </div>
            <p className="font-bold">AUTH SIGN</p>
          </div>
        </div>
      </div>
    </div>
  );
};
