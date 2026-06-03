import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Toaster } from 'sonner';
import App from './App';
import * as Sentry from '@sentry/react';
import { initTelemetry } from './lib/telemetry';
import { queryClient, idbPersister } from './lib/queryClient';
import './i18n';
import './tailwind.css';

// Initialize Enterprise Telemetry
initTelemetry();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: idbPersister }}
    >
      <BrowserRouter>
        <Sentry.ErrorBoundary fallback={<div style={{ padding: 40, textAlign: 'center', color: 'red' }}>A critical error occurred. The engineering team has been notified.</div>}>
          <App />
        </Sentry.ErrorBoundary>
        <Toaster
          position="top-center"
          richColors
          closeButton
          toastOptions={{
            style: {
              fontFamily: "'Noto Sans', sans-serif",
            },
          }}
        />
      </BrowserRouter>
    </PersistQueryClientProvider>
  </React.StrictMode>
);
