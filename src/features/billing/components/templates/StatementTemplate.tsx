import React from 'react';
import { BillTemplateProps } from './types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Phone, Mail, MapPin } from 'lucide-react';

export const StatementTemplate: React.FC<BillTemplateProps> = ({ bill: statement, dealer, settings, type = 'statement' }) => {
  return (
    <div className="w-full h-full bg-white p-10 text-slate-800 font-sans text-sm relative" id="print-content">
      <div className="text-center border-b-2 border-slate-800 pb-6 mb-8">
        {settings.showLogo && dealer?.avatar_url && (
          <img src={dealer.avatar_url} alt="Logo" className="h-16 w-auto mx-auto mb-4 object-contain" />
        )}
        <h1 className="text-3xl font-bold uppercase tracking-widest text-slate-900 mb-2">{dealer?.shop_name || dealer?.name}</h1>
        <div className="text-sm text-slate-600 flex justify-center items-center gap-4">
          {dealer?.phone && <span><Phone className="inline w-3 h-3 mr-1" />{dealer.phone}</span>}
          {dealer?.email && <span><Mail className="inline w-3 h-3 mr-1" />{dealer.email}</span>}
        </div>
      </div>

      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-lg font-bold text-slate-800">STATEMENT OF ACCOUNT</h2>
          <p className="text-slate-500 mt-1">Generated: {formatDate(new Date().toISOString())}</p>
        </div>
        <div className="text-right">
          <p className="font-bold text-slate-800">{statement?.farmer?.name || 'Customer'}</p>
          {statement?.farmer?.phone && <p className="text-slate-600">{statement.farmer.phone}</p>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Opening Balance</p>
          <p className="text-xl font-medium text-slate-800">{formatCurrency(statement?.openingBalance || 0)}</p>
        </div>
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Closing Balance</p>
          <p className="text-xl font-bold text-blue-600">{formatCurrency(statement?.closingBalance || 0)}</p>
        </div>
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Total Paid</p>
          <p className="text-xl font-medium text-green-600">{formatCurrency(statement?.totalCredit || 0)}</p>
        </div>
      </div>

      <div className="mb-8">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b-2 border-slate-800">
              <th className="py-3 font-bold text-slate-800">Date</th>
              <th className="py-3 font-bold text-slate-800">Particulars</th>
              <th className="py-3 font-bold text-slate-800 text-right">Debit</th>
              <th className="py-3 font-bold text-slate-800 text-right">Credit</th>
              <th className="py-3 font-bold text-slate-800 text-right">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {statement?.transactions?.map((tx: any, i: number) => (
              <tr key={tx.id || i} className="hover:bg-slate-50">
                <td className="py-3 text-slate-600">{formatDate(tx.date)}</td>
                <td className="py-3">
                  <span className="font-medium text-slate-800">{tx.description}</span>
                  {tx.ref_no && <span className="text-xs text-slate-400 ml-2">#{tx.ref_no}</span>}
                </td>
                <td className="py-3 text-right text-red-600">{tx.type === 'debit' ? formatCurrency(tx.amount) : '-'}</td>
                <td className="py-3 text-right text-green-600">{tx.type === 'credit' ? formatCurrency(tx.amount) : '-'}</td>
                <td className="py-3 text-right font-medium text-slate-800">{formatCurrency(tx.runningBalance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="absolute bottom-12 left-10 right-10 border-t-2 border-slate-800 pt-4 flex justify-between text-xs text-slate-500">
        <p>This is a computer generated statement.</p>
        <p>For {dealer?.shop_name || dealer?.name}</p>
      </div>
    </div>
  );
};
