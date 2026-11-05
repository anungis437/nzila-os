/**
 * @nzila/qbo — Environment validation (Zod)
 *
 * Validates Intuit QBO env vars at server bootstrap.
 * Call `validateQboEnv()` once during app initialization.
 */
import { z } from 'zod'

export const qboEnvSchema = z.object({
  INTUIT_APP_ID: z.guid('INTUIT_APP_ID must be a valid UUID'),
  INTUIT_CLIENT_ID: z.string().min(1, 'INTUIT_CLIENT_ID is required'),
  INTUIT_CLIENT_SECRET: z.string().min(1, 'INTUIT_CLIENT_SECRET is required'),
  INTUIT_ENVIRONMENT: z.enum(['sandbox', 'production']).default('sandbox'),
  INTUIT_REDIRECT_URI: z.string().url('INTUIT_REDIRECT_URI must be a valid URL'),
})

export type QboEnv = z.infer<typeof qboEnvSchema>

let _cachedEnv: QboEnv | null = null

/**
 * Validate and return QBO env vars.
 * Throws on first call if env is invalid. Caches result.
 */
export function getQboEnv(): QboEnv {
  if (_cachedEnv) return _cachedEnv

  const result = qboEnvSchema.safeParse({
    INTUIT_APP_ID: process.env.INTUIT_APP_ID,
    INTUIT_CLIENT_ID: process.env.INTUIT_CLIENT_ID,
    INTUIT_CLIENT_SECRET: process.env.INTUIT_CLIENT_SECRET,
    INTUIT_ENVIRONMENT: process.env.INTUIT_ENVIRONMENT,
    INTUIT_REDIRECT_URI: process.env.INTUIT_REDIRECT_URI,
  })

  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    throw new Error(`QBO env validation failed:\n${formatted}`)
  }

  _cachedEnv = result.data
  return _cachedEnv
}

/** Validate QBO env eagerly. Call during server bootstrap. */
export function validateQboEnv(): void {
  getQboEnv()
}
