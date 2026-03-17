/**
 * AI client — Flow app.
 *
 * Provides a singleton AI client for commerce intelligence features:
 * smart pricing suggestions, product recommendation, and RFP extraction.
 *
 * All AI calls are routed through the governed @nzila/ai-sdk layer
 * (profiles, budgets, redaction, auditing).
 */
import { createAiClient, type AiClient, type DataClass } from '@nzila/ai-sdk'

const APP_KEY = 'flow'

let _client: AiClient | null = null

export function getAiClient(): AiClient {
  if (!_client) {
    _client = createAiClient({
      baseUrl: process.env.AI_CORE_URL ?? 'http://localhost:4100',
      getToken: () => process.env.AI_API_KEY ?? '',
    })
  }
  return _client
}

/**
 * Run text generation and return the content string.
 */
export async function runAICompletion(
  prompt: string,
  opts?: { orgId?: string; profile?: string; dataClass?: DataClass },
): Promise<string> {
  const client = getAiClient()
  const result = await client.generate({
    orgId: opts?.orgId ?? 'platform',
    appKey: APP_KEY,
    profileKey: opts?.profile ?? `${APP_KEY}-default`,
    input: prompt,
    dataClass: opts?.dataClass ?? 'internal',
  })
  return result.content
}

/**
 * Generate embeddings for input text(s).
 */
export async function runAIEmbed(
  input: string | string[],
  opts?: { orgId?: string; profile?: string },
): Promise<number[][]> {
  const client = getAiClient()
  const result = await client.embed({
    orgId: opts?.orgId ?? 'platform',
    appKey: APP_KEY,
    profileKey: opts?.profile ?? `${APP_KEY}-embed`,
    input,
    dataClass: 'internal',
  })
  return result.embeddings
}

/**
 * Extract structured JSON from text using a named prompt template.
 */
export async function runAIExtraction(
  input: string,
  promptKey: string,
  opts?: { orgId?: string; profile?: string; variables?: Record<string, string> },
): Promise<Record<string, unknown>> {
  const client = getAiClient()
  const result = await client.extract({
    orgId: opts?.orgId ?? 'platform',
    appKey: APP_KEY,
    profileKey: opts?.profile ?? `${APP_KEY}-extract`,
    promptKey,
    input,
    variables: opts?.variables,
    dataClass: 'internal',
  })
  return result.data
}
