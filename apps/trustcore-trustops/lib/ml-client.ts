/**
 * ML client — TrustCore TrustOps app.
 *
 * Provides a singleton ML client for trust operations ML features:
 * mandate volume forecasting, breach probability scoring, and timeline prediction.
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

export type { MlClient, AiExecutionTelemetry }

export { buildAiEngineVersion }
