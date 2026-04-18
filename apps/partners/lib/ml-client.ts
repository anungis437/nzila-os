/**
 * ML client — Partners app.
 *
 * Provides a singleton ML client for partner ML features:
 * deal conversion scoring, partner health prediction, and commission forecasting.
 *
 * All ML calls are routed through the governed @nzila/ml-sdk layer.
 */
import { buildAiEngineVersion, type AiExecutionTelemetry } from '@nzila/ai-sdk'
import { createMlClient, type MlClient } from '@nzila/ml-sdk'

let _client: MlClient | null = null

function resolveMlBaseUrl(): string {
  const configured = process.env.ML_CORE_URL?.trim()
  if (configured) return configured
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    return 'http://localhost:4200'
  }
  throw new Error('Missing required environment variable outside dev/test: ML_CORE_URL')
}

export function getMlClient(): MlClient {
  if (!_client) {
    _client = createMlClient({
      baseUrl: resolveMlBaseUrl(),
      getToken: () => process.env.ML_API_KEY ?? '',
    })
  }
  return _client
}

/**
 * Retrieve the latest inference result for a named model.
 */
export async function runPrediction(opts: {
  model: string
  features?: Record<string, unknown>
  orgId?: string
}): Promise<Record<string, unknown> | null> {
  const result = await runPredictionDetailed(opts)
  return result.data
}

export async function runPredictionDetailed(opts: {
  model: string
  features?: Record<string, unknown>
  orgId?: string
}): Promise<{ data: Record<string, unknown> | null; execution: AiExecutionTelemetry | null }> {
  const client = getMlClient()
  const runs = await client.getInferenceRuns(opts.orgId ?? 'platform', 10)
  const match = runs.find((r) => r.modelKey === opts.model)
  if (!match) return { data: null, execution: null }

  const latencyMs = match.finishedAt
    ? Math.max(0, new Date(match.finishedAt).getTime() - new Date(match.startedAt).getTime())
    : null

  return {
    data: match.summaryJson ?? null,
    execution: {
      requestId: match.id,
      traceId: match.id,
      modelUsed: match.modelKey,
      provider: 'ml',
      engineVersion: buildAiEngineVersion('ml', match.modelKey),
      latencyMs,
      tokenCostUsd: null,
      tokensIn: null,
      tokensOut: null,
    },
  }
}
