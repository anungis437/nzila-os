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

import { createAiClient, type AiClient } from '@nzila/ai-sdk'
import { auth } from '@clerk/nextjs/server'

const AI_BASE_URL =
  process.env.AI_SDK_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'http://localhost:3000'

/** Singleton AI client – lazily initialised per-request via getToken. */
let _client: AiClient | null = null

export function getAiClient(): AiClient {
  if (!_client) {
    const serviceKey = process.env.AI_SERVICE_KEY
    _client = createAiClient({
      baseUrl: AI_BASE_URL,
      getToken: async () => {
        // Prefer service key for cross-app auth (different Clerk instances)
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
} as const
