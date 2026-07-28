import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useDashboardStats } from '../hooks/useDashboardData';
import { Skeleton } from '@/components/ui';

const InventoryHealthComponent: React.FC = () => {
  const navigate = useNavigate();
  const { data: stats, isLoading } = useDashboardStats();

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <Skeleton className="h-5 w-36 rounded-md mb-5" />
        <div className="flex items-center gap-6">
          <Skeleton className="h-28 w-28 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2.5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton className="h-3 w-3 rounded-full" />
                <Skeleton className="h-3.5 w-28 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const total = stats?.totalInventoryItems ?? 0;
  const lowStock = stats?.lowStockCount ?? 0;
  const critical = stats?.criticalLowStockCount ?? 0;
  const outOfStock = stats?.outOfStockCount ?? 0;
  const healthy = Math.max(total - lowStock - outOfStock, 0);

  const segments = [
    { label: 'Healthy', count: healthy, color: '#26c96f', path: '/inventory' },
    { label: 'Low Stock', count: lowStock, color: '#ff9b2f', path: '/inventory?filter=low-stock' },
    { label: 'Critical', count: critical, color: '#ff4d6d', path: '/inventory?filter=low-stock' },
    { label: 'Out of Stock', count: outOfStock, color: '#1e293b', path: '/inventory?filter=out-of-stock' },
  ];

  // SVG donut: r=38, cx=50, cy=50, strokeWidth=16
  const r = 38;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  const donutSegments = segments.map((seg) => {
    const pct = total > 0 ? seg.count / total : 0;
    const dash = pct * circumference;
    const segOffset = circumference - offset;
    offset += dash;
    return { ...seg, dash, segOffset };
  });

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
      <h3 className="text-[1rem] font-bold text-slate-800 mb-4">Inventory Health</h3>

      <div className="flex items-center gap-5">
        {/* Donut */}
        <div className="relative flex-shrink-0 w-28 h-28">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            {total === 0 ? (
              <circle cx="50" cy="50" r={r} fill="none" stroke="#e2e8f0" strokeWidth="16" />
            ) : (
              donutSegments.map((seg, i) =>
                seg.count > 0 ? (
                  <circle
                    key={i}
                    cx="50"
                    cy="50"
                    r={r}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth="16"
                    strokeDasharray={`${seg.dash} ${circumference - seg.dash}`}
                    strokeDashoffset={seg.segOffset}
                    strokeLinecap="butt"
                  />
                ) : null
              )
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-lg font-extrabold text-slate-800 leading-none">{total}</span>
            <span className="text-[0.6rem] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Total</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-2">
          {segments.map((seg) => (
            <button
              key={seg.label}
              type="button"
              onClick={() => navigate(seg.path)}
              className="flex items-center justify-between w-full group focus:outline-none"
            >
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: seg.color }} />
                <span className="text-xs font-semibold text-slate-600 group-hover:text-slate-900 transition-colors">
                  {seg.label}
                </span>
              </div>
              <span className="text-xs font-bold text-slate-700">
                {seg.count}{total > 0 ? ` (${Math.round((seg.count / total) * 100)}%)` : ''}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export const InventoryHealth = React.memo(InventoryHealthComponent);
InventoryHealth.displayName = 'InventoryHealth';
export default InventoryHealth;
