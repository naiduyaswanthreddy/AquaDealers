import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isSameDay,
  addDays,
  parseISO,
  isValid,
} from 'date-fns';

interface CalendarProps {
  value?: string; // ISO string YYYY-MM-DD
  onChange: (date: string) => void;
  minDate?: string;
  maxDate?: string;
  className?: string;
}

export const Calendar: React.FC<CalendarProps> = ({
  value,
  onChange,
  minDate,
  maxDate,
  className,
}) => {
  const initialDate = useMemo(() => {
    if (value && isValid(parseISO(value))) {
      return parseISO(value);
    }
    return new Date();
  }, [value]);

  const [currentMonth, setCurrentMonth] = useState<Date>(startOfMonth(initialDate));

  const min = minDate && isValid(parseISO(minDate)) ? parseISO(minDate) : undefined;
  const max = maxDate && isValid(parseISO(maxDate)) ? parseISO(maxDate) : undefined;
  const selectedDate = value && isValid(parseISO(value)) ? parseISO(value) : null;

  const monthOptions = useMemo(
    () => Array.from({ length: 12 }, (_, index) => ({
      value: index,
      label: format(new Date(2024, index, 1), 'MMMM'),
    })),
    []
  );

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const minYear = min ? min.getFullYear() : currentYear - 20;
    const maxYear = max ? max.getFullYear() : currentYear + 10;

    return Array.from({ length: maxYear - minYear + 1 }, (_, index) => minYear + index);
  }, [min, max]);

  const isBeforeMin = (day: Date) => {
    if (!min) return false;
    const minDay = new Date(min);
    minDay.setHours(0, 0, 0, 0);
    return day < minDay;
  };

  const isAfterMax = (day: Date) => {
    if (!max) return false;
    const maxDay = new Date(max);
    maxDay.setHours(23, 59, 59, 999);
    return day > maxDay;
  };

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextMonth = Number(e.target.value);
    setCurrentMonth((previous) => startOfMonth(new Date(previous.getFullYear(), nextMonth, 1)));
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextYear = Number(e.target.value);
    setCurrentMonth((previous) => startOfMonth(new Date(nextYear, previous.getMonth(), 1)));
  };

  const handleDateClick = (day: Date, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isBeforeMin(day) || isAfterMax(day)) return;

    const localDateString = format(day, 'yyyy-MM-dd');
    onChange(localDateString);
  };

  const renderHeader = () => {
    return (
      <div className="mb-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:border-primary/30 hover:bg-sky-50 hover:text-primary active:scale-95"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div className="min-w-0 text-center">
            <div className="text-base font-black text-slate-900">{format(currentMonth, 'MMMM yyyy')}</div>
            <div className="mt-0.5 text-xs font-semibold text-slate-500">Choose date</div>
          </div>

          <button
            type="button"
            onClick={handleNextMonth}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:border-primary/30 hover:bg-sky-50 hover:text-primary active:scale-95"
            aria-label="Next month"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_6.75rem] gap-2">
          <label className="sr-only" htmlFor="calendar-month-select">Month</label>
          <select
            id="calendar-month-select"
            value={currentMonth.getMonth()}
            onChange={handleMonthChange}
            className="h-11 min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-800 outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20"
          >
            {monthOptions.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor="calendar-year-select">Year</label>
          <select
            id="calendar-year-select"
            value={currentMonth.getFullYear()}
            onChange={handleYearChange}
            className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-800 outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20"
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

        {selectedDate ? (
          <button
            type="button"
            onClick={() => setCurrentMonth(startOfMonth(selectedDate))}
            className="w-full rounded-xl bg-primary/8 px-3 py-2 text-xs font-black text-primary transition-colors hover:bg-primary/12"
          >
            Jump to selected date
          </button>
        ) : null}
      </div>
    );
  };

  const renderDays = () => {
    const days = [];
    const startDate = startOfWeek(currentMonth, { weekStartsOn: 1 }); // Start on Monday
    for (let i = 0; i < 7; i++) {
      days.push(
        <div key={i} className="py-2 text-center text-[0.72rem] font-black uppercase text-slate-400">
          {format(addDays(startDate, i), 'EEE')}
        </div>
      );
    }
    return <div className="mb-1 grid grid-cols-7">{days}</div>;
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const rows = [];
    let days = [];
    let day = startDate;
    let formattedDate = '';

    const today = new Date();

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        formattedDate = format(day, 'd');
        const cloneDay = day;
        
        const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
        const isToday = isSameDay(day, today);
        const isCurrentMonth = isSameMonth(day, monthStart);
        const isDisabled = isBeforeMin(day) || isAfterMax(day);

        days.push(
          <button
            type="button"
            key={day.toString()}
            className={cn(
              "mx-auto flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold transition-all select-none",
              !isCurrentMonth ? "text-slate-300" : "text-slate-700",
              isDisabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer hover:bg-slate-100 active:scale-95",
              isToday && !isSelected && "bg-slate-100 ring-1 ring-blue-600/15"
            )}
            style={isSelected ? { backgroundColor: 'var(--color-primary)', color: 'white', boxShadow: '0 4px 6px -1px rgba(0, 82, 204, 0.25)' } : (isToday && !isSelected ? { color: 'var(--color-primary)' } : {})}
            onClick={(e) => !isDisabled && handleDateClick(cloneDay, e)}
            disabled={isDisabled}
            aria-label={format(day, 'dd MMMM yyyy')}
            aria-pressed={isSelected}
          >
            {formattedDate}
          </button>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div className="mb-1.5 grid grid-cols-7 gap-y-1" key={day.toString()}>
          {days}
        </div>
      );
      days = [];
    }
    return <div>{rows}</div>;
  };

  return (
    <div className={cn("w-[min(92vw,380px)] bg-white p-5 rounded-2xl shadow-2xl shadow-slate-900/12 border border-slate-200/70 select-none", className)}>
      {renderHeader()}
      {renderDays()}
      {renderCells()}
    </div>
  );
};
