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
  variant?: 'default' | 'header';
}

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  minDate,
  maxDate,
  placeholder = 'Select date',
  className,
  disabled = false,
  variant = 'default',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
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
      className="z-[100] relative animate-in fade-in zoom-in-95 duration-200"
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
          onClick={() => {
            if (disabled) return;
            setIsOpen(!isOpen);
          }}
          className={cn(
            variant === 'header' 
              ? "flex items-center gap-2 rounded-lg bg-white/10 hover:bg-white/20 px-3 py-1.5 transition-colors cursor-pointer text-white" 
              : "flex h-11 w-full items-center justify-between rounded-xl border bg-white px-2 sm:px-3 py-2 text-[0.7rem] sm:text-sm transition-all focus-within:ring-2 focus-within:ring-primary/20",
            variant === 'default' && disabled && "opacity-50 cursor-not-allowed border-slate-200 bg-slate-50 text-slate-500",
            variant === 'default' && !disabled && "cursor-pointer border-slate-200 hover:border-primary/50 text-slate-900",
            variant === 'default' && isOpen && "border-primary ring-2 ring-primary/20"
          )}
        >
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-hidden min-w-0">
            <CalendarIcon className={cn("flex-shrink-0", variant === 'header' ? "h-4 w-4 text-white/90" : (value ? "h-3.5 w-3.5 sm:h-4.5 sm:w-4.5 text-primary" : "h-3.5 w-3.5 sm:h-4.5 sm:w-4.5 text-slate-400"))} />
            <span className={cn("truncate min-w-0 font-medium", variant === 'header' ? "text-sm font-semibold" : (!value && "text-slate-400"))}>
              {formattedValue || placeholder}
            </span>
          </div>
          {value && !disabled && variant === 'default' && (
            <button
              type="button"
              className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors shrink-0 ml-0.5 sm:ml-1"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Modal Overlay for all screen sizes */}
      {isOpen && createPortal(
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-200">
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
             {/* Detect clicks outside calendar */}
             <div className="absolute inset-0" onClick={() => setIsOpen(false)} />
             {calendarContent}
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
