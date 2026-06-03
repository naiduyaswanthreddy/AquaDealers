import React from 'react';
import { CROP_STATUSES, RISK_STATUSES } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface FarmerFiltersProps {
  cropStatus: string;
  setCropStatus: (v: string) => void;
  riskStatus: string;
  setRiskStatus: (v: string) => void;
  village: string;
  setVillage: (v: string) => void;
  sortBy: string;
  setSortBy: (v: string) => void;
  villages: string[];
}

export const FarmerFilters: React.FC<FarmerFiltersProps> = ({
  cropStatus,
  setCropStatus,
  riskStatus,
  setRiskStatus,
  village,
  setVillage,
  sortBy,
  setSortBy,
  villages,
}) => {
  return (
    <div className="flex gap-2.5 overflow-x-auto pb-1.5 scrollbar-none -mx-2 px-2">
      {/* Crop Status */}
      <select
        value={cropStatus}
        onChange={(e) => setCropStatus(e.target.value)}
        className="appearance-none bg-white border border-slate-200/90 shadow-sm rounded-full px-4 py-2 text-[11.5px] font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-300 cursor-pointer focus-ring min-w-fit transition-all active:scale-[0.97]"
      >
        <option value="">All Crops</option>
        {CROP_STATUSES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>

      {/* Risk Status */}
      <select
        value={riskStatus}
        onChange={(e) => setRiskStatus(e.target.value)}
        className="appearance-none bg-white border border-slate-200/90 shadow-sm rounded-full px-4 py-2 text-[11.5px] font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-300 cursor-pointer focus-ring min-w-fit transition-all active:scale-[0.97]"
      >
        <option value="">All Risk</option>
        {RISK_STATUSES.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>

      {/* Village */}
      {villages.length > 0 && (
        <select
          value={village}
          onChange={(e) => setVillage(e.target.value)}
          className="appearance-none bg-white border border-slate-200/90 shadow-sm rounded-full px-4 py-2 text-[11.5px] font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-300 cursor-pointer focus-ring min-w-fit transition-all active:scale-[0.97]"
        >
          <option value="">All Villages</option>
          {villages.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      )}
    </div>
  );
};

export default FarmerFilters;
