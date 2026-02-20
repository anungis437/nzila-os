/**
 * @nzila/ml-sdk — API Client
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  SINGLE ENTRY POINT FOR ALL NZILA ML SIGNALS                    ║
 * ║                                                                  ║
 * ║  All Nzila apps MUST import ML functions from this package.      ║
 * ║  Direct imports from packages/db schema for ml* tables are      ║
 * ║  PROHIBITED (enforced by eslint no-shadow-ml rule).             ║
 * ║                                                                  ║
 * ║  Usage:                                                          ║
 * ║    import { createMlClient } from '@nzila/ml-sdk'               ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */
import { MlSdkError } from './types'
import type {
  MlActiveModelResponse,
  MlTrainingRunResponse,
  MlInferenceRunResponse,
  StripeDailyScoreResponse,
  StripeTxnScoreResponse,
  MlScoresDailyParams,
  MlScoresTxnParams,
} from './types'

// ── Config ───────────────────────────────────────────────────────────────────

export interface MlSdkConfig {
  /** Base URL of the Nzila OS console (e.g., https://console.nzila.io or http://localhost:3001) */
  baseUrl: string
  /** Clerk session token or API key getter */
  getToken: () => string | Promise<string>
}

// ── Client factory ───────────────────────────────────────────────────────────

export function createMlClient(config: MlSdkConfig) {
  async function headers(): Promise<Record<string, string>> {
    const token = await config.getToken()
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    }
  }

  async function get<T>(path: string, params?: Record<string, string | boolean | number | undefined>): Promise<T> {
    const url = new URL(`${config.baseUrl}${path}`)
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined) url.searchParams.set(k, String(v))
      }
    }
    const res = await fetch(url.toString(), { method: 'GET', headers: await headers() })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new MlSdkError('API_ERROR', `ML API ${url.pathname} → ${res.status}: ${body}`, res.status)
    }
    return res.json() as Promise<T>
  }

  return {
    /**
     * Get all active models for an entity.
     */
    getActiveModels(entityId: string): Promise<MlActiveModelResponse[]> {
      return get<MlActiveModelResponse[]>('/api/ml/models/active', { entityId })
    },

    /**
     * Get recent training runs for an entity.
     */
    getTrainingRuns(entityId: string, limit = 20): Promise<MlTrainingRunResponse[]> {
      return get<MlTrainingRunResponse[]>('/api/ml/runs/training', { entityId, limit })
    },

    /**
     * Get recent inference runs for an entity.
     */
    getInferenceRuns(entityId: string, limit = 20): Promise<MlInferenceRunResponse[]> {
      return get<MlInferenceRunResponse[]>('/api/ml/runs/inference', { entityId, limit })
    },

    /**
     * Get Stripe daily anomaly scores for a date range.
     */
    getStripeDailyScores(params: MlScoresDailyParams): Promise<StripeDailyScoreResponse[]> {
      return get<StripeDailyScoreResponse[]>('/api/ml/scores/stripe/daily', params as Record<string, string>)
    },

    /**
     * Get Stripe transaction anomaly scores (paginated).
     */
    getStripeTxnScores(
      params: MlScoresTxnParams,
    ): Promise<{ items: StripeTxnScoreResponse[]; nextCursor: string | null }> {
      return get('/api/ml/scores/stripe/transactions', params as Record<string, string>)
    },
  }
}

export type MlClient = ReturnType<typeof createMlClient>
