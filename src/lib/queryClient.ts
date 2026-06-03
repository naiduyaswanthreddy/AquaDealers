import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { get, set, del } from 'idb-keyval';

/**
 * Creates an IndexedDB storage persister for React Query
 */
const idbStorage = {
  getItem: async (key: string) => {
    const val = await get(key);
    return val || null;
  },
  setItem: async (key: string, value: string) => {
    await set(key, value);
  },
  removeItem: async (key: string) => {
    await del(key);
  },
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: 'offlineFirst',
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 60 * 24, // 24 hours (formerly cacheTime)
      retry: 3,
    },
    mutations: {
      networkMode: 'offlineFirst',
    },
  },
});

// We configure persistence manually in App.tsx using PersistQueryClientProvider
export const idbPersister = createAsyncStoragePersister({
  storage: idbStorage,
});
