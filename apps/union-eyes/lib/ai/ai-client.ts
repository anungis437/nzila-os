/**
 * Centralised AI Client — @nzila/ai-sdk wrapper
 *
 * CONSTRAINT (INV-01): All AI calls MUST go through this client.
 * Direct imports of `openai`, `anthropic`, or any provider SDK are blocked
 * by the ESLint no-shadow-ai rule.
 *
 * Usage:
 *   import { getAiClient, UE_APP_KEY } from '@/lib/ai/ai-client'
 *   const ai = getAiClient()
 *   const result = await ai.generate({ ... })
 */

import {
  buildAiEngineVersion,
  createAiClient,
  type AiClient,
  type AiExecutionTelemetry,
  type EmbedResult,
  type ExtractResult,
  type GenerateResult,
} from '@nzila/ai-sdk'
import { auth } from '@nzila/platform-auth/entra/server'

function resolveAiBaseUrl(): string {
  const configured = process.env.AI_SDK_BASE_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (configured) return configured
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    return 'http://localhost:3000'
  }
  throw new Error('Missing required environment variable outside dev/test: AI_SDK_BASE_URL or NEXT_PUBLIC_APP_URL')
}

function toExecutionTelemetry(result: GenerateResult | EmbedResult | ExtractResult): AiExecutionTelemetry {
  const provider = 'provider' in result ? result.provider : 'ai'
  const modelUsed = 'model' in result ? result.model : 'unknown'
  const tokensIn = 'tokensIn' in result ? result.tokensIn : 'tokensUsed' in result ? result.tokensUsed : null
  const tokensOut = 'tokensOut' in result ? result.tokensOut : null
  const tokenCostUsd = 'costUsd' in result ? result.costUsd : null
  const latencyMs = 'latencyMs' in result ? result.latencyMs : null

  return {
    requestId: result.requestId,
    traceId: result.requestId,
    modelUsed,
    provider,
    engineVersion: buildAiEngineVersion(provider, modelUsed),
    latencyMs,
    tokenCostUsd,
    tokensIn,
    tokensOut,
  }
}

/** Singleton AI client – lazily initialised per-request via getToken. */
let _client: AiClient | null = null

export function getAiClient(): AiClient {
  if (!_client) {
    const serviceKey = process.env.AI_SERVICE_KEY
    _client = createAiClient({
      baseUrl: resolveAiBaseUrl(),
      getToken: async () => {
        // Prefer service key for cross-app auth (different auth instances)
        if (serviceKey) return serviceKey
        const session = await auth()
        const token = await session.getToken()
        return token ?? ''
      },
    })
  }
  return _client
}

/** App key for all union-eyes AI calls. */
export const UE_APP_KEY = 'union-eyes'

/**
 * System-level org UUID used for ALL union-eyes AI generate() calls.
 * Must match a row in the `orgs` table and have capability profiles seeded.
 * The domain organizationId is passed separately in the AI input payload
 * for data-scoping — it is NOT used for profile resolution.
 */
export const UE_SYSTEM_ORG_ID = '00000000-0000-0000-0000-000000000000'

/**
 * Profile keys registered in the AI control plane for union-eyes.
 * Each maps to a centrally managed prompt + model + guardrails config.
 */
export const UE_PROFILES = {
  CLAUSE_CLASSIFICATION: 'ue-clause-classification',
  TAG_GENERATION: 'ue-tag-generation',
  CROSS_REFERENCE: 'ue-cross-reference',
  CLAUSE_EXTRACTION: 'ue-clause-extraction',
  CLAUSE_SUMMARY: 'ue-clause-summary',
  CLAUSE_QUALITY: 'ue-clause-quality',
  PRECEDENT_CLASSIFICATION: 'ue-precedent-classification',
  PRECEDENT_KEYWORDS: 'ue-precedent-keywords',
  PRECEDENT_APPLICABILITY: 'ue-precedent-applicability',
  CLAIM_ANALYSIS: 'ue-claim-analysis',
  LEGAL_MEMORANDUM: 'ue-legal-memorandum',
  CHATBOT: 'ue-chatbot',
  EMBEDDINGS: 'ue-embeddings',
  // AI Intelligence Layer profiles
  GRIEVANCE_TRIAGE: 'ue-grievance-triage',
  CLAUSE_REASONING: 'ue-clause-reasoning',
  EMPLOYER_RISK: 'ue-employer-risk',
  STEWARD_COPILOT: 'ue-steward-copilot',
  EXECUTIVE_INSIGHTS: 'ue-executive-insights',
  // Pension intelligence profiles
  PENSION_FUNDING_ANALYSIS: 'ue-pension-funding-analysis',
  PENSION_BENEFIT_PROJECTION: 'ue-pension-benefit-projection',
  PENSION_TRUSTEE_SUMMARY: 'ue-pension-trustee-summary',
  // Financial intelligence profile
  FINANCIAL_ANALYSIS: 'ue-financial-analysis',
  // Knowledge Transfer Intelligence Layer
  KNOWLEDGE_SUMMARY: 'ue-knowledge-summary',
  EXPERTISE_EXTRACTION: 'ue-expertise-extraction',
  CONTINUITY_RISK: 'ue-continuity-risk',
  TOPIC_EXTRACTION: 'ue-topic-extraction',
} as const

export async function runAICompletionDetailed(input: Parameters<AiClient['generate']>[0]): Promise<{ content: string; execution: AiExecutionTelemetry }> {
  const result = await getAiClient().generate(input)
  return { content: result.content, execution: toExecutionTelemetry(result) }
}

