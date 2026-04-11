/**
 * Next.js Instrumentation Hook — Mobility Client Portal.
 *
 * Runs the canonical Nzila boot sequence: OTel tracing, SLO/RED metrics,
 * env validation, and boot invariant assertions.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
import { createAppBoot } from '@nzila/os-core/telemetry'

export const register = createAppBoot('mobility-client-portal')
