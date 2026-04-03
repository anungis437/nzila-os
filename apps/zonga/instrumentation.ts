/**
 * Next.js Instrumentation Hook — Zonga app.
 *
 * Initializes OpenTelemetry distributed tracing, SLO/RED metrics,
 * Sentry error monitoring, and boot invariants via @nzila/os-core
 * before any request is handled.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.NEXT_PHASE === 'phase-production-build') return

  try {
    const { initOtel, initMetrics } = await import('@nzila/os-core/telemetry')
    await initOtel({ appName: 'zonga' })
    initMetrics('zonga')
  } catch {
    // Non-critical — tracing degrades gracefully
  }

  // Sentry server-side initialization (conditional on SENTRY_DSN env var)
  await import('./sentry.server.config')

  try {
    const { validateEnv } = await import('@nzila/os-core/config')
    validateEnv('zonga')
  } catch {
    // Non-critical in dev — env validation warns but doesn't crash
  }

  try {
    const { assertBootInvariants } = await import('@nzila/os-core')
    assertBootInvariants()
  } catch {
    if (process.env.NODE_ENV === 'production') throw new Error('Boot invariants failed')
  }
}

export const onRequestError = async (...args: Parameters<typeof import('@sentry/nextjs').captureRequestError>) => {
  const Sentry = await import('@sentry/nextjs')
  return Sentry.captureRequestError(...args)
}
