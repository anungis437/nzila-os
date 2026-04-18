/**
 * Next.js Instrumentation Hook — Platform Admin.
 *
 * Runs the canonical Nzila boot sequence: OTel tracing, SLO/RED metrics,
 * env validation, and boot invariant assertions.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
import { createAppBoot } from '@nzila/os-core/telemetry'
import { assertPlatformAdminBootEnv } from './lib/boot-env'

assertPlatformAdminBootEnv()

export const register = createAppBoot('platform-admin')
