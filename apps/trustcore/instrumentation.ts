/**
 * Next.js Instrumentation Hook — TrustCore app.
 *
 * Wires OTel-based error monitoring and performance tracing via os-core telemetry.
 */
import { createAppBoot } from '@nzila/os-core/telemetry'

export const register = createAppBoot('trustcore', {
  skipMetrics: false,
  skipBootAssert: false,
})
