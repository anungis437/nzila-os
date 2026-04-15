/**
 * Next.js Instrumentation Hook — Flow (Nzila Commerce & Production Engine).
 *
 * Runs the canonical Nzila boot sequence: OTel tracing, SLO/RED metrics,
 * env validation, and boot invariant assertions.
 */
import { createAppBoot } from '@nzila/os-core/telemetry'
import { bootstrapFlowControlLayer } from '@/lib/control/bootstrap'

export async function register() {
  await createAppBoot('flow')()
  await bootstrapFlowControlLayer()
}
