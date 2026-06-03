import React from 'react';
import { cn } from '@/lib/utils';

interface FloatingActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label?: string;
}

export const FloatingActionButton = React.forwardRef<HTMLButtonElement, FloatingActionButtonProps>(
  ({ className, children, label, ...props }, ref) => (
    <button
      ref={ref}
      className={cn('floating-action focus-ring', label && 'floating-action--label', className)}
      {...props}
    >
      {children}
      {label ? <span className="text-sm font-bold">{label}</span> : null}
    </button>
  )
);

FloatingActionButton.displayName = 'FloatingActionButton';

export default FloatingActionButton;
