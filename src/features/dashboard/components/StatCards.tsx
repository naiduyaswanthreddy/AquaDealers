import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowDownRight,
  ArrowUpRight,
  MoveRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui';
import { cn, formatCurrency } from '@/lib/utils';
import { useDashboardStats } from '../hooks/useDashboardData';
import {
  buildSparklinePoints,
  buildTrendDescriptor,
  type TrendDescriptor,
} from '../utils/dashboardCardUtils';

const SPARKLINE_WIDTH = 320;
const SPARKLINE_HEIGHT = 112;
const SPARKLINE_PADDING = 8;

type CardTone = 'blue' | 'red' | 'orange' | 'green';

interface DashboardCardConfig {
  label: string;
  value: string;
  path: string;
  tone: CardTone;
  trend: TrendDescriptor;
  series: number[];
  trendVariant?: 'arrow' | 'dot';
}

function TrendGlyph({
  direction,
  className,
}: {
  direction: TrendDescriptor['direction'];
  className?: string;
}) {
  if (direction === 'up') {
    return <ArrowUpRight className={className} />;
  }

  if (direction === 'down') {
    return <ArrowDownRight className={className} />;
  }

  return <MoveRight className={className} />;
}

export const StatCards: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { data: stats, isLoading } = useDashboardStats();

  if (isLoading) {
    return (
      <div className="dashboard-kpi-grid">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="dashboard-metric-card dashboard-metric-card--loading">
            <div className="flex items-start justify-between">
              <Skeleton className="h-[4.5rem] w-[4.5rem] rounded-[1.7rem]" />
              <Skeleton className="h-14 w-14 rounded-full" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-5 w-[9.5rem] rounded-full" />
              <Skeleton className="h-14 w-[11rem] rounded-full" />
              <Skeleton className="h-5 w-[9rem] rounded-full" />
            </div>
            <Skeleton className="h-[4.5rem] w-full rounded-[1.25rem]" />
          </div>
        ))}
      </div>
    );
  }

  const cards: DashboardCardConfig[] = [
    {
      label: t('dashboard.todaysSales', "Today's Sales"),
      value: formatCurrency(stats?.todaySales ?? 0),
      path: '/bills',
      tone: 'blue',
      trendVariant: 'arrow',
      trend: buildTrendDescriptor({
        current: stats?.todaySales ?? 0,
        previous: stats?.yesterdaySales ?? 0,
        compareLabel: 'yesterday',
        formatter: formatCurrency,
      }),
      series: stats?.salesSeries?.length ? stats.salesSeries : [0],
    },
    {
      label: t('dashboard.outstandingDues', 'Outstanding Dues'),
      value: formatCurrency(stats?.totalDues ?? 0),
      path: '/dues',
      tone: 'red',
      trendVariant: 'arrow',
      trend: {
        direction: (stats?.dueFarmersCount ?? 0) > 0 ? 'up' : 'flat',
        tone: (stats?.dueFarmersCount ?? 0) > 0 ? 'negative' : 'positive',
        emphasis: `${stats?.dueFarmersCount ?? 0}`,
        label:
          (stats?.dueFarmersCount ?? 0) === 1
            ? 'farmer pending payment'
            : (stats?.dueFarmersCount ?? 0) > 1
              ? 'farmers pending payment'
              : 'no pending farmer dues',
      },
      series: stats?.duesSeries?.length ? stats.duesSeries : [0],
    },
    {
      label: t('dashboard.lowStockItems', 'Low Stock Items'),
      value: String(stats?.lowStockCount ?? 0),
      path: '/inventory',
      tone: 'orange',
      trendVariant: 'dot',
      trend: {
        direction: 'flat',
        tone: (stats?.lowStockCount ?? 0) > 0 ? 'negative' : 'positive',
        emphasis: '',
        label: (stats?.lowStockCount ?? 0) > 0 ? 'Needs attention' : 'All stock healthy',
      },
      series: stats?.lowStockSeries?.length ? stats.lowStockSeries : [0],
    },
    {
      label: t('dashboard.cashInHand', 'Cash in Hand'),
      value: formatCurrency(stats?.cashBalance ?? 0),
      path: '/cashbook',
      tone: 'green',
      trendVariant: 'arrow',
      trend: buildTrendDescriptor({
        current: stats?.cashBalance ?? 0,
        previous: stats?.yesterdayCashBalance ?? 0,
        compareLabel: 'yesterday',
        formatter: formatCurrency,
      }),
      series: stats?.cashSeries?.length ? stats.cashSeries : [0],
    },
  ];

  return (
    <div className="dashboard-kpi-grid">
      {cards.map((card) => {
        const sparklinePoints = buildSparklinePoints(
          card.series,
          SPARKLINE_WIDTH,
          SPARKLINE_HEIGHT,
          SPARKLINE_PADDING
        );
        const pointList = sparklinePoints.split(' ');
        const lastPoint = (pointList[pointList.length - 1] ?? '').split(',');
        const lastPointX = Number(lastPoint[0]) || SPARKLINE_WIDTH - SPARKLINE_PADDING;
        const lastPointY = Number(lastPoint[1]) || SPARKLINE_HEIGHT - SPARKLINE_PADDING;

        return (
          <button
            key={card.label}
            type="button"
            className={cn('dashboard-metric-card focus-ring', `dashboard-metric-card--${card.tone}`)}
            onClick={() => navigate(card.path)}
          >
            <div className="dashboard-metric-card__content">
              <p className="dashboard-metric-card__label">{card.label}</p>
              <p className="dashboard-metric-card__value">{card.value}</p>
            </div>

            <div className={cn('dashboard-metric-card__trend', `dashboard-metric-card__trend--${card.trend.tone}`)}>
              {card.trendVariant === 'dot' ? (
                <span className="dashboard-metric-card__trend-dot" aria-hidden="true" />
              ) : (
                <TrendGlyph direction={card.trend.direction} className="h-4 w-4 shrink-0" />
              )}
              {card.trend.emphasis ? (
                <span className="dashboard-metric-card__trend-emphasis">{card.trend.emphasis}</span>
              ) : null}
              <span className="dashboard-metric-card__trend-label">{card.trend.label}</span>
            </div>

            <div className="dashboard-metric-card__sparkline" aria-hidden="true">
              <svg viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`} preserveAspectRatio="none">
                <defs>
                  <linearGradient id={`metric-fill-${card.tone}`} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="currentColor" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="currentColor" stopOpacity="0.03" />
                  </linearGradient>
                </defs>
                <path
                  d={`M ${sparklinePoints} L ${SPARKLINE_WIDTH - SPARKLINE_PADDING},${SPARKLINE_HEIGHT - SPARKLINE_PADDING} L ${SPARKLINE_PADDING},${SPARKLINE_HEIGHT - SPARKLINE_PADDING} Z`}
                  fill={`url(#metric-fill-${card.tone})`}
                  className="dashboard-metric-card__sparkline-area"
                />
                <polyline
                  points={sparklinePoints}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx={lastPointX} cy={lastPointY} r="5" fill="currentColor" />
              </svg>
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default StatCards;
