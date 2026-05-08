/**
 * AI client — TrustCore app.
 *
 * Provides a singleton AI client for privacy & compliance intelligence:
 * risk scoring, PIA assistance, policy gap analysis, and consent signal processing.
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
    provider,
    modelUsed,
    engineVersion: buildAiEngineVersion(provider, modelUsed),
    tokensIn,
    tokensOut,
    tokenCostUsd,
    latencyMs,
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

export { toExecutionTelemetry }
export type { AiClient, AiExecutionTelemetry, DataClass, EmbedResult, ExtractResult, GenerateResult }
