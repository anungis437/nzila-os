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

  // Graceful shutdown — drain in-flight requests before exit
  if (typeof process !== 'undefined') {
    let shuttingDown = false
    const shutdown = () => {
      if (shuttingDown) return
      shuttingDown = true
      console.log('[zonga] SIGTERM received — draining connections (30s grace)...')
      setTimeout(() => {
        console.log('[zonga] Grace period expired — exiting.')
        process.exit(0)
      }, 30_000)
    }

    // Prevent listener stacking on hot reload
    process.removeAllListeners('SIGTERM')
    process.removeAllListeners('SIGINT')
    process.on('SIGTERM', shutdown)
    process.on('SIGINT', shutdown)

    // Catch unhandled promise rejections and exceptions — Sentry + stderr
    process.removeAllListeners('unhandledRejection')
    process.removeAllListeners('uncaughtException')
    process.on('unhandledRejection', (reason) => {
      console.error('[zonga] Unhandled rejection:', reason)
    })
    process.on('uncaughtException', (err) => {
      console.error('[zonga] Uncaught exception:', err)
      // Let the process crash after logging — Node is in an undefined state
      process.exit(1)
    })
  }
}

export const onRequestError = async (...args: Parameters<typeof import('@sentry/nextjs').captureRequestError>) => {
  const Sentry = await import('@sentry/nextjs')
  return Sentry.captureRequestError(...args)
}
