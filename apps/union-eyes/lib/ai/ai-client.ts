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
    _client = createAiClient({
      baseUrl: AI_BASE_URL,
      getToken: async () => {
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
} as const
