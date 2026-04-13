/**
 * Next.js Instrumentation Hook — Zonga app.
 *
 * Runs the canonical Nzila boot sequence plus Sentry error monitoring.
 */
import { createAppBoot } from '@nzila/os-core/telemetry'

export async function register() {
  await createAppBoot('zonga')()

  // Sentry server-side initialization (conditional on SENTRY_DSN env var)
  await import('./sentry.server.config')
}

export const onRequestError = async (...args: Parameters<typeof import('@sentry/nextjs').captureRequestError>) => {
  const Sentry = await import('@sentry/nextjs')
  return Sentry.captureRequestError(...args)
}
