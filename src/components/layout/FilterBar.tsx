import React from 'react';
import { cn } from '@/lib/utils';

export const FilterBar: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...props }) => (
  <div className={cn('filter-bar', className)} {...props}>
    {children}
  </div>
);

export default FilterBar;
