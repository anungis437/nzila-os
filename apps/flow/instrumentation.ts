/**
 * Next.js Instrumentation Hook — Flow (Nzila Commerce & Production Engine).
 *
 * Runs the canonical Nzila boot sequence: OTel tracing, SLO/RED metrics,
 * env validation, and boot invariant assertions.
 */
import { createAppBoot } from '@nzila/os-core/telemetry'

export async function register() {
  await createAppBoot('flow')()

  // Keep edge instrumentation free of Node-only dependencies.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { bootstrapFlowControlLayer } = await import('@/lib/control/bootstrap')
  await bootstrapFlowControlLayer()
}
