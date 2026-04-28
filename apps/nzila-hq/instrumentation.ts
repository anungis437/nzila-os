/**
 * Next.js Instrumentation Hook — Nzila HQ.
 *
 * Runs the canonical Nzila boot sequence: OTel tracing, SLO/RED metrics,
 * env validation, and boot invariant assertions.
 */
import { createAppBoot } from '@nzila/os-core/telemetry'
import { assertNzilaHqBootEnv } from './lib/boot-env'

assertNzilaHqBootEnv()

export const register = createAppBoot('nzila-hq')
