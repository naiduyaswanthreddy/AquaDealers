import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarClock, CalendarPlus } from 'lucide-react';
import type { Farmer } from '@/types/database';
import { formatCurrency, formatDate, getAgeingBucket } from '@/lib/utils';
import { AGEING_BUCKETS } from '@/lib/constants';
import { FarmerAvatar } from '@/components/ui';

interface DuesFarmerRowProps {
  farmer: Farmer;
  oldestDueDays: number | null;
  onFollowUp: (farmer: Farmer) => void;
}

/**
 * Dues page row: outstanding amount with an age band (green → red by how long
 * the oldest unpaid bill has been open) plus the collection follow-up state.
 */
export const DuesFarmerRow: React.FC<DuesFarmerRowProps> = ({ farmer, oldestDueDays, onFollowUp }) => {
  const navigate = useNavigate();

  const bucket =
    oldestDueDays !== null
      ? AGEING_BUCKETS.find((b) => b.value === getAgeingBucket(Math.max(0, oldestDueDays)))
      : null;

  const todayStr = new Date().toISOString().slice(0, 10);
  const followUpOverdue = !!farmer.follow_up_date && farmer.follow_up_date <= todayStr;

  return (
    <div className="flex w-full items-center gap-3 rounded-[24px] border border-slate-100 bg-white px-4 py-4 shadow-sm">
      <button
        type="button"
        onClick={() => navigate(`/farmers/${farmer.id}`)}
        className="flex min-w-0 flex-1 items-center gap-3 text-left transition-all active:scale-[0.99] focus-ring"
      >
        <FarmerAvatar imageUrl={farmer.image_url} name={farmer.name} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[1rem] font-bold tracking-tight text-slate-900">
            {farmer.name}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {bucket ? (
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide"
                style={{ backgroundColor: bucket.bgColor, color: bucket.color }}
              >
                {oldestDueDays} days
              </span>
            ) : null}
            {farmer.follow_up_date ? (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black ${
                  followUpOverdue ? 'bg-rose-50 text-rose-600' : 'bg-sky-50 text-sky-600'
                }`}
              >
                <CalendarClock className="h-3 w-3" />
                {formatDate(farmer.follow_up_date)}
                {farmer.promised_amount ? ` · ${formatCurrency(farmer.promised_amount)}` : ''}
              </span>
            ) : null}
            {farmer.village ? (
              <span className="truncate text-[0.78rem] font-medium text-slate-400">{farmer.village}</span>
            ) : null}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[1rem] font-extrabold tabular-nums text-rose-600">
            {formatCurrency(farmer.total_due)}
          </div>
          <div className="text-[0.72rem] font-semibold text-slate-400">outstanding</div>
        </div>
      </button>

      <button
        type="button"
        onClick={() => onFollowUp(farmer)}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-all active:scale-95 ${
          farmer.follow_up_date
            ? 'border-sky-200 bg-sky-50 text-sky-600'
            : 'border-slate-200 bg-slate-50 text-slate-400 hover:text-slate-600'
        }`}
        aria-label={`Set follow-up for ${farmer.name}`}
      >
        {farmer.follow_up_date ? <CalendarClock className="h-4.5 w-4.5" /> : <CalendarPlus className="h-4.5 w-4.5" />}
      </button>
    </div>
  );
};

export default DuesFarmerRow;
