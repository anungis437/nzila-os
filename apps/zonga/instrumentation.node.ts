import { logger } from '@/lib/logger'

/**
 * Node-only process lifecycle hooks.
 *
 * Kept in a dedicated module so Edge runtime analysis for instrumentation.ts
 * does not flag unsupported process APIs.
 */
export function registerNodeProcessHandlers(): void {
  let shuttingDown = false

  const shutdown = () => {
    if (shuttingDown) return
    shuttingDown = true

    logger.info('SIGTERM received, draining connections', { graceMs: 30_000 })

    setTimeout(() => {
      logger.warn('Grace period expired; awaiting external process supervisor termination')
    }, 30_000)
  }

  // Prevent listener stacking on hot reload.
  process.removeAllListeners('SIGTERM')
  process.removeAllListeners('SIGINT')
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)

  // Catch unhandled promise rejections and exceptions.
  process.removeAllListeners('unhandledRejection')
  process.removeAllListeners('uncaughtException')
  process.removeAllListeners('uncaughtExceptionMonitor')
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', { reason })
  })
  process.on('uncaughtExceptionMonitor', (err) => {
    logger.error('Uncaught exception', { err })
  })
}
