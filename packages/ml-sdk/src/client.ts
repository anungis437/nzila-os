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
  MlModelResponse,
  MlActiveModelResponse,
  MlTrainingRunResponse,
  MlInferenceRunResponse,
  StripeDailyScoreResponse,
  StripeTxnScoreResponse,
  MlScoresDailyParams,
  MlScoresTxnParams,
  UEPriorityScoreResponse,
  UESlaRiskScoreResponse,
  UEPriorityScoresParams,
  UESlaRiskScoresParams,
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
     * Get all models for an entity (all statuses).
     */
    getAllModels(entityId: string, status?: string): Promise<MlModelResponse[]> {
      return get<MlModelResponse[]>('/api/ml/models', { entityId, status })
    },

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
      return get<StripeDailyScoreResponse[]>('/api/ml/scores/stripe/daily', { ...params })
    },

    /**
     * Get Stripe transaction anomaly scores (paginated).
     */
    getStripeTxnScores(
      params: MlScoresTxnParams,
    ): Promise<{ items: StripeTxnScoreResponse[]; nextCursor: string | null; totalInPeriod: number; anomalyInPeriod: number }> {
      return get('/api/ml/scores/stripe/transactions', { ...params })
    },

    /**
     * Get Union Eyes case priority scores (paginated).
     * Returns predicted priority class + confidence for each case in the period.
     */
    getUEPriorityScores(
      params: UEPriorityScoresParams,
    ): Promise<{ items: UEPriorityScoreResponse[]; nextCursor: string | null; total: number }> {
      return get('/api/ml/scores/ue/cases/priority', { ...params })
    },

    /**
     * Get Union Eyes case SLA breach risk scores (paginated).
     * Returns P(breach) + predicted breach decision for each case in the period.
     */
    getUESlaRiskScores(
      params: UESlaRiskScoresParams,
    ): Promise<{ items: UESlaRiskScoreResponse[]; nextCursor: string | null; total: number }> {
      return get('/api/ml/scores/ue/cases/sla-risk', { ...params })
    },
  }
}

export type MlClient = ReturnType<typeof createMlClient>
