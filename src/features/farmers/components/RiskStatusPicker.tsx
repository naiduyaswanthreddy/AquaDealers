import React from 'react';
import { RISK_STATUSES } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface RiskStatusPickerProps {
  value: string;
  onChange: (value: string) => void;
}

export const RiskStatusPicker: React.FC<RiskStatusPickerProps> = ({ value, onChange }) => {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-text-secondary">Risk Status</label>
      <div className="grid grid-cols-3 gap-2">
        {RISK_STATUSES.map((risk) => {
          const isSelected = value === risk.value;
          return (
            <button
              key={risk.value}
              type="button"
              onClick={() => onChange(risk.value)}
              className={cn(
                'flex flex-col items-center justify-center py-3 px-2 rounded-xl border-2 transition-all focus-ring',
                isSelected
                  ? 'shadow-sm'
                  : 'border-border bg-white hover:bg-slate-50'
              )}
              style={
                isSelected
                  ? {
                      borderColor: risk.color,
                      backgroundColor: risk.color + '10',
                    }
                  : undefined
              }
            >
              <span className="mb-0.5">
                {React.createElement(risk.icon, { className: "w-6 h-6", style: { color: isSelected ? risk.color : '#94a3b8' } })}
              </span>
              <span
                className={cn(
                  'text-[11px] font-bold',
                  isSelected ? '' : 'text-text-secondary'
                )}
                style={isSelected ? { color: risk.color } : undefined}
              >
                {risk.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default RiskStatusPicker;
