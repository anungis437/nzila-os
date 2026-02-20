/**
 * @nzila/ml-sdk — Shared ML API types
 *
 * These mirror the API response shapes from apps/console/app/api/ml/*.
 * No DB imports — pure TypeScript interfaces safe for any client/server.
 */

export type { MlModelStatus, MlRunStatus, MlModelKey, MlDatasetKey, FeatureSpec } from './types-internal'

// ── API response types ───────────────────────────────────────────────────────

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
  error: string | null
  createdAt: string
}

export interface MlInferenceRunResponse {
  id: string
  entityId: string
  modelId: string
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
