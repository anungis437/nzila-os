/**
 * Ingestion Module
 *
 * Hardened data ingestion pipeline for real-world CUPE pilot data.
 * Covers all 13 sections of the ingestion hardening specification.
 */

export {
  ingestGrievanceBatch,
  type IngestionOptions,
  type IngestionResult,
} from './batch-ingest';

export {
  validateIngestionBatch,
  computeRecordFingerprint,
  computeTimelineEventHash,
  mapImportStatus,
  type IngestionGrievanceRecord,
  type ValidationResult,
  type ValidationIssue,
} from './validation-pipeline';

export {
  verifyImportBatch,
  type VerificationResult,
  type VerificationIssue,
} from './post-import-verification';

export {
  jaccardSimilarity,
  timestampProximity,
  partyNameMatch,
  computeCaseSimilarity,
  computeDocumentHash,
  scanBatchForDuplicates,
  type FuzzyMatch,
  type DedupScanResult,
} from './fuzzy-dedup';

export {
  listBatches,
  getBatchDetail,
  getMetricsSummary,
  type BatchSummary,
  type BatchDetail,
  type MetricsSummary,
} from './migration-metrics';
