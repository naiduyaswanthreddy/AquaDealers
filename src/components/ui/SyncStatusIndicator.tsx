import React, { useEffect, useState } from 'react';
import { CloudOff, CloudDrizzle, CheckCircle2 } from 'lucide-react';

export const SyncStatusIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Simulate a sync when coming back online
      setIsSyncing(true);
      setTimeout(() => setIsSyncing(false), 2000);
    };
    
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOnline) {
    return (
      <button 
        type="button"
        className="flex h-9 w-9 items-center justify-center rounded-full text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 transition-all focus:outline-none"
        aria-label="Offline"
        title="Offline"
      >
        <CloudOff className="h-4.5 w-4.5" />
      </button>
    );
  }

  if (isSyncing) {
    return (
      <button 
        type="button"
        className="flex h-9 w-9 items-center justify-center rounded-full text-amber-300 bg-amber-500/10 transition-all focus:outline-none"
        aria-label="Syncing..."
        title="Syncing..."
      >
        <CloudDrizzle className="h-4.5 w-4.5 animate-pulse" />
      </button>
    );
  }

  return (
    <button 
      type="button"
      className="flex h-9 w-9 items-center justify-center rounded-full text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all focus:outline-none"
      aria-label="Synced"
      title="All changes saved"
    >
      <CheckCircle2 className="h-4.5 w-4.5" />
    </button>
  );
};
