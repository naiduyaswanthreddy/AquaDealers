import React from 'react';
import { formatCurrency } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

export interface FarmerFooterSummaryProps {
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  currentDue: number;
  onViewStatement?: () => void;
  hideDetails?: boolean;
  hideCurrentDue?: boolean;
}

export const FarmerFooterSummary: React.FC<FarmerFooterSummaryProps> = ({
  openingBalance,
  totalDebit,
  totalCredit,
  currentDue,
  onViewStatement,
  hideDetails = false,
  hideCurrentDue = false,
}) => {
  const { t } = useTranslation();
  const isSticky = hideDetails;

  return (
    <div 
      className={`mt-4 overflow-hidden rounded-[24px] shadow-[0_12px_40px_rgba(226,232,240,0.4)] ${(onViewStatement && !hideCurrentDue) ? 'cursor-pointer transition-all hover:shadow-[0_16px_50px_rgba(226,232,240,0.6)] hover:-translate-y-0.5 active:scale-[0.98]' : ''} ${isSticky ? 'bg-white border border-primary/50 shadow-[0_8px_30px_rgba(var(--color-primary),0.2)] ring-1 ring-primary/30' : 'bg-white border border-slate-200'}`}
      onClick={!hideCurrentDue ? onViewStatement : undefined}
    >
      {!hideDetails && (
        <div className={`bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_100%)] p-5 space-y-3.5 ${hideCurrentDue ? '' : ''}`}>
          <div className="flex justify-between items-center text-[0.9rem] font-semibold text-slate-500">
            <span>{t('farmers.summary.openingBalance', 'Opening Balance')}</span>
            <span className="text-slate-700 font-bold">{formatCurrency(openingBalance)}</span>
          </div>
          <div className="flex justify-between items-center text-[0.9rem] font-semibold text-slate-500">
            <span>{t('farmers.summary.totalDebit', 'Total Debit')}</span>
            <span className="text-rose-600 font-bold">{formatCurrency(totalDebit)}</span>
          </div>
          <div className="flex justify-between items-center text-[0.9rem] font-semibold text-slate-500">
            <span>{t('farmers.summary.totalCredit', 'Total Credit')}</span>
            <span className="text-emerald-600 font-bold">{formatCurrency(totalCredit)}</span>
          </div>
        </div>
      )}
      
      {!hideCurrentDue && (
        <div className={`${isSticky ? 'bg-primary/15 px-5 py-4' : 'bg-slate-50 px-5 py-4 border-t border-slate-100'}`}>
          <div className="flex justify-between items-center">
            <span className={`text-[0.95rem] font-black uppercase tracking-wide ${isSticky ? 'text-primary-dark' : 'text-slate-800'}`}>{t('farmers.summary.currentDue', 'Current Due')}</span>
            <div className="flex flex-col items-end">
              <span className={`text-xl font-black leading-none ${isSticky ? 'text-rose-600' : 'text-rose-600'}`}>{formatCurrency(currentDue)}</span>
              {onViewStatement && <span className={`text-[0.7rem] font-bold underline mt-1.5 opacity-80 hover:opacity-100 transition-opacity uppercase tracking-wider ${isSticky ? 'text-primary' : 'text-primary'}`}>View Statement</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FarmerFooterSummary;
