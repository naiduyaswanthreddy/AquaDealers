import React from 'react';
import { cn } from '@/lib/utils';

const badgeVariants = {
  success: 'bg-success-light text-success',
  danger: 'bg-danger-light text-danger',
  warning: 'bg-warning-light text-warning',
  info: 'bg-primary/10 text-primary',
  neutral: 'bg-surface-muted text-text-secondary',
  accent: 'bg-accent/14 text-accent',
} as const;

const badgeSizes = {
  sm: 'px-2.5 py-1 text-[0.7rem]',
  md: 'px-3 py-1.5 text-xs',
} as const;

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof badgeVariants;
  size?: keyof typeof badgeSizes;
  dot?: boolean;
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  size = 'sm',
  dot = false,
  className,
  children,
  ...props
}) => (
  <span
    className={cn(
      'inline-flex items-center gap-1.5 rounded-full font-bold uppercase tracking-[0.08em]',
      badgeVariants[variant],
      badgeSizes[size],
      className
    )}
    {...props}
  >
    {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
    {children}
  </span>
);

Badge.displayName = 'Badge';

export default Badge;
