/**
 * Next.js Instrumentation Hook — Flow (Nzila Commerce & Production Engine).
 *
 * Runs the canonical Nzila boot sequence: OTel tracing, SLO/RED metrics,
 * env validation, and boot invariant assertions.
 */
import { createAppBoot } from '@nzila/os-core/telemetry'

export async function register() {
  await createAppBoot('flow')()

  try {
    const { initEventPersistence } = await import('@/lib/events/persist')
    initEventPersistence()
  } catch {
    // Non-critical — events still work in-process without persistence
  }
}
