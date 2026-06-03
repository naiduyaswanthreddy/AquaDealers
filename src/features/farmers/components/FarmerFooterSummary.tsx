import React from 'react';
import { formatCurrency } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface FarmerFooterSummaryProps {
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  currentDue: number;
  onViewStatement?: () => void;
}

export const FarmerFooterSummary: React.FC<FarmerFooterSummaryProps> = ({
  openingBalance,
  totalDebit,
  totalCredit,
  currentDue,
  onViewStatement,
}) => {
  const { t } = useTranslation();

  return (
    <div 
      className={`bg-slate-100/80 rounded-2xl p-4 space-y-3 mt-4 border border-slate-200 ${onViewStatement ? 'cursor-pointer hover:bg-slate-100 transition-colors active:scale-[0.99]' : ''}`}
      onClick={onViewStatement}
    >
      <div className="flex justify-between items-center text-sm font-semibold text-slate-500">
        <span>{t('farmers.summary.openingBalance', 'Opening Balance')}</span>
        <span className="text-blue-600 font-bold">{formatCurrency(openingBalance)}</span>
      </div>
      <div className="flex justify-between items-center text-sm font-semibold text-slate-500">
        <span>{t('farmers.summary.totalDebit', 'Total Debit')}</span>
        <span className="text-slate-800 font-bold">{formatCurrency(totalDebit)}</span>
      </div>
      <div className="flex justify-between items-center text-sm font-semibold text-slate-500">
        <span>{t('farmers.summary.totalCredit', 'Total Credit')}</span>
        <span className="text-slate-800 font-bold">{formatCurrency(totalCredit)}</span>
      </div>
      <div className="flex justify-between items-center text-sm font-bold text-slate-700 pt-2 border-t border-slate-200 border-dashed">
        <span>{t('farmers.summary.currentDue', 'Current Due')}</span>
        <div className="flex items-center gap-2">
          <span className="text-rose-600 text-base">{formatCurrency(currentDue)}</span>
          {onViewStatement && <span className="text-xs text-primary underline">View Statement</span>}
        </div>
      </div>
    </div>
  );
};

export default FarmerFooterSummary;
