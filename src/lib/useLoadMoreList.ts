import { useState, useCallback, useEffect } from 'react';

type FetchPageParams = {
  page: number;
  limit: number;
};

export type AsyncLoadMoreOptions<T> = {
  initialLimit?: number;
  step?: number;
  fetchFn: (params: FetchPageParams) => Promise<{ data: T[]; total: number }>;
  dependencies?: any[];
};

export type SyncLoadMoreOptions = {
  initialCount?: number;
  step?: number;
  resetDeps?: any[];
};

// Overloads
export function useLoadMoreList<T>(
  options: AsyncLoadMoreOptions<T>
): {
  visibleItems: T[];
  visibleCount: number;
  totalCount: number;
  hasMore: boolean;
  loadMore: () => void;
  isLoading: boolean;
  error: Error | null;
};

export function useLoadMoreList<T>(
  items: T[],
  options?: SyncLoadMoreOptions
): {
  visibleItems: T[];
  visibleCount: number;
  totalCount: number;
  hasMore: boolean;
  loadMore: () => void;
  isLoading: boolean;
  error: null;
};

export function useLoadMoreList<T>(
  arg1: T[] | AsyncLoadMoreOptions<T>,
  arg2?: SyncLoadMoreOptions
) {
  const isAsync = !Array.isArray(arg1);

  // -- Async State --
  const asyncOpts = (isAsync ? arg1 : {}) as AsyncLoadMoreOptions<T>;
  const [asyncItems, setAsyncItems] = useState<T[]>([]);
  const [asyncPage, setAsyncPage] = useState(1);
  const [asyncTotal, setAsyncTotal] = useState(0);
  const [asyncIsLoading, setAsyncIsLoading] = useState(false);
  const [asyncError, setAsyncError] = useState<Error | null>(null);

  const loadData = useCallback(
    async (currentPage: number, append: boolean) => {
      if (!isAsync || !asyncOpts.fetchFn) return;
      setAsyncIsLoading(true);
      setAsyncError(null);
      try {
        const { data, total } = await asyncOpts.fetchFn({ page: currentPage, limit: asyncOpts.step || 10 });
        if (append) {
          setAsyncItems((prev) => [...prev, ...data]);
        } else {
          setAsyncItems(data);
        }
        setAsyncTotal(total);
      } catch (err) {
        setAsyncError(err instanceof Error ? err : new Error('Failed to fetch data'));
      } finally {
        setAsyncIsLoading(false);
      }
    },
    [isAsync, asyncOpts.fetchFn, asyncOpts.step]
  );

  useEffect(() => {
    if (isAsync) {
      setAsyncPage(1);
      loadData(1, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, isAsync ? asyncOpts.dependencies || [] : []);

  const asyncHasMore = asyncItems.length < asyncTotal;
  const asyncLoadMore = useCallback(() => {
    if (!asyncIsLoading && asyncHasMore) {
      const nextPage = asyncPage + 1;
      setAsyncPage(nextPage);
      loadData(nextPage, true);
    }
  }, [asyncIsLoading, asyncHasMore, asyncPage, loadData]);

  // -- Sync State --
  const syncItems = isAsync ? [] : (arg1 as T[]);
  const syncOpts = isAsync ? {} : (arg2 || {});
  const { initialCount = 10, step = 10, resetDeps = [] } = syncOpts;
  
  const [visibleCount, setVisibleCount] = useState(initialCount);

  useEffect(() => {
    if (!isAsync) {
      setVisibleCount(initialCount);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, isAsync ? [] : [initialCount, ...resetDeps]);

  const syncHasMore = visibleCount < syncItems.length;
  const syncLoadMore = () => {
    if (!isAsync) {
      setVisibleCount((prev) => Math.min(prev + step, syncItems.length));
    }
  };

  // -- Return Combined --
  if (isAsync) {
    return {
      visibleItems: asyncItems,
      visibleCount: asyncItems.length,
      totalCount: asyncTotal,
      hasMore: asyncHasMore,
      loadMore: asyncLoadMore,
      isLoading: asyncIsLoading,
      error: asyncError,
    };
  }

  return {
    visibleItems: syncItems.slice(0, visibleCount),
    visibleCount: Math.min(visibleCount, syncItems.length),
    totalCount: syncItems.length,
    hasMore: syncHasMore,
    loadMore: syncLoadMore,
    isLoading: false,
    error: null,
  };
}

export default useLoadMoreList;
