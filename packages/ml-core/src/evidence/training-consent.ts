/**
 * @nzila/ml-core — Training data consent manifest
 *
 * Provides a structured consent record for each dataset used to train
 * or fine-tune Nzila ML models. This manifest must be updated whenever
 * a new dataset is ingested or a model is retrained.
 *
 * Regulatory basis:
 *  - PIPEDA Principle 3 — meaningful consent for data use
 *  - Québec Law 25 / Bill 64 — purpose limitation for personal data
 *  - GDPR Art. 6(1)(a) / Art. 9 — lawful basis for sensitive data processing
 *
 * NZ-RISK-018 — ML training data consent (no evidence of consent basis for
 *   member behavioural data used in priority-classification model).
 *
 * @module evidence/training-consent
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type ConsentBasis =
  | 'explicit_member_consent'   // member signed explicit AI data use consent
  | 'collective_agreement'      // CBA includes data-use clause covering AI
  | 'legitimate_interest'       // controller LIA completed and documented
  | 'anonymised'                // data irreversibly de-identified before use
  | 'synthetic'                 // fully synthetic / no real member data

export type DataSensitivity =
  | 'public'
  | 'internal'
  | 'sensitive'   // personal data
  | 'regulated'   // special category (health, union membership, immigration)

export interface TrainingDatasetConsentRecord {
  /** Matches ml_datasets.dataset_key in the registry. */
  datasetKey: string
  /** Human-readable description. */
  description: string
  /** Lawful basis for processing this dataset in ML training. */
  consentBasis: ConsentBasis
  /** Sensitivity tier of the data. */
  sensitivity: DataSensitivity
  /** Whether the dataset contains personal data (PII) of union members. */
  containsMemberPii: boolean
  /**
   * Reference to the Privacy Impact Assessment (PIA) or Data Protection
   * Impact Assessment (DPIA) signed off for this dataset.
   * null = PIA not yet completed (must be remediated before production use).
   */
  piaDocumentRef: string | null
  /** Date of last consent / PIA review (ISO 8601). */
  lastReviewedAt: string
  /** Team member responsible for this record. */
  dataOwner: string
  /**
   * If containsMemberPii is true and consentBasis is NOT 'anonymised' or
   * 'synthetic', a member-facing data use notice MUST be in effect.
   */
  memberNoticeRequired: boolean
  /**
   * Free-text note; use for remediation status or known gaps.
   * Entries here are surfaced in the evidence pack under DEFERRED_ITEMS.
   */
  notes?: string
}

// ── Consent manifest ─────────────────────────────────────────────────────────

/**
 * All datasets referenced here must be registered in `ml_datasets`.
 * Add a new entry whenever a dataset is onboarded or an existing one changes.
 *
 * POLICY: Any `piaDocumentRef: null` entry MUST be blocked from production
 * training runs until the PIA is completed and signed off.
 */
export const TRAINING_DATA_CONSENT_MANIFEST: TrainingDatasetConsentRecord[] = [
  {
    datasetKey: 'ue_cases_priority_v1',
    description: 'Union-Eyes grievance case data used to train the case-priority classification model.',
    consentBasis: 'collective_agreement',
    sensitivity: 'sensitive',
    containsMemberPii: true,
    piaDocumentRef: null, // TODO(NZ-RISK-018): Complete PIA before next training run
    lastReviewedAt: '2025-03-01',
    dataOwner: 'platform-team',
    memberNoticeRequired: true,
    notes:
      'PIA in progress. Current consent basis relies on CBA data clause (Art. 32). ' +
      'Must be updated to include AI-processing language before next retraining cycle.',
  },
  {
    datasetKey: 'stripe_txn_anomaly_v2',
    description: 'Stripe transaction records for anomaly detection model training.',
    consentBasis: 'legitimate_interest',
    sensitivity: 'sensitive',
    containsMemberPii: false, // org-level financial data, not individual member PII
    piaDocumentRef: 'pia-stripe-anomaly-2024-11',
    lastReviewedAt: '2024-11-15',
    dataOwner: 'cfo-team',
    memberNoticeRequired: false,
  },
  {
    datasetKey: 'sla_risk_labels_v1',
    description: 'Synthetic SLA risk labels generated from anonymised historical case durations.',
    consentBasis: 'synthetic',
    sensitivity: 'internal',
    containsMemberPii: false,
    piaDocumentRef: 'pia-sla-synthetic-2025-01',
    lastReviewedAt: '2025-01-20',
    dataOwner: 'platform-team',
    memberNoticeRequired: false,
  },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns all datasets that are missing a PIA document reference.
 * Use this in pre-training checks to gate training runs.
 */
export function getPendingPiaDatasets(): TrainingDatasetConsentRecord[] {
  return TRAINING_DATA_CONSENT_MANIFEST.filter((r) => r.piaDocumentRef === null)
}

/**
 * Throws if any dataset used in a training run is missing its PIA.
 * Call this at the start of any automated model training pipeline.
 *
 * @param datasetKeys  Keys of datasets to be used in this run.
 */
export function assertTrainingConsent(datasetKeys: string[]): void {
  const pending = TRAINING_DATA_CONSENT_MANIFEST.filter(
    (r) => datasetKeys.includes(r.datasetKey) && r.piaDocumentRef === null,
  )
  if (pending.length > 0) {
    const names = pending.map((r) => r.datasetKey).join(', ')
    throw new Error(
      `[NZ-RISK-018] Training run blocked: the following datasets are missing a Privacy Impact Assessment: ${names}. ` +
      `Complete the PIA and update training-consent.ts before proceeding.`,
    )
  }
}
