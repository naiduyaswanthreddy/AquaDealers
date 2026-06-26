import { useEffect, useRef } from 'react';

// How often to check for updates (e.g., 2 minutes)
const CHECK_INTERVAL_MS = 2 * 60 * 1000;

export function useVersionCheck() {
  const currentVersionRef = useRef<number | null>(null);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;

    const checkVersion = async () => {
      try {
        // Bypass cache by appending a timestamp
        const res = await fetch(`/version.json?t=${new Date().getTime()}`);
        if (!res.ok) return;

        const data = await res.json();
        
        // On first load, just record the current version
        if (currentVersionRef.current === null) {
          currentVersionRef.current = data.version;
          return;
        }

        // If version has changed
        if (data.version !== currentVersionRef.current) {
          if (data.forceUpdate) {
            console.log('Mandatory update detected. Reloading...');
            window.location.reload();
          } else {
            console.log('Optional update available. Relying on Service Worker prompt.');
            // We could optionally trigger a service worker update check here
            // if we exported the updateServiceWorker function from a context,
            // but the PWA ReloadPrompt already handles optional updates gracefully.
          }
        }
      } catch (err) {
        // Ignore fetch errors (e.g., offline)
        console.warn('Failed to check for updates', err);
      }
    };

    // Check immediately on mount (or shortly after)
    setTimeout(checkVersion, 5000); // Wait 5s to not block initial render

    // Check periodically
    intervalId = setInterval(checkVersion, CHECK_INTERVAL_MS);

    // Also check when the user returns to the tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkVersion();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
}
