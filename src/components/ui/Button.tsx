import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const buttonVariants = {
  primary:
    'bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-[0_4px_14px_0_rgba(37,99,235,0.39)] hover:shadow-[0_6px_20px_rgba(37,99,235,0.23)] hover:brightness-110 hover:-translate-y-0.5',
  secondary:
    'bg-[#0052cc]/12 text-[#0052cc] border border-[#0052cc]/20 hover:bg-[#0052cc]/18 hover:border-[#0052cc]/30 hover:-translate-y-0.5',
  accent:
    'bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-[0_4px_14px_0_rgba(245,158,11,0.39)] hover:shadow-[0_6px_20px_rgba(245,158,11,0.23)] hover:brightness-110 hover:-translate-y-0.5',
  danger:
    'bg-gradient-to-br from-rose-500 to-rose-700 text-white shadow-[0_4px_14px_0_rgba(225,29,72,0.39)] hover:shadow-[0_6px_20px_rgba(225,29,72,0.23)] hover:brightness-110 hover:-translate-y-0.5',
  ghost: 'bg-transparent text-[#0052cc] hover:bg-[#0052cc]/8 hover:-translate-y-0.5',
  outline: 'bg-white text-[#0052cc] border-2 border-[#0052cc]/20 shadow-sm hover:bg-[#0052cc]/5 hover:border-[#0052cc]/40 hover:-translate-y-0.5',
  success:
    'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-[0_4px_14px_0_rgba(16,185,129,0.39)] hover:shadow-[0_6px_20px_rgba(16,185,129,0.23)] hover:brightness-110 hover:-translate-y-0.5',
  dark:
    'bg-gradient-to-br from-slate-700 to-slate-900 text-white shadow-[0_4px_14px_0_rgba(15,23,42,0.39)] hover:shadow-[0_6px_20px_rgba(15,23,42,0.23)] hover:brightness-110 hover:-translate-y-0.5',
  darkOutline:
    'bg-[#173042]/8 text-[#173042] border border-[#173042]/20 hover:bg-[#173042]/14 hover:border-[#173042]/30 hover:-translate-y-0.5',
} as const;

const sizeVariants = {
  sm: 'min-h-10 rounded-xl px-4 text-sm font-semibold gap-2',
  md: 'min-h-12 rounded-2xl px-5 text-sm font-semibold gap-2.5',
  lg: 'min-h-14 rounded-2xl px-6 text-base font-bold gap-3',
} as const;

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof buttonVariants;
  size?: keyof typeof sizeVariants;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  debounceMs?: number;
  children: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      fullWidth = false,
      leftIcon,
      rightIcon,
      debounceMs = 400,
      className,
      disabled,
      onClick,
      children,
      ...props
    },
    ref
  ) => {
    const [isDebouncing, setIsDebouncing] = useState(false);

    useEffect(() => {
      let timeout: ReturnType<typeof setTimeout>;
      if (isDebouncing) {
        timeout = setTimeout(() => setIsDebouncing(false), debounceMs);
      }
      return () => clearTimeout(timeout);
    }, [isDebouncing, debounceMs]);

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!onClick) return;
      if (isDebouncing) {
        e.preventDefault();
        return;
      }
      setIsDebouncing(true);
      onClick(e);
    };

    const isDisabled = disabled || loading || isDebouncing;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        onClick={handleClick}
        className={cn(
          'focus-ring inline-flex cursor-pointer items-center justify-center border border-transparent transition-all duration-200',
          'disabled:cursor-not-allowed disabled:opacity-55 active:scale-[0.985]',
          buttonVariants[variant],
          sizeVariants[size],
          fullWidth && 'w-full',
          className
        )}
        {...props}
      >
        {loading ? (
          <Loader2 className="h-4.5 w-4.5 animate-spin" />
        ) : leftIcon ? (
          <span className="flex shrink-0 items-center">{leftIcon}</span>
        ) : null}
        <span>{children}</span>
        {!loading && rightIcon ? <span className="flex shrink-0 items-center">{rightIcon}</span> : null}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
