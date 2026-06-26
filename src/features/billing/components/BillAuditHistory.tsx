import React, { useEffect, useState } from 'react';
import { billingService } from '../services/billingService';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { History, ArrowRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';

export const BillAuditHistory: React.FC<{ billId: string }> = ({ billId }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    billingService.getBillAuditLogs(billId).then(data => {
      setLogs(data);
      setLoading(false);
    }).catch(console.error);
  }, [billId]);

  if (loading) return <Skeleton className="h-32 w-full rounded-xl" />;
  if (logs.length === 0) return null;

  return (
    <div className="mt-8 border border-slate-200 rounded-2xl bg-white overflow-hidden">
      <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center gap-2">
        <History className="w-5 h-5 text-slate-500" />
        <h3 className="font-bold text-slate-800">Edit History</h3>
      </div>
      <div className="divide-y divide-slate-100">
        {logs.map((log, i) => (
          <div key={log.id} className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-bold text-slate-500">
                {formatDateTime(log.created_at)}
              </span>
              <span className="text-xs font-semibold px-2 py-1 bg-slate-100 text-slate-600 rounded-full">
                Edit #{logs.length - i}
              </span>
            </div>
            
            <div className="space-y-3">
              {log.changes_jsonb?.items?.map((itemChange: any, idx: number) => (
                <div key={idx} className="bg-slate-50 rounded-lg p-3 text-sm">
                  <div className="font-bold text-slate-700 mb-2">{itemChange.product_name}</div>
                  <div className="flex gap-6">
                    {itemChange.old_quantity !== itemChange.new_quantity && (
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Quantity</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 line-through">{itemChange.old_quantity}</span>
                          <ArrowRight className="w-3 h-3 text-slate-400" />
                          <span className="font-bold text-blue-600">{itemChange.new_quantity}</span>
                        </div>
                      </div>
                    )}
                    {itemChange.old_unit_price !== itemChange.new_unit_price && (
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Unit Price</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 line-through">{formatCurrency(itemChange.old_unit_price)}</span>
                          <ArrowRight className="w-3 h-3 text-slate-400" />
                          <span className="font-bold text-emerald-600">{formatCurrency(itemChange.new_unit_price)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-2 bg-slate-50 rounded-lg p-3 border border-slate-100">
              <span className="text-sm text-slate-500">Bill Total changed from</span>
              <span className="font-bold text-slate-500 line-through">{formatCurrency(log.changes_jsonb?.old_total)}</span>
              <ArrowRight className="w-4 h-4 text-slate-400 mx-1" />
              <span className="font-bold text-slate-800">{formatCurrency(log.changes_jsonb?.new_total)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
