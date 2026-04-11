/**
 * Next.js Instrumentation Hook — Web (marketing) app.
 *
 * Lighter than business apps — no boot invariants or SLO metrics needed.
 */
import { createAppBoot } from '@nzila/os-core/telemetry'

export const register = createAppBoot('web', {
  skipMetrics: true,
  skipBootAssert: true,
})
