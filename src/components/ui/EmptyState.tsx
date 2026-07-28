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
  <div className={cn('section-card relative flex flex-col items-center justify-center py-14 px-6 text-center border-2 border-dashed border-slate-200/70 bg-gradient-to-b from-slate-50/40 to-white overflow-hidden', className)}>
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-50/60 via-transparent to-transparent opacity-70 pointer-events-none" />
    <div className="relative mb-6">
      <div className="absolute inset-0 bg-blue-200 rounded-full blur-2xl opacity-40" />
      <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-white to-blue-50/80 text-blue-600 shadow-sm ring-1 ring-blue-100/80">
        <Icon className="h-9 w-9 opacity-90 drop-shadow-sm" strokeWidth={1.75} />
      </div>
    </div>
    <h3 className="relative text-xl font-extrabold tracking-tight text-slate-800">{title}</h3>
    <p className="relative mt-2.5 max-w-sm text-[0.92rem] leading-relaxed text-slate-500 font-medium">{description}</p>
    {action ? <div className="relative mt-8 scale-100 hover:scale-[1.02] transition-transform">{action}</div> : null}
  </div>
);

export default EmptyState;
