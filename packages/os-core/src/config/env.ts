/**
 * @nzila/os-core — Environment Variable Validation
 *
 * Each app calls validateEnv() at startup. If any required variable is
 * missing or malformed the process exits with a clear error message instead
 * of failing silently at runtime.
 */
import { z, ZodError, type ZodTypeAny } from 'zod'

// ---------------------------------------------------------------------------
// Shared base schema (all apps)
// ---------------------------------------------------------------------------
const baseSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid connection URL'),
  DIRECT_URL: z.string().url('DIRECT_URL must be a valid connection URL').optional(),
  BLOB_CONNECTION_STRING: z.string().min(1).optional(),
  BLOB_ACCOUNT_NAME: z.string().min(1).optional(),
  BLOB_CONTAINER_NAME: z.string().min(1).optional(),
  KEY_VAULT_URI: z.string().url().optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  OTEL_SERVICE_NAME: z.string().optional(),
})

// ---------------------------------------------------------------------------
// App-specific extensions
// ---------------------------------------------------------------------------
const consoleSchema = baseSchema.extend({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  CLERK_SECRET_KEY: z.string().startsWith('sk_'),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().startsWith('pk_'),
  CLERK_WEBHOOK_SECRET: z.string().startsWith('whsec_').optional(),
  STRIPE_SECRET_KEY: z.string().startsWith('sk_').optional(),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_').optional(),
})

const partnersSchema = baseSchema.extend({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  CLERK_SECRET_KEY: z.string().startsWith('sk_'),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().startsWith('pk_'),
})

const webSchema = baseSchema.extend({
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
})

const unionEyesSchema = baseSchema.extend({
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  CLERK_SECRET_KEY: z.string().startsWith('sk_').optional(),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().startsWith('pk_').optional(),
})

// ---------------------------------------------------------------------------
// Validation helper
// ---------------------------------------------------------------------------
type AppName = 'console' | 'partners' | 'web' | 'union-eyes' | 'base'

const SCHEMAS: Record<AppName, ZodTypeAny> = {
  base: baseSchema,
  console: consoleSchema,
  partners: partnersSchema,
  web: webSchema,
  'union-eyes': unionEyesSchema,
}

export type ValidatedEnv<T extends AppName = 'base'> = T extends 'console'
  ? z.infer<typeof consoleSchema>
  : T extends 'partners'
    ? z.infer<typeof partnersSchema>
    : T extends 'web'
      ? z.infer<typeof webSchema>
      : T extends 'union-eyes'
        ? z.infer<typeof unionEyesSchema>
        : z.infer<typeof baseSchema>

/**
 * Validate environment variables for the given app.
 * Throws on invalid config in production; logs warnings in development.
 */
export function validateEnv<T extends AppName>(appName: T): ValidatedEnv<T> {
  const schema = SCHEMAS[appName]
  if (!schema) throw new Error(`Unknown app name: ${appName}`)

  try {
    return schema.parse(process.env) as ValidatedEnv<T>
  } catch (err) {
    if (err instanceof ZodError) {
      const issues = err.issues
        .map((i) => `  ${i.path.join('.')}: ${i.message}`)
        .join('\n')
      const message = `[${appName}] Invalid environment configuration:\n${issues}`
      if (process.env.NODE_ENV === 'production') {
        throw new Error(message)
      } else {
        console.warn(message)
        // Return partial parse for development convenience
        return schema.parse({ ...process.env }) as ValidatedEnv<T>
      }
    }
    throw err
  }
}

export { baseSchema, consoleSchema, partnersSchema, webSchema, unionEyesSchema }
