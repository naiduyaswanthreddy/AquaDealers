import React from 'react';
import { AGEING_BUCKETS } from '@/lib/constants';
import { formatCurrency } from '@/lib/utils';

interface AgeingBlocksProps {
  ageing: {
    '0-30': number;
    '31-60': number;
    '61-90': number;
    '90+': number;
  };
}

export const AgeingBlocks: React.FC<AgeingBlocksProps> = ({ ageing }) => {
  const total = ageing['0-30'] + ageing['31-60'] + ageing['61-90'] + ageing['90+'];

  if (total === 0) {
    return (
      <div className="p-3 bg-success/5 rounded-xl border border-success/20 text-xs text-success text-center font-semibold">
        ✅ No outstanding dues — all clear!
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="text-[0.7rem] font-black text-slate-400 uppercase tracking-[0.15em] ml-1">
        Ageing Breakdown
      </h4>
      <div className="grid grid-cols-4 gap-2">
        {AGEING_BUCKETS.map((bucket) => {
          const amount = ageing[bucket.value as keyof typeof ageing] || 0;
          return (
            <div
              key={bucket.value}
              className="p-3 rounded-2xl text-center border shadow-sm transition-transform active:scale-95"
              style={{
                backgroundColor: bucket.bgColor,
                borderColor: bucket.color + '20',
              }}
            >
              <div
                className="text-[0.9rem] font-black"
                style={{ color: bucket.color }}
              >
                {amount > 0 ? `₹${(amount / 1000).toFixed(amount >= 1000 ? 1 : 0)}${amount >= 1000 ? 'k' : ''}` : '₹0'}
              </div>
              <div
                className="text-[8px] font-black mt-1 uppercase tracking-wider opacity-70"
                style={{ color: bucket.color }}
              >
                {bucket.label.replace(' days', '')}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AgeingBlocks;
