import React from 'react';
import { cn } from '@/lib/utils';

/* ─── Base Skeleton ──────────────────────────── */
export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circle' | 'rect' | 'card';
  width?: string | number;
  height?: string | number;
  lines?: number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'text',
  width,
  height,
  lines = 1,
  className,
  ...props
}) => {
  const base = 'animate-shimmer bg-slate-200 rounded';

  if (variant === 'circle') {
    return (
      <div
        className={cn(base, 'rounded-full', className)}
        style={{
          width: width ?? 48,
          height: height ?? 48,
        }}
        {...props}
      />
    );
  }

  if (variant === 'card') {
    return (
      <div
        className={cn('bg-card rounded-xl p-4 space-y-3', className)}
        {...props}
      >
        <div className={cn(base, 'h-4 w-3/4')} />
        <div className={cn(base, 'h-4 w-full')} />
        <div className={cn(base, 'h-4 w-1/2')} />
        <div className="flex gap-2 pt-2">
          <div className={cn(base, 'h-8 w-20 rounded-lg')} />
          <div className={cn(base, 'h-8 w-20 rounded-lg')} />
        </div>
      </div>
    );
  }

  if (variant === 'rect') {
    return (
      <div
        className={cn(base, 'rounded-lg', className)}
        style={{
          width: width ?? '100%',
          height: height ?? 120,
        }}
        {...props}
      />
    );
  }

  // text variant — supports multiple lines
  return (
    <div className={cn('space-y-2', className)} {...props}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={cn(
            base,
            'h-4 rounded-md',
            i === lines - 1 && lines > 1 ? 'w-3/4' : 'w-full'
          )}
          style={{ width: lines === 1 ? (width ?? '100%') : undefined, height }}
        />
      ))}
    </div>
  );
};

Skeleton.displayName = 'Skeleton';

/* ─── Skeleton List (convenience) ────────────── */
export const SkeletonList: React.FC<{ count?: number; className?: string }> = ({
  count = 3,
  className,
}) => (
  <div className={cn('space-y-3', className)}>
    {Array.from({ length: count }).map((_, i) => (
      <Skeleton key={i} variant="card" />
    ))}
  </div>
);

SkeletonList.displayName = 'SkeletonList';

export default Skeleton;
