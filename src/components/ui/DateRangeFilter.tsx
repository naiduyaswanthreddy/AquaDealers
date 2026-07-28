import React, { useRef } from 'react';
import { Calendar, ArrowRight } from 'lucide-react';
import { DatePicker } from './DatePicker';

interface DateRangeFilterProps {
  startDate: string; // ISO date string (YYYY-MM-DD)
  endDate: string; // ISO date string (YYYY-MM-DD)
  onChange: (start: string, end: string) => void;
  className?: string;
}

export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  startDate,
  endDate,
  onChange,
  className = '',
}) => {
  const startInputRef = useRef<HTMLInputElement>(null);
  const endInputRef = useRef<HTMLInputElement>(null);

  const handleWrapperClick = (inputRef: React.RefObject<HTMLInputElement>) => {
    if (inputRef.current) {
      try {
        if (typeof inputRef.current.showPicker === 'function') {
          inputRef.current.showPicker();
        } else {
          inputRef.current.focus();
        }
      } catch (e) {
        inputRef.current.focus();
      }
    }
  };

  const setThisMonth = () => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    // Adjust for local timezone to avoid off-by-one errors
    const offsetFirst = new Date(firstDay.getTime() - (firstDay.getTimezoneOffset() * 60000));
    const offsetLast = new Date(lastDay.getTime() - (lastDay.getTimezoneOffset() * 60000));
    onChange(offsetFirst.toISOString().split('T')[0], offsetLast.toISOString().split('T')[0]);
  };

  const setLastMonth = () => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
    const offsetFirst = new Date(firstDay.getTime() - (firstDay.getTimezoneOffset() * 60000));
    const offsetLast = new Date(lastDay.getTime() - (lastDay.getTimezoneOffset() * 60000));
    onChange(offsetFirst.toISOString().split('T')[0], offsetLast.toISOString().split('T')[0]);
  };

  return (
    <div className={`flex items-end justify-between w-full gap-1 sm:gap-3 ${className}`}>
      <div className="flex flex-col gap-1 sm:gap-2 flex-1 min-w-[130px]">
        <span className="text-[0.65rem] font-bold text-slate-500 uppercase tracking-wider">From</span>
        <DatePicker
          value={startDate}
          onChange={(val) => onChange(val, endDate)}
          placeholder="From Date"
        />
      </div>

      <div className="flex h-8 w-8 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 shadow-sm text-primary mb-1 sm:mb-1 mx-0.5 sm:mx-1">
        <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
      </div>

      <div className="flex flex-col gap-1 sm:gap-2 flex-1 min-w-[130px]">
        <span className="text-[0.65rem] font-bold text-slate-500 uppercase tracking-wider">To</span>
        <DatePicker
          value={endDate}
          onChange={(val) => onChange(startDate, val)}
          placeholder="To Date"
        />
      </div>
    </div>
  );
};

export default DateRangeFilter;
