// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { initializeConsoleWrapper } from './lib/console-wrapper';

// Initialize console wrapper for production logging control
initializeConsoleWrapper();

const clientDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const sentryEnabled = process.env.NEXT_PUBLIC_SENTRY_ENABLED !== 'false';
const allowSentryOnDemoHosts = process.env.NEXT_PUBLIC_SENTRY_ENABLE_ON_DEMO === 'true';
const hostname = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
const isDemoLikeHost = hostname === 'demo.unioneyes.app' || hostname === 'staging.unioneyes.app';

if (clientDsn && sentryEnabled && (!isDemoLikeHost || allowSentryOnDemoHosts)) {
  Sentry.init({
    dsn: clientDsn,

    // Add optional integrations for additional features
    integrations: [
      Sentry.replayIntegration(),
    ],

    // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1,
    // Enable logs to be sent to Sentry
    enableLogs: true,

    // Define how likely Replay events are sampled.
    // This sets the sample rate to be 10%. You may want this to be 100% while
    // in development and sample at a lower rate in production
    replaysSessionSampleRate: process.env.NODE_ENV === 'production' ? 0.02 : 0.1,

    // Define how likely Replay events are sampled when an error occurs.
    replaysOnErrorSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Enable sending user PII (Personally Identifiable Information)
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
    sendDefaultPii: process.env.NODE_ENV !== 'production',
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;