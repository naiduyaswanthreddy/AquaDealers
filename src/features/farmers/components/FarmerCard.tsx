import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { Farmer } from '@/types/database';
import { formatCurrency, getDaysOverdue } from '@/lib/utils';
import { FarmerAvatar } from '@/components/ui';
import { RISK_STATUSES, CROP_STATUSES } from '@/lib/constants';
import { useBranchStore } from '@/stores/branchStore';

interface FarmerCardProps {
  farmer: Farmer;
  variant?: 'default' | 'list';
}



export const FarmerCard: React.FC<FarmerCardProps> = ({ farmer, variant = 'default' }) => {
  const navigate = useNavigate();
  const branches = useBranchStore((state) => state.branches);
  const risk = RISK_STATUSES.find((r) => r.value === farmer.risk_status);
  const crop = CROP_STATUSES.find((c) => c.value === farmer.crop_status);

  const getOverdueLabel = () => {
    if (!farmer.total_due || farmer.total_due <= 0) return null;
    if (farmer.stocking_date) {
      const days = getDaysOverdue(farmer.stocking_date);
      if (days > 0) return `${days} days`;
      return `${Math.max(1, Math.abs(days))} days`;
    }
    return null;
  };

  const overdueLabel = getOverdueLabel();
  const showOverdue = farmer.risk_status !== 'reliable' && overdueLabel;
  const details = [
    farmer.village,
    farmer.pond_acres !== null && farmer.pond_acres !== undefined ? `${farmer.pond_acres} acres` : null,
  ]
    .filter(Boolean)
    .join(' \u2022 ');

  const isListVariant = variant === 'list';
  const isWalkIn = Boolean(farmer.is_walk_in);
  const walkInDate = new Date(farmer.created_at);
  const walkInBranch = branches.find((branch) => branch.id === farmer.branch_id)?.name || 'All branches';
  const listStatusLabel = crop?.label || 'Growing';
  const statusColor = isListVariant ? (crop?.color || '#10B981') : risk?.color || '#10B981';



  return (
    <button
      type="button"
      onClick={() => navigate(`/farmers/${farmer.id}`)}
      className={`w-full cursor-pointer text-left transition-all active:scale-[0.99] focus-ring ${
        isListVariant
          ? 'group flex min-h-[80px] items-center justify-between px-4 py-4 hover:bg-slate-50/70'
          : 'flex items-center justify-between gap-4 rounded-[24px] border border-slate-100 bg-white px-5 py-4.5 shadow-sm hover:bg-slate-50/50'
      }`}
    >
      {isListVariant ? (
        <>
          <div className="flex items-center gap-3 min-w-0">
            {isWalkIn ? (
              <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-full border border-slate-200 bg-slate-50 shadow-sm">
                <span className="text-[0.95rem] font-black leading-none text-slate-800">{walkInDate.getDate()}</span>
                <span className="mt-0.5 text-[0.56rem] font-black uppercase tracking-[0.16em] text-slate-400">{walkInDate.toLocaleDateString('en-US', { month: 'short' })}</span>
              </div>
            ) : <FarmerAvatar imageUrl={farmer.image_url} name={farmer.name} size="lg" />}

            <div className="min-w-0">
              <div className="text-[1rem] font-bold tracking-tight text-slate-900 break-words">
                {farmer.name}
              </div>
              {isWalkIn ? (
                <div className="mt-0.5 truncate text-[0.82rem] font-medium text-slate-500">
                  Walk-in customer <span className="ml-2 inline-flex rounded bg-sky-50 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-sky-700 ring-1 ring-sky-200">{walkInBranch}</span>
                </div>
              ) : details && (
                <div className="mt-0.5 truncate text-[0.82rem] font-medium text-slate-500">
                  {details}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-1.5">
                <span
                  className={`text-[1rem] font-bold tabular-nums ${
                    farmer.total_due > 0 ? 'text-orange-500' : 'text-slate-400'
                  }`}
                >
                  {formatCurrency(farmer.total_due)}
                </span>
                <div className="h-3 w-3 flex-shrink-0 rounded-full shadow-sm" style={{ backgroundColor: statusColor }} />
              </div>
              <div className="mt-0">
                <span className="text-[0.78rem] font-semibold text-slate-400">
                  {isWalkIn ? walkInDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : listStatusLabel}
                </span>
              </div>
            </div>
            <svg
              className="h-4.5 w-4.5 text-slate-200 transition-colors group-hover:text-slate-300"
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden="true"
            >
              <path d="M7 5l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </>
      ) : (
        <>
          <div className="flex min-w-0 flex-1 items-center gap-3.5">
            <div className="relative">
              <FarmerAvatar imageUrl={farmer.image_url} name={farmer.name} size="md" />
              <div
                className="absolute bottom-0 right-0 h-3.5 w-3.5 flex-shrink-0 rounded-full border-2 border-white shadow-sm"
                style={{ backgroundColor: statusColor }}
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="truncate text-[1.05rem] font-bold leading-snug text-slate-900">{farmer.name}</div>
              {details && <div className="mt-1 truncate text-sm font-medium text-slate-500">{details}</div>}
            </div>
          </div>

          <div className="flex flex-shrink-0 flex-col items-end">
            <span
              className={`text-[1.05rem] font-extrabold leading-tight ${
                farmer.total_due > 0 ? 'text-rose-600' : 'text-slate-400'
              }`}
            >
              {formatCurrency(farmer.total_due)}
            </span>
            {showOverdue ? (
              <span className="mt-1 text-xs font-semibold text-slate-400">{overdueLabel}</span>
            ) : farmer.total_due <= 0 ? (
              <span className="mt-1 text-xs font-semibold text-emerald-500">No dues</span>
            ) : null}
          </div>
        </>
      )}
    </button>
  );
};

export default FarmerCard;
