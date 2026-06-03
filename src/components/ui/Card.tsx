import React from 'react';
import { cn } from '@/lib/utils';

const cardVariants = {
  default: 'surface-card',
  elevated: 'surface-card bg-white shadow-[0_18px_36px_rgba(20,54,84,0.08)]',
  muted: 'surface-card surface-card--muted',
  interactive: 'surface-card surface-card--interactive cursor-pointer',
  stat: 'surface-card',
} as const;

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: keyof typeof cardVariants;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', className, children, ...props }, ref) => (
    <div ref={ref} className={cn(cardVariants[variant], className)} {...props}>
      {children}
    </div>
  )
);

Card.displayName = 'Card';

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-start justify-between gap-3 border-b border-border/80 px-5 py-4', className)} {...props}>
      {children}
    </div>
  )
);

CardHeader.displayName = 'CardHeader';

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn('px-5 py-5', className)} {...props}>
      {children}
    </div>
  )
);

CardContent.displayName = 'CardContent';

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-center justify-end gap-3 border-t border-border/80 px-5 py-4', className)}
      {...props}
    >
      {children}
    </div>
  )
);

CardFooter.displayName = 'CardFooter';

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: { value: string; positive: boolean };
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, icon, trend, className, ...props }) => (
  <Card variant="stat" className={cn('p-5', className)} {...props}>
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-text-secondary">{label}</p>
        <p className="mt-3 text-3xl font-extrabold tracking-[-0.05em] text-text-primary">{value}</p>
        {trend ? (
          <p className={cn('mt-2 text-sm font-semibold', trend.positive ? 'text-success' : 'text-danger')}>
            {trend.positive ? 'Up' : 'Down'} {trend.value}
          </p>
        ) : null}
      </div>
      {icon ? <div className="rounded-2xl bg-primary/10 p-3 text-primary">{icon}</div> : null}
    </div>
  </Card>
);

StatCard.displayName = 'StatCard';

export default Card;
