/**
 * Nzila OS — AI Control Plane environment configuration
 *
 * Zod-validated env vars with fail-fast for missing required vars.
 * Import this module early in server startup to validate config.
 */
import { z } from 'zod'

// ── Schema ──────────────────────────────────────────────────────────────────

const aiEnvSchema = z
  .object({
    // ── Provider selection ──────────────────────────────────────────────
    AI_DEFAULT_PROVIDER: z.enum(['azure_openai', 'openai', 'anthropic']).default('azure_openai'),

    // ── Azure OpenAI (required when AI_DEFAULT_PROVIDER=azure_openai) ──
    AZURE_OPENAI_ENDPOINT: z.string().url().optional(),
    AZURE_OPENAI_API_KEY: z.string().min(1).optional(),
    AZURE_OPENAI_API_VERSION: z.string().default('2024-06-01'),
    AZURE_OPENAI_DEPLOYMENT_TEXT: z.string().min(1).optional(),
    AZURE_OPENAI_DEPLOYMENT_EMBEDDINGS: z.string().min(1).optional(),

    // ── Direct OpenAI (required when AI_DEFAULT_PROVIDER=openai) ───────
    OPENAI_API_KEY: z.string().min(1).optional(),
    OPENAI_PROJECT: z.string().optional(),
    OPENAI_MODEL_TEXT: z.string().optional(),        // default: gpt-4o
    OPENAI_MODEL_EMBEDDINGS: z.string().optional(),  // default: text-embedding-3-small

    // ── Anthropic (required when AI_DEFAULT_PROVIDER=anthropic) ────────
    ANTHROPIC_API_KEY: z.string().min(1).optional(),
    ANTHROPIC_MODEL_TEXT: z.string().optional(),     // default: claude-sonnet-4-6

    // ── Embeddings provider (when default provider lacks embeddings) ───
    AI_EMBEDDINGS_PROVIDER: z.enum(['azure_openai', 'openai']).optional(),

    // ── Logging & redaction ─────────────────────────────────────────────
    AI_LOG_PAYLOADS: z
      .enum(['true', 'false'])
      .default('true')
      .transform((v) => v === 'true'),
    AI_REDACTION_MODE: z.enum(['strict', 'balanced', 'off']).default('strict'),

    // ── Model defaults ──────────────────────────────────────────────────
    AI_MAX_TOKENS_DEFAULT: z.coerce.number().int().positive().default(1024),
    AI_TEMPERATURE_DEFAULT: z.coerce.number().min(0).max(2).default(0.2),

    // ── Encryption (optional — required if storing sensitive payloads) ──
    AI_ENCRYPTION_KEY: z.string().optional(),

    // ── Blob containers ─────────────────────────────────────────────────
    AZURE_STORAGE_CONTAINER_EVIDENCE: z.string().default('evidence'),
    AZURE_STORAGE_CONTAINER_EXPORTS: z.string().default('exports'),
  })
  .superRefine((data, ctx) => {
    if (data.AI_DEFAULT_PROVIDER === 'azure_openai') {
      const required = [
        'AZURE_OPENAI_ENDPOINT',
        'AZURE_OPENAI_API_KEY',
        'AZURE_OPENAI_DEPLOYMENT_TEXT',
        'AZURE_OPENAI_DEPLOYMENT_EMBEDDINGS',
      ] as const
      for (const key of required) {
        if (!data[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `Required when AI_DEFAULT_PROVIDER=azure_openai`,
          })
        }
      }
    }
    if (data.AI_DEFAULT_PROVIDER === 'openai') {
      if (!data.OPENAI_API_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['OPENAI_API_KEY'],
          message: `Required when AI_DEFAULT_PROVIDER=openai`,
        })
      }
    }
    if (data.AI_DEFAULT_PROVIDER === 'anthropic') {
      if (!data.ANTHROPIC_API_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ANTHROPIC_API_KEY'],
          message: `Required when AI_DEFAULT_PROVIDER=anthropic`,
        })
      }
    }
  })

export type AiEnv = z.infer<typeof aiEnvSchema>

// ── Singleton ───────────────────────────────────────────────────────────────

let _validated: AiEnv | null = null

/**
 * Validate and return the AI env config.
 * Throws on first call if required vars are missing.
 * Cached after first successful validation.
 */
export function getAiEnv(): AiEnv {
  if (_validated) return _validated

  const result = aiEnvSchema.safeParse(process.env)
  if (!result.success) {
    const missing = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    throw new Error(
      `[AI Control Plane] Missing or invalid environment variables:\n${missing}`,
    )
  }

  _validated = result.data
  return _validated
}

/**
 * Check whether AI env is configured (does not throw).
 * Useful for conditional feature flags.
 */
export function isAiConfigured(): boolean {
  try {
    getAiEnv()
    return true
  } catch {
    return false
  }
}
