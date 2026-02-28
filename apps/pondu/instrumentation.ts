/**
 * Next.js Instrumentation Hook — Pondu Ops app.
 *
 * Initializes OpenTelemetry distributed tracing, SLO/RED metrics,
 * and boot invariants via @nzila/os-core before any request is handled.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.NEXT_PHASE === 'phase-production-build') return

  try {
    const { initOtel, initMetrics } = await import('@nzila/os-core/telemetry')
    await initOtel({ appName: 'pondu' })
    initMetrics('pondu')
  } catch {
    // Non-critical — tracing degrades gracefully
  }

  try {
    const { assertBootInvariants } = await import('@nzila/os-core')
    assertBootInvariants()
  } catch {
    // Log but don't block startup in dev
    if (process.env.NODE_ENV === 'production') throw new Error('Boot invariants failed')
  }
}
