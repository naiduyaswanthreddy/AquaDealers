import React, { useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string;
  error?: string;
  helperText?: string;
  options: SelectOption[];
  placeholder?: string;
  selectSize?: 'sm' | 'md' | 'lg';
}

const selectSizes = {
  sm: 'min-h-10 rounded-xl px-3 text-sm',
  md: 'min-h-12 rounded-2xl px-4 text-sm',
  lg: 'min-h-14 rounded-2xl px-4.5 text-base',
} as const;

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      helperText,
      options,
      placeholder = 'Select an option',
      selectSize = 'md',
      id,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const selectId = id ?? generatedId;

    return (
      <div className="w-full">
        {label ? (
          <label htmlFor={selectId} className="mb-2 block text-sm font-semibold text-text-secondary">
            {label}
          </label>
        ) : null}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            className={cn(
              'focus-ring aqua-input w-full appearance-none border border-border bg-white/95 pr-11 text-text-primary',
              'disabled:bg-surface-muted disabled:text-text-muted',
              error && 'border-danger bg-danger-light/30',
              selectSizes[selectSize],
              className
            )}
            {...props}
          >
            {placeholder ? (
              <option value="" disabled>
                {placeholder}
              </option>
            ) : null}
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-text-muted" />
        </div>
        {error ? (
          <p className="mt-2 text-sm font-medium text-danger animate-slide-down">{error}</p>
        ) : helperText ? (
          <p className="mt-2 text-sm text-text-muted">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Select.displayName = 'Select';

export default Select;
