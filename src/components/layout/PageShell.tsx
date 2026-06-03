import React from 'react';
import { cn } from '@/lib/utils';

interface PageShellProps extends React.HTMLAttributes<HTMLDivElement> {
  narrow?: boolean;
  width?: 'default' | 'narrow' | 'wide' | 'full';
}

export const PageShell: React.FC<PageShellProps> = ({
  narrow = false,
  width = narrow ? 'narrow' : 'default',
  className,
  children,
  ...props
}) => (
  <div
    className={cn(
      'page-shell animate-fade-in',
      width === 'narrow' && 'page-shell--narrow',
      width === 'wide' && 'page-shell--wide',
      width === 'full' && 'page-shell--full',
      className
    )}
    {...props}
  >
    {children}
  </div>
);

export default PageShell;
