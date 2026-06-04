import React from 'react';
import { useTranslation } from 'react-i18next';
import { useMonthlySalesTrend } from '../hooks/useDashboardData';
import { Skeleton } from '@/components/ui';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export const SalesTrend: React.FC = () => {
  const { t } = useTranslation();
  const { data: salesTrend, isLoading } = useMonthlySalesTrend();

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 min-h-[400px] flex flex-col">
        <div className="flex justify-between items-center mb-8">
          <Skeleton className="h-6 w-32 rounded-md" />
          <Skeleton className="h-5 w-24 rounded-md" />
        </div>
        <div className="flex-1 w-full mt-4">
          <Skeleton className="w-full h-full rounded-lg" />
        </div>
      </div>
    );
  }

  const chartData = salesTrend || [];
  
  // Custom tooltip for chart
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 text-white text-sm font-semibold py-1.5 px-3 rounded-lg shadow-xl">
          <p className="opacity-70 text-xs font-medium mb-0.5">{payload[0].payload.displayDate}</p>
          <p>₹{payload[0].value.toLocaleString()}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 min-h-[400px] flex flex-col">
      <div className="flex justify-between items-center mb-8">
        <h3 className="text-lg font-bold text-slate-800">Sales Trend</h3>
        <span className="text-sm text-slate-500 font-medium">Last 30 Days</span>
      </div>
      
      <div className="w-full mt-auto h-[280px]">
        {chartData.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">
            No data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="displayDate" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                tickMargin={12}
                minTickGap={30}
              />
              <YAxis hide />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }} />
              <Area 
                type="monotone" 
                dataKey="amount" 
                stroke="#3b82f6" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorSales)" 
                activeDot={{ r: 6, strokeWidth: 0, fill: '#3b82f6' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default SalesTrend;
