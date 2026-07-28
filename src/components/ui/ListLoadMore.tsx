import React from 'react';
import { Button } from './Button';

type ListLoadMoreProps = {
  shown: number;
  total: number;
  onLoadMore: () => void;
  label?: string;
  className?: string;
  isLoading?: boolean;
};

export const ListLoadMore: React.FC<ListLoadMoreProps> = ({
  shown,
  total,
  onLoadMore,
  label = 'Load next records',
  className = '',
  isLoading = false,
}) => {
  if (total <= shown) return null;

  return (
    <div
      className={`mt-4 flex flex-col items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 sm:flex-row ${className}`}
    >
      <div className="text-sm font-semibold text-slate-500">
        Showing <span className="font-black text-slate-900">{shown}</span> of{' '}
        <span className="font-black text-slate-900">{total}</span>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onLoadMore} loading={isLoading} disabled={isLoading} aria-label={`Load the next records; ${shown} of ${total} currently shown`}>
        {label}
      </Button>
    </div>
  );
};

export default ListLoadMore;
