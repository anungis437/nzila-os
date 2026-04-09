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
