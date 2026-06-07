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

  // Keep Node process APIs isolated from the shared instrumentation module
  // so Edge bundles do not attempt to analyze unsupported runtime calls.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { registerNodeProcessHandlers } = await import('./instrumentation.node')
    registerNodeProcessHandlers()
  }
}

export const onRequestError = async (...args: Parameters<typeof import('@sentry/nextjs').captureRequestError>) => {
  const Sentry = await import('@sentry/nextjs')
  return Sentry.captureRequestError(...args)
}
