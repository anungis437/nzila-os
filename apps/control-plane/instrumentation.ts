/**
 * Next.js Instrumentation Hook — Control Plane.
 *
 * Runs the canonical Nzila boot sequence: OTel tracing, SLO/RED metrics,
 * env validation, and boot invariant assertions.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
import { createAppBoot } from '@nzila/os-core/telemetry'
import { assertControlPlaneBootEnv } from './lib/boot-env'

assertControlPlaneBootEnv()

export const register = createAppBoot('control-plane')
