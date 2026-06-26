import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Calendar } from './Calendar';
import { useClickOutside } from '@/hooks/useClickOutside';
import { format, parseISO, isValid } from 'date-fns';
import { createPortal } from 'react-dom';

interface DatePickerProps {
  value?: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  minDate?: string;
  maxDate?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  minDate,
  maxDate,
  placeholder = 'Select date',
  className,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  
  const popoverRef = useClickOutside<HTMLDivElement>(() => {
    if (isOpen) setIsOpen(false);
  }, [wrapperRef]);

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleSelect = (date: string) => {
    onChange(date);
    setIsOpen(false);
  };

  const formattedValue = value && isValid(parseISO(value)) 
    ? format(parseISO(value), 'dd MMM yyyy') 
    : '';

  const calendarContent = (
    <div 
      ref={popoverRef}
      className={cn(
        "z-[100] animate-in fade-in zoom-in-95 duration-200",
        isMobile 
          ? "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" 
          : "absolute top-full left-0 mt-2"
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <Calendar
        value={value}
        onChange={handleSelect}
        minDate={minDate}
        maxDate={maxDate}
      />
    </div>
  );

  return (
    <>
      <div 
        ref={wrapperRef}
        className={cn("relative w-full", className)}
      >
        <div
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={cn(
            "flex h-11 w-full items-center justify-between rounded-xl border bg-white px-3 py-2 text-sm transition-all focus-within:ring-2 focus-within:ring-primary/20",
            disabled ? "opacity-50 cursor-not-allowed border-slate-200 bg-slate-50 text-slate-500" : "cursor-pointer border-slate-200 hover:border-primary/50 text-slate-900",
            isOpen && "border-primary ring-2 ring-primary/20"
          )}
        >
          <div className="flex items-center gap-2 overflow-hidden">
            <CalendarIcon className={cn("h-4.5 w-4.5 flex-shrink-0", value ? "text-primary" : "text-slate-400")} />
            <span className={cn("truncate", !value && "text-slate-400")}>
              {formattedValue || placeholder}
            </span>
          </div>
          {value && !disabled && (
            <button
              type="button"
              className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors shrink-0 ml-1"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Desktop Popover */}
        {isOpen && !isMobile && calendarContent}
      </div>

      {/* Mobile Modal Overlay */}
      {isOpen && isMobile && createPortal(
        <div className="fixed inset-0 z-[99] bg-slate-900/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-200">
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
             {/* Detect clicks outside calendar on mobile */}
             <div className="absolute inset-0" onClick={() => setIsOpen(false)} />
             {calendarContent}
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
