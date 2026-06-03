import React, { useState, useRef, useEffect, useId } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SearchableSelectOption {
  value: string;
  label: string;
  subLabel?: string;
}

export interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
}

export const SearchableSelect = React.forwardRef<HTMLDivElement, SearchableSelectProps>(
  ({ options, value, onChange, placeholder = 'Search...', label, error, disabled }, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const id = useId();

    const selectedOption = options.find((opt) => opt.value === value);

    const filteredOptions = options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(search.toLowerCase()) ||
        opt.subLabel?.toLowerCase().includes(search.toLowerCase())
    );

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
      <div className="w-full relative" ref={containerRef}>
        {label && (
          <label className="mb-2 block text-sm font-semibold text-text-secondary">
            {label}
          </label>
        )}
        <div
          ref={ref}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={cn(
            'flex min-h-12 w-full cursor-pointer items-center justify-between rounded-2xl border border-border bg-white px-4 py-3 text-sm transition-all',
            'focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20',
            disabled && 'cursor-not-allowed bg-surface-muted text-text-muted',
            error && 'border-danger bg-danger-light/30'
          )}
        >
          <span className={selectedOption ? 'text-text-primary font-medium' : 'text-text-muted'}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronDown className={cn("h-4.5 w-4.5 text-text-muted transition-transform", isOpen && "rotate-180")} />
        </div>

        {isOpen && !disabled && (
          <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-border bg-white shadow-xl animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center border-b border-border px-3 py-2">
              <Search className="mr-2 h-4 w-4 text-text-muted shrink-0" />
              <input
                autoFocus
                type="text"
                className="w-full bg-transparent text-sm outline-none placeholder:text-text-muted py-1"
                placeholder="Type to search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <div className="max-h-60 overflow-y-auto p-1">
              {filteredOptions.length === 0 ? (
                <div className="p-4 text-center text-sm text-text-muted">No results found</div>
              ) : (
                filteredOptions.slice(0, 100).map((opt) => (
                  <div
                    key={opt.value}
                    className={cn(
                      "flex cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 text-sm transition-colors",
                      value === opt.value ? "bg-primary/10 text-primary font-bold" : "hover:bg-slate-50 text-text-primary"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange(opt.value);
                      setIsOpen(false);
                      setSearch('');
                    }}
                  >
                    <div className="flex flex-col">
                      <span>{opt.label}</span>
                      {opt.subLabel && <span className="text-xs text-text-muted font-normal">{opt.subLabel}</span>}
                    </div>
                    {value === opt.value && <Check className="h-4 w-4 shrink-0" />}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
        {error && <p className="mt-2 text-sm font-medium text-danger animate-slide-down">{error}</p>}
      </div>
    );
  }
);

SearchableSelect.displayName = 'SearchableSelect';
