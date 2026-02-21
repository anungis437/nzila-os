/**
 * @nzila/ml-sdk — Shared ML API types
 *
 * These mirror the API response shapes from apps/console/app/api/ml/*.
 * No DB imports — pure TypeScript interfaces safe for any client/server.
 */

export type { MlModelStatus, MlRunStatus, MlModelKey, MlDatasetKey, FeatureSpec, UEPriorityClass } from './types-internal'

// ── API response types ───────────────────────────────────────────────────────

export interface MlModelResponse {
  id: string
  entityId: string
  modelKey: string
  algorithm: string
  version: number
  status: string
  hyperparamsJson: Record<string, unknown> | null
  meta: {
    trainingDatasetId: string | null
    artifactDocumentId: string | null
    metricsDocumentId: string | null
    approvedBy: string | null
    approvedAt: string | null
  }
  createdAt: string
  updatedAt: string
}

export interface MlActiveModelResponse {
  id: string
  entityId: string
  modelKey: string
  algorithm: string
  version: number
  status: string
  meta: {
    trainingDatasetId: string | null
    artifactDocumentId: string | null
    metricsDocumentId: string | null
    approvedBy: string | null
    approvedAt: string | null
  }
  createdAt: string
  updatedAt: string
}

export interface MlTrainingRunResponse {
  id: string
  entityId: string
  modelKey: string
  datasetId: string
  status: string
  startedAt: string
  finishedAt: string | null
  rowsProcessed?: number | null
  error: string | null
  createdAt: string
}

export interface MlInferenceRunResponse {
  id: string
  entityId: string
  modelId: string
  modelKey: string
  status: string
  startedAt: string
  finishedAt: string | null
  inputPeriodStart: string
  inputPeriodEnd: string
  summaryJson: Record<string, unknown>
  error: string | null
  createdAt: string
}

export interface StripeDailyScoreResponse {
  id: string
  date: string
  score: string
  isAnomaly: boolean
  threshold: string
  modelId: string
  modelKey: string
  inferenceRunId: string | null
  /** Only present when includeFeatures=true and caller has permission */
  features?: Record<string, unknown>
}

export interface StripeTxnScoreResponse {
  id: string
  occurredAt: string
  amount: string
  currency: string
  score: string
  isAnomaly: boolean
  threshold: string
  modelId: string
  modelKey: string
  inferenceRunId: string | null
  stripePaymentIntentId: string | null
  stripeChargeId: string | null
  /** Only present when includeFeatures=true and caller has permission */
  features?: Record<string, unknown>
}

export interface MlScoresDailyParams {
  entityId: string
  startDate: string
  endDate: string
  modelKey?: string
  includeFeatures?: boolean
}

export interface MlScoresTxnParams {
  entityId: string
  startDate: string
  endDate: string
  minScore?: number
  isAnomaly?: boolean
  limit?: number
  cursor?: string
  includeFeatures?: boolean
}

// ── SDK Error ────────────────────────────────────────────────────────────────

export class MlSdkError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status?: number,
  ) {
    super(message)
    this.name = 'MlSdkError'
  }
}

// ── UE ML signal types ────────────────────────────────────────────────────────

export interface UEPriorityScoreResponse {
  id: string
  caseId: string
  occurredAt: string
  score: string
  predictedPriority: string
  actualPriority: string | null
  modelId: string
  modelKey: string
  inferenceRunId: string | null
  createdAt: string
  /** Only present when includeFeatures=true and caller is entity_admin */
  features?: Record<string, unknown>
}

export interface UESlaRiskScoreResponse {
  id: string
  caseId: string
  occurredAt: string
  probability: string
  predictedBreach: boolean
  actualBreach: boolean | null
  modelId: string
  modelKey: string
  inferenceRunId: string | null
  createdAt: string
  /** Only present when includeFeatures=true and caller is entity_admin */
  features?: Record<string, unknown>
}

export interface UEPriorityScoresParams {
  entityId: string
  startDate: string
  endDate: string
  priority?: string
  limit?: number
  cursor?: string
  includeFeatures?: boolean
}

export interface UESlaRiskScoresParams {
  entityId: string
  startDate: string
  endDate: string
  /** Filter by breach prediction: true | false */
  breach?: boolean
  /** Minimum probability threshold for filtering results */
  minProb?: number
  limit?: number
  cursor?: string
  includeFeatures?: boolean
}
