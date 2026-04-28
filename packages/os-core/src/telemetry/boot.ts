/**
 * @nzila/os-core — Canonical App Boot Sequence
 *
 * Single entry point that runs the full observability + validation boot
 * sequence for any Nzila Next.js app.  Eliminates copy-paste drift across
 * instrumentation.ts files.
 *
 * Usage in instrumentation.ts:
 *   import { createAppBoot } from '@nzila/os-core/telemetry'
 *   export async function register() { await createAppBoot('console')() }
 */

type AppName =
  | 'console'
  | 'partners'
  | 'web'
  | 'union-eyes'
  | 'cfo'
  | 'flow'
  | 'nacp-exams'
  | 'zonga'
  | 'abr'
  | 'orchestrator-api'
  | 'mobility'
  | 'mobility-client-portal'
  | 'agrimo'
  | 'cora'
  | 'trade'
  | 'platform-admin'
  | 'control-plane'
  | 'nzila-hq'

export interface AppBootOptions {
  /** Skip env validation (e.g. for marketing-only apps) */
  skipEnvValidation?: boolean
  /** Skip boot invariant assertions */
  skipBootAssert?: boolean
  /** Skip metrics init (e.g. for lightweight apps) */
  skipMetrics?: boolean
}

/**
 * Returns an async function that runs the canonical Nzila boot sequence:
 *   1. OpenTelemetry tracing (initOtel)
 *   2. SLO/RED metrics (initMetrics)
 *   3. Environment validation (validateEnv)
 *   4. Boot invariant assertions (assertBootInvariants)
 *
 * Each step is individually try/caught — failures degrade gracefully in dev,
 * fail-fast only for boot invariants in production.
 *
 * The returned function includes Next.js runtime guards (skips Edge + build).
 */
export function createAppBoot(appName: AppName, options?: AppBootOptions) {
  return async function boot(): Promise<void> {
    // Guard: skip in non-Node runtimes (Edge, browser) and during builds
    if (process.env.NEXT_RUNTIME !== 'nodejs') return
    if (process.env.NEXT_PHASE === 'phase-production-build') return

    // 1. OpenTelemetry tracing
    try {
      const { initOtel } = await import('./otel')
      await initOtel({ appName })
    } catch {
      // Non-critical — tracing degrades gracefully
    }

    // 2. SLO/RED metrics
    if (!options?.skipMetrics) {
      try {
        const { initMetrics } = await import('./metrics')
        initMetrics(appName)
      } catch {
        // Non-critical — metrics degrade gracefully
      }
    }

    // 3. Environment validation
    if (!options?.skipEnvValidation) {
      try {
        const { validateEnv } = await import('../config/env')
        validateEnv(appName as Parameters<typeof validateEnv>[0])
      } catch {
        // Non-critical in dev — env validation warns but doesn't crash
      }
    }

    // 4. Boot invariant assertions
    if (!options?.skipBootAssert) {
      try {
        const { assertBootInvariants } = await import('../boot-assert')
        await assertBootInvariants()
      } catch {
        if (process.env.NODE_ENV === 'production') throw new Error('Boot invariants failed')
      }
    }
  }
}
