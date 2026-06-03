import * as Sentry from '@sentry/react';
import posthog from 'posthog-js';

// Initialize Sentry for Error Tracking
export const initTelemetry = () => {
  const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
  const posthogKey = import.meta.env.VITE_POSTHOG_KEY;

  if (sentryDsn) {
    Sentry.init({
      dsn: sentryDsn,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration(),
      ],
      tracesSampleRate: 1.0, 
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
    });
    console.log('✅ Sentry initialized');
  } else {
    console.warn('⚠️ VITE_SENTRY_DSN not found. Error tracking disabled.');
  }

  // Initialize PostHog for Analytics
  if (posthogKey) {
    posthog.init(posthogKey, {
      api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://app.posthog.com',
      autocapture: false, // Disable autocapture to ensure privacy compliance, log events manually
    });
    console.log('✅ PostHog initialized');
  } else {
    console.warn('⚠️ VITE_POSTHOG_KEY not found. Analytics disabled.');
  }
};

// Telemetry Wrapper Functions
export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
  if (import.meta.env.VITE_POSTHOG_KEY) {
    posthog.capture(eventName, properties);
  }
};

export const identifyUser = (userId: string, traits?: Record<string, any>) => {
  if (import.meta.env.VITE_POSTHOG_KEY) {
    posthog.identify(userId, traits);
  }
};
