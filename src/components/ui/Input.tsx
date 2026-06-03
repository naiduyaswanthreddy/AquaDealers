import React, { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  inputSize?: 'sm' | 'md' | 'lg';
}

const inputSizes = {
  sm: 'min-h-10 rounded-xl px-3 text-sm',
  md: 'min-h-12 rounded-2xl px-4 text-sm',
  lg: 'min-h-14 rounded-2xl px-4.5 text-base',
} as const;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      inputSize = 'md',
      type = 'text',
      id,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';
    const actualType = isPassword ? (showPassword ? 'text' : 'password') : type;

    return (
      <div className="w-full">
        {label ? (
          <label htmlFor={inputId} className="mb-2 block text-sm font-semibold text-text-secondary">
            {label}
          </label>
        ) : null}
        <div className="relative">
          {leftIcon ? (
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-muted">
              {leftIcon}
            </span>
          ) : null}
          <input
            ref={ref}
            id={inputId}
            type={actualType}
            disabled={disabled}
            className={cn(
              'aqua-input focus-ring w-full border bg-white/95 text-text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]',
              'border-border placeholder:text-text-muted disabled:bg-surface-muted disabled:text-text-muted',
              error && 'border-danger bg-danger-light/30',
              Boolean(leftIcon) && 'pl-11',
              Boolean(isPassword || rightIcon) && 'pr-11',
              inputSizes[inputSize],
              className
            )}
            {...props}
          />
          {isPassword ? (
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="focus-ring absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-text-muted hover:bg-surface-muted"
              tabIndex={-1}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
            </button>
          ) : rightIcon ? (
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-text-muted">
              {rightIcon}
            </span>
          ) : null}
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

Input.displayName = 'Input';

export default Input;
