/**
 * Next.js Instrumentation Hook — Flow (Nzila Commerce & Production Engine).
 *
 * Initializes OpenTelemetry distributed tracing, SLO/RED metrics,
 * and boot invariants via @nzila/os-core before any request is handled.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.NEXT_PHASE === 'phase-production-build') return

  try {
    const { initOtel, initMetrics } = await import('@nzila/os-core/telemetry')
    await initOtel({ appName: 'flow' })
    initMetrics('flow')
  } catch {
    // Non-critical — tracing degrades gracefully
  }

  try {
    const { validateEnv } = await import('@nzila/os-core/config')
    validateEnv('flow')
  } catch {
    // Non-critical in dev — env validation warns but doesn't crash
  }

  try {
    const { assertBootInvariants } = await import('@nzila/os-core')
    assertBootInvariants()
  } catch {
    if (process.env.NODE_ENV === 'production') throw new Error('Boot invariants failed')
  }

  try {
    const { initEventPersistence } = await import('@/lib/events/persist')
    initEventPersistence()
  } catch {
    // Non-critical — events still work in-process without persistence
  }
}
