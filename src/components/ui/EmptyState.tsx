import React from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
  className,
}) => (
  <div className={cn('section-card flex flex-col items-center justify-center py-10 text-center', className)}>
    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
      <Icon className="h-8 w-8" />
    </div>
    <h3 className="text-lg font-bold tracking-[-0.02em] text-text-primary">{title}</h3>
    <p className="mt-2 max-w-md text-sm leading-6 text-text-secondary">{description}</p>
    {action ? <div className="mt-6">{action}</div> : null}
  </div>
);

export default EmptyState;
