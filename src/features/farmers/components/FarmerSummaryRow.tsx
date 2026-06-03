import React from 'react';
import { formatCurrency } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface FarmerSummaryRowProps {
  totalDue: number;
  creditLimit: number;
}

export const FarmerSummaryRow: React.FC<FarmerSummaryRowProps> = ({ 
  totalDue, 
  creditLimit 
}) => {
  const { t } = useTranslation();
  
  const available = Math.max(0, creditLimit - totalDue);

  return (
    <div className="grid grid-cols-3 gap-1 px-3 py-4 bg-white">
      <div className="flex flex-col items-center justify-center">
        <span className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest mb-1">
          {t('farmers.totalDue', 'Total Due')}
        </span>
        <span className="text-[1.05rem] font-black tracking-tight text-rose-500">
          {formatCurrency(totalDue)}
        </span>
      </div>
      
      <div className="flex flex-col items-center justify-center border-x border-slate-100 px-1.5">
        <span className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest mb-1">
          {t('farmers.creditLimit', 'Credit Limit')}
        </span>
        <span className="text-[1.05rem] font-black tracking-tight text-slate-700">
          {formatCurrency(creditLimit)}
        </span>
      </div>
      
      <div className="flex flex-col items-center justify-center">
        <span className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest mb-1">
          {t('farmers.available', 'Available')}
        </span>
        <span className="text-[1.05rem] font-black tracking-tight text-slate-700">
          {formatCurrency(available)}
        </span>
      </div>
    </div>
  );
};

export default FarmerSummaryRow;
