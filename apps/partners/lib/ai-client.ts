/**
 * AI client — Partners app.
 *
 * Provides a singleton AI client for partner intelligence features:
 * deal scoring, commission forecasting, and certification recommendations.
 *
 * All AI calls are routed through the governed @nzila/ai-sdk layer
 * (profiles, budgets, redaction, auditing).
 */
import {
  buildAiEngineVersion,
  createAiClient,
  type AiClient,
  type AiExecutionTelemetry,
  type DataClass,
  type EmbedResult,
  type ExtractResult,
  type GenerateResult,
} from '@nzila/ai-sdk'

const APP_KEY = 'partners'

let _client: AiClient | null = null

function resolveAiBaseUrl(): string {
  const configured = process.env.AI_CORE_URL?.trim()
  if (configured) return configured
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    return 'http://localhost:4100'
  }
  throw new Error('Missing required environment variable outside dev/test: AI_CORE_URL')
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

export function getAiClient(): AiClient {
  if (!_client) {
    _client = createAiClient({
      baseUrl: resolveAiBaseUrl(),
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
  const result = await runAICompletionDetailed(prompt, opts)
  return result.content
}

export async function runAICompletionDetailed(
  prompt: string,
  opts?: { orgId?: string; profile?: string; dataClass?: DataClass },
): Promise<{ content: string; execution: AiExecutionTelemetry }> {
  const client = getAiClient()
  const result = await client.generate({
    orgId: opts?.orgId ?? 'platform',
    appKey: APP_KEY,
    profileKey: opts?.profile ?? `${APP_KEY}-default`,
    input: prompt,
    dataClass: opts?.dataClass ?? 'internal',
  })
  return { content: result.content, execution: toExecutionTelemetry(result) }
}

/**
 * Generate embeddings for input text(s).
 */
export async function runAIEmbed(
  input: string | string[],
  opts?: { orgId?: string; profile?: string },
): Promise<number[][]> {
  const result = await runAIEmbedDetailed(input, opts)
  return result.embeddings
}

export async function runAIEmbedDetailed(
  input: string | string[],
  opts?: { orgId?: string; profile?: string },
): Promise<{ embeddings: number[][]; execution: AiExecutionTelemetry }> {
  const client = getAiClient()
  const result = await client.embed({
    orgId: opts?.orgId ?? 'platform',
    appKey: APP_KEY,
    profileKey: opts?.profile ?? `${APP_KEY}-embed`,
    input,
    dataClass: 'internal',
  })
  return { embeddings: result.embeddings, execution: toExecutionTelemetry(result) }
}

/**
 * Extract structured JSON from text using a named prompt template.
 */
export async function runAIExtraction(
  input: string,
  promptKey: string,
  opts?: { orgId?: string; profile?: string; variables?: Record<string, string> },
): Promise<Record<string, unknown>> {
  const result = await runAIExtractionDetailed(input, promptKey, opts)
  return result.data
}

export async function runAIExtractionDetailed(
  input: string,
  promptKey: string,
  opts?: { orgId?: string; profile?: string; variables?: Record<string, string> },
): Promise<{ data: Record<string, unknown>; execution: AiExecutionTelemetry }> {
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
  return { data: result.data, execution: toExecutionTelemetry(result) }
}
