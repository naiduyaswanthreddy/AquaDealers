import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const buttonVariants = {
  primary:
    'bg-[#0052cc] text-white shadow-lg hover:bg-[#003380] hover:brightness-[1.03]',
  secondary:
    'bg-[#0052cc]/12 text-[#0052cc] border border-[#0052cc]/20 hover:bg-[#0052cc]/18 hover:border-[#0052cc]/30',
  accent:
    'bg-[#ea8e1b] text-white shadow-lg hover:bg-[#d97706] hover:brightness-[1.03]',
  danger:
    'bg-rose-600 text-white shadow-lg shadow-rose-500/20 hover:bg-rose-700 hover:brightness-[1.03]',
  ghost: 'bg-transparent text-[#0052cc] hover:bg-[#0052cc]/8',
  outline: 'bg-[#0052cc]/8 text-[#0052cc] border border-[#0052cc]/20 shadow-sm hover:bg-[#0052cc]/14 hover:border-[#0052cc]/30',
  success:
    'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 hover:brightness-[1.03]',
  dark:
    'bg-[#173042] text-white shadow-lg shadow-[#173042]/20 hover:bg-[#0f212e]',
  darkOutline:
    'bg-[#173042]/8 text-[#173042] border border-[#173042]/20 hover:bg-[#173042]/14 hover:border-[#173042]/30',
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
        style={{
          ...(variant === 'primary' ? {
            backgroundColor: '#0052cc',
            color: '#ffffff',
            border: 'none',
          } : variant === 'success' ? {
            backgroundColor: '#059669',
            color: '#ffffff',
            border: 'none',
          } : variant === 'danger' ? {
            backgroundColor: '#e11d48',
            color: '#ffffff',
            border: 'none',
          } : variant === 'outline' ? {
            backgroundColor: 'transparent',
            color: '#0052cc',
            border: '1px solid rgba(0, 82, 204, 0.2)',
          } : {}),
          ...props.style
        }}
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
