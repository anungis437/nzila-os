/**
 * Orchestrator API environment contract.
 */
import { z } from 'zod'

const OrchestratorEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  ORCHESTRATOR_API_KEY: z.string().min(1, 'ORCHESTRATOR_API_KEY is required in production').optional(),
  DATABASE_URL: z.string().min(1).optional(),
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(4000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(200),
  LOG_LEVEL: z.string().min(1).default('info'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().min(1).optional(),
})

export type OrchestratorEnv = z.infer<typeof OrchestratorEnvSchema>

export function getOrchestratorEnv(env: NodeJS.ProcessEnv = process.env): OrchestratorEnv {
  const parsed = OrchestratorEnvSchema.parse(env)
  if (parsed.NODE_ENV !== 'development' && !parsed.DATABASE_URL) {
    throw new Error('DATABASE_URL is required outside development mode')
  }
  if (parsed.NODE_ENV === 'production' && !parsed.ORCHESTRATOR_API_KEY) {
    throw new Error('ORCHESTRATOR_API_KEY is required in production')
  }
  return parsed
}
