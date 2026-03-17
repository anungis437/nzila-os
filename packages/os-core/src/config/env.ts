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
  // AI / ML gateway (used by all intelligent apps)
  AI_CORE_URL: z.string().url().default('http://localhost:4100'),
  AI_API_KEY: z.string().min(1).optional(),
  ML_CORE_URL: z.string().url().default('http://localhost:4200'),
  ML_API_KEY: z.string().min(1).optional(),
  // Rate limiting
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
})

// ---------------------------------------------------------------------------
// Clerk auth mixin (re-used across authenticated Next.js apps)
// ---------------------------------------------------------------------------
const clerkMixin = {
  CLERK_SECRET_KEY: z.string().startsWith('sk_'),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().startsWith('pk_'),
  CLERK_WEBHOOK_SECRET: z.string().startsWith('whsec_').optional(),
}

// ---------------------------------------------------------------------------
// App-specific extensions
// ---------------------------------------------------------------------------
const consoleSchema = baseSchema.extend({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  ...clerkMixin,
  STRIPE_SECRET_KEY: z.string().startsWith('sk_').optional(),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_').optional(),
})

const partnersSchema = baseSchema.extend({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_PARTNERS_URL: z.string().url().optional(),
  ...clerkMixin,
})

const webSchema = baseSchema.extend({
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
})

const unionEyesSchema = baseSchema.extend({
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  CLERK_SECRET_KEY: z.string().startsWith('sk_').optional(),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().startsWith('pk_').optional(),
})

const cfoSchema = baseSchema.extend({
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  ...clerkMixin,
  STRIPE_SECRET_KEY: z.string().startsWith('sk_').optional(),
  QBO_CLIENT_ID: z.string().min(1).optional(),
  QBO_CLIENT_SECRET: z.string().min(1).optional(),
})

const shopQuoterSchema = baseSchema.extend({
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_CONSOLE_URL: z.string().url().default('http://localhost:3001'),
  NEXT_PUBLIC_WEB_URL: z.string().url().default('http://localhost:3000'),
  ...clerkMixin,
})

const nacpExamsSchema = baseSchema.extend({
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  ...clerkMixin,
})

const zongaSchema = baseSchema.extend({
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  ...clerkMixin,
  STRIPE_SECRET_KEY: z.string().startsWith('sk_').optional(),
})

const abrSchema = baseSchema.extend({
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:8001'),
  EVIDENCE_SEAL_KEY: z.string().min(1).optional(),
  ...clerkMixin,
})

const orchestratorSchema = baseSchema.extend({
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  GITHUB_TOKEN: z.string().min(1).optional(),
  GITHUB_REPO_OWNER: z.string().default('anungis437'),
  GITHUB_REPO_NAME: z.string().default('nzila-automation'),
})

const mobilitySchema = baseSchema.extend({
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  ...clerkMixin,
})

const mobilityClientPortalSchema = baseSchema.extend({
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  ...clerkMixin,
})

const ponduSchema = baseSchema.extend({
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  ...clerkMixin,
})

const coraSchema = baseSchema.extend({
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  ...clerkMixin,
})

const tradeSchema = baseSchema.extend({
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  ...clerkMixin,
  STRIPE_SECRET_KEY: z.string().startsWith('sk_').optional(),
})

const platformAdminSchema = baseSchema.extend({
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  ...clerkMixin,
})

// ---------------------------------------------------------------------------
// Validation helper
// ---------------------------------------------------------------------------
type AppName =
  | 'console'
  | 'partners'
  | 'web'
  | 'union-eyes'
  | 'cfo'
  | 'shop-quoter'
  | 'flow'
  | 'nacp-exams'
  | 'zonga'
  | 'abr'
  | 'orchestrator-api'
  | 'mobility'
  | 'mobility-client-portal'
  | 'pondu'
  | 'cora'
  | 'trade'
  | 'platform-admin'
  | 'base'

const SCHEMAS: Record<AppName, ZodTypeAny> = {
  base: baseSchema,
  console: consoleSchema,
  partners: partnersSchema,
  web: webSchema,
  'union-eyes': unionEyesSchema,
  cfo: cfoSchema,
  'shop-quoter': shopQuoterSchema,
  flow: shopQuoterSchema,
  'nacp-exams': nacpExamsSchema,
  zonga: zongaSchema,
  abr: abrSchema,
  'orchestrator-api': orchestratorSchema,
  mobility: mobilitySchema,
  'mobility-client-portal': mobilityClientPortalSchema,
  pondu: ponduSchema,
  cora: coraSchema,
  trade: tradeSchema,
  'platform-admin': platformAdminSchema,
}

export type ValidatedEnv<T extends AppName = 'base'> = T extends 'console'
  ? z.infer<typeof consoleSchema>
  : T extends 'partners'
    ? z.infer<typeof partnersSchema>
    : T extends 'web'
      ? z.infer<typeof webSchema>
      : T extends 'union-eyes'
        ? z.infer<typeof unionEyesSchema>
        : T extends 'cfo'
          ? z.infer<typeof cfoSchema>
          : T extends 'shop-quoter'
            ? z.infer<typeof shopQuoterSchema>
            : T extends 'flow'
              ? z.infer<typeof shopQuoterSchema>
              : T extends 'nacp-exams'
              ? z.infer<typeof nacpExamsSchema>
              : T extends 'zonga'
                ? z.infer<typeof zongaSchema>
                : T extends 'abr'
                  ? z.infer<typeof abrSchema>
                  : T extends 'orchestrator-api'
                    ? z.infer<typeof orchestratorSchema>
                    : T extends 'mobility'
                      ? z.infer<typeof mobilitySchema>
                      : T extends 'mobility-client-portal'
                        ? z.infer<typeof mobilityClientPortalSchema>
                        : T extends 'pondu'
                          ? z.infer<typeof ponduSchema>
                          : T extends 'cora'
                            ? z.infer<typeof coraSchema>
                            : T extends 'trade'
                              ? z.infer<typeof tradeSchema>
                              : T extends 'platform-admin'
                                ? z.infer<typeof platformAdminSchema>
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

export {
  baseSchema,
  consoleSchema,
  partnersSchema,
  webSchema,
  unionEyesSchema,
  cfoSchema,
  shopQuoterSchema,
  nacpExamsSchema,
  zongaSchema,
  abrSchema,
  orchestratorSchema,
  mobilitySchema,
  mobilityClientPortalSchema,
  ponduSchema,
  coraSchema,
  tradeSchema,
  platformAdminSchema,
}
