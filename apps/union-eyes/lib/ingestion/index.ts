/**
 * Ingestion Module
 *
 * Hardened data ingestion pipeline for historical case data.
 * Covers all 13 sections of the ingestion hardening specification.
 */

export {
  declareSourceManifest,
  sourceManifestDigest,
  type SourceManifestDeclaration,
} from './source-manifest';

export {
  verifyImportedDocumentContent,
  isImportedDocumentContentAvailable,
  type DocumentVerificationOutcome,
  type DocumentVerificationState,
} from './document-evidence';

export {
  ingestGrievanceBatch,
  DocumentReimportConflictError,
  ReimportConflictError,
  type IngestionOptions,
  type IngestionResult,
} from './batch-ingest';

export {
  validateIngestionBatch,
  computeRecordFingerprint,
  computeTimelineEventHash,
  mapImportStatus,
  importMappingDigest,
  resolveImportPriority,
  resolveImportStep,
  type ImportValueMapping,
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
