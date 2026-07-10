import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useOfflineBillStore } from './offlineBillStore';

/**
 * Loads the offline bill queue and syncs it whenever the app starts or
 * connectivity returns. Mount once inside the authenticated app shell.
 */
export function useOfflineBillSync() {
  const queryClient = useQueryClient();
  const load = useOfflineBillStore((s) => s.load);
  const syncAll = useOfflineBillStore((s) => s.syncAll);

  useEffect(() => {
    let cancelled = false;

    const runSync = async () => {
      const summary = await syncAll();
      if (cancelled) return;

      if (summary.synced > 0) {
        toast.success(
          summary.synced === 1
            ? `Offline bill synced as ${summary.syncedNumbers[0]}.`
            : `${summary.synced} offline bills synced.`
        );
        queryClient.invalidateQueries({ queryKey: ['bills'] });
        queryClient.invalidateQueries({ queryKey: ['inventory'] });
        queryClient.invalidateQueries({ queryKey: ['farmers'] });
        queryClient.invalidateQueries({ queryKey: ['financials'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['farmer-items'] });
      }
      if (summary.failed > 0) {
        toast.error(
          `${summary.failed} offline bill${summary.failed === 1 ? '' : 's'} could not be synced. Open Bills to review.`
        );
      }
    };

    load().then(() => {
      if (!cancelled && navigator.onLine) runSync();
    });

    const handleOnline = () => runSync();
    window.addEventListener('online', handleOnline);

    return () => {
      cancelled = true;
      window.removeEventListener('online', handleOnline);
    };
  }, [load, syncAll, queryClient]);
}
