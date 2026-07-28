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

// Service Worker is now registered via ReloadPrompt component

/** Branded crash fallback — shown when a fatal React render error occurs. */
const CrashFallback: React.FC = () => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '40px 24px',
      background: '#f8fafc',
      fontFamily: "'Noto Sans', sans-serif",
      textAlign: 'center',
    }}
  >
    <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
    <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>
      Something went wrong
    </h1>
    <p style={{ fontSize: 15, color: '#64748b', maxWidth: 360, margin: '0 0 28px' }}>
      The app encountered an unexpected error. The engineering team has been notified automatically.
    </p>
    <button
      onClick={() => window.location.reload()}
      style={{
        background: '#0052cc',
        color: '#fff',
        border: 'none',
        borderRadius: 8,
        padding: '12px 28px',
        fontSize: 15,
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      Reload App
    </button>
  </div>
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: idbPersister }}
    >
      <BrowserRouter>
        <Sentry.ErrorBoundary
          fallback={<CrashFallback />}
          onError={(error, componentStack) => {
            // Ensure Sentry captures the full context at the boundary
            Sentry.captureException(error, { extra: { componentStack } });
          }}
        >
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
