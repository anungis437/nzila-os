/**
 * @nzila/ml-core — barrel export
 *
 * Server-side ML subsystem: registry, evidence, types.
 * Apps must NOT import from this package directly; use @nzila/ml-sdk.
 */
export * from './types'
export { getActiveModel, listModels, activateModel, retireModel, getDataset } from './registry'
export { collectMlEvidence } from './evidence/collector'
export type {
  MlEvidenceAppendix,
  MlDatasetRef,
  MlModelRef,
  MlInferenceRef,
  MlAnomalySummary,
  TopTxnAnomaly,
} from './evidence/collector'

// Training data consent manifest (NZ-RISK-018)
export {
  TRAINING_DATA_CONSENT_MANIFEST,
  getPendingPiaDatasets,
  assertTrainingConsent,
  type TrainingDatasetConsentRecord,
  type ConsentBasis,
  type DataSensitivity,
} from './evidence/training-consent'
