/**
 * @nzila/ml-core — Training Data Provenance Tracker
 * iSSDLC W2-2: Dataset ID ↔ consent record ↔ model version linking
 *
 * Tracks the full lineage from raw data → processed dataset → model version,
 * with consent and PIA references at every stage.
 *
 * @module evidence/training-provenance
 */

import { TRAINING_DATA_CONSENT_MANIFEST, type TrainingDatasetConsentRecord } from './training-consent'

// ── Types ────────────────────────────────────────────────────────────────────

export interface DatasetProvenance {
  datasetKey: string
  version: string
  sourceDescription: string
  collectionMethod: 'api_export' | 'manual_upload' | 'pipeline_etl' | 'synthetic_generation'
  collectedAt: string
  collectedBy: string
  recordCount: number
  hashDigest: string  // SHA-256 of dataset content
  transformations: DataTransformation[]
  consentRecord: TrainingDatasetConsentRecord | null
  piaStatus: 'approved' | 'pending' | 'not_required'
  retentionPolicy: {
    maxRetentionDays: number
    deletionMethod: 'hard_delete' | 'anonymize' | 'archive'
  }
}

export interface DataTransformation {
  step: number
  operation: string  // e.g., 'pii_redaction', 'tokenization', 'feature_extraction'
  inputHash: string
  outputHash: string
  performedAt: string
  performedBy: string
  reversible: boolean
}

export interface ModelDatasetLink {
  modelKey: string
  modelVersion: string
  datasetKey: string
  datasetVersion: string
  trainingStartedAt: string
  trainingCompletedAt: string | null
  hyperparameters: Record<string, unknown>
  metrics: Record<string, number>
  approvedBy: string | null
  approvedAt: string | null
}

// ── Provenance Registry ──────────────────────────────────────────────────────

export const DATASET_PROVENANCE_REGISTRY: DatasetProvenance[] = [
  {
    datasetKey: 'ue_cases_priority_v1',
    version: '1.0.0',
    sourceDescription: 'Union-Eyes grievance case data exported via admin API',
    collectionMethod: 'api_export',
    collectedAt: '2025-02-15T00:00:00Z',
    collectedBy: 'platform-team',
    recordCount: 12847,
    hashDigest: 'pending-calculation',
    transformations: [
      {
        step: 1,
        operation: 'pii_redaction',
        inputHash: 'pending',
        outputHash: 'pending',
        performedAt: '2025-02-16T00:00:00Z',
        performedBy: 'data-pipeline',
        reversible: false,
      },
      {
        step: 2,
        operation: 'feature_extraction',
        inputHash: 'pending',
        outputHash: 'pending',
        performedAt: '2025-02-16T00:00:00Z',
        performedBy: 'data-pipeline',
        reversible: false,
      },
    ],
    consentRecord: TRAINING_DATA_CONSENT_MANIFEST.find(r => r.datasetKey === 'ue_cases_priority_v1') ?? null,
    piaStatus: 'pending',
    retentionPolicy: {
      maxRetentionDays: 730,
      deletionMethod: 'hard_delete',
    },
  },
  {
    datasetKey: 'stripe_txn_anomaly_v2',
    version: '2.0.0',
    sourceDescription: 'Stripe transaction records (org-level, no member PII)',
    collectionMethod: 'api_export',
    collectedAt: '2024-10-01T00:00:00Z',
    collectedBy: 'cfo-team',
    recordCount: 45230,
    hashDigest: 'pending-calculation',
    transformations: [
      {
        step: 1,
        operation: 'anonymization',
        inputHash: 'pending',
        outputHash: 'pending',
        performedAt: '2024-10-02T00:00:00Z',
        performedBy: 'data-pipeline',
        reversible: false,
      },
    ],
    consentRecord: TRAINING_DATA_CONSENT_MANIFEST.find(r => r.datasetKey === 'stripe_txn_anomaly_v2') ?? null,
    piaStatus: 'approved',
    retentionPolicy: {
      maxRetentionDays: 1095,
      deletionMethod: 'anonymize',
    },
  },
  {
    datasetKey: 'sla_risk_labels_v1',
    version: '1.0.0',
    sourceDescription: 'Synthetic SLA risk labels from anonymised case durations',
    collectionMethod: 'synthetic_generation',
    collectedAt: '2025-01-10T00:00:00Z',
    collectedBy: 'platform-team',
    recordCount: 50000,
    hashDigest: 'pending-calculation',
    transformations: [],
    consentRecord: TRAINING_DATA_CONSENT_MANIFEST.find(r => r.datasetKey === 'sla_risk_labels_v1') ?? null,
    piaStatus: 'not_required',
    retentionPolicy: {
      maxRetentionDays: 365,
      deletionMethod: 'hard_delete',
    },
  },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns all datasets with pending PIA status (blocks production training).
 */
export function getDatasetsPendingPia(): DatasetProvenance[] {
  return DATASET_PROVENANCE_REGISTRY.filter(d => d.piaStatus === 'pending')
}

/**
 * Validate that every dataset in the provenance registry has a consent record.
 * Returns violations.
 */
export function validateProvenanceConsent(): string[] {
  const violations: string[] = []
  for (const dataset of DATASET_PROVENANCE_REGISTRY) {
    if (!dataset.consentRecord) {
      violations.push(`${dataset.datasetKey}@${dataset.version}: missing consent record`)
    }
    if (dataset.consentRecord?.containsMemberPii && dataset.piaStatus === 'pending') {
      violations.push(`${dataset.datasetKey}@${dataset.version}: contains member PII but PIA is pending`)
    }
  }
  return violations
}
