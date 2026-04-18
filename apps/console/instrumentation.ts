/**
 * Next.js Instrumentation Hook — Console app.
 *
 * Runs the canonical Nzila boot sequence: OTel tracing, SLO/RED metrics,
 * env validation, and boot invariant assertions.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
import { createAppBoot } from '@nzila/os-core/telemetry'
import { assertConsoleBootEnv } from './lib/boot-env'

assertConsoleBootEnv()

export const register = createAppBoot('console')
