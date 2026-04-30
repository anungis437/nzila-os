/**
 * Next.js Instrumentation Hook — Maestria app.
 *
 * Runs the canonical Nzila boot sequence: OTel tracing, SLO/RED metrics,
 * env validation, and boot invariant assertions.
 */
import { createAppBoot } from '@nzila/os-core/telemetry'

export const register = createAppBoot('maestria')
