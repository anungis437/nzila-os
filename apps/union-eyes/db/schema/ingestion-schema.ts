/**
 * Ingestion Schema
 *
 * Drizzle schema definitions for the ingestion hardening tables:
 * - ingestion_batches: tracks each import run
 * - ingestion_records: per-record status within a batch
 * - grievance_timeline_events: deduplicated timeline with content hashing
 *
 * @see Migration 0089_ingestion_hardening.sql
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  real,
  bigint,
  check,
  foreignKey,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { organizations } from '../schema-organizations';
import { grievances } from './grievance-schema';

// ─── Ingestion Batches ────────────────────────────────────────────────────────

export const ingestionBatches = pgTable('ingestion_batches', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id),
  sourceSystem: varchar('source_system', { length: 100 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  totalRecords: integer('total_records').notNull().default(0),
  processed: integer('processed').notNull().default(0),
  succeeded: integer('succeeded').notNull().default(0),
  failed: integer('failed').notNull().default(0),
  skipped: integer('skipped').notNull().default(0),
  errorSummary: jsonb('error_summary').default([]),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdBy: varchar('created_by', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  metadata: jsonb('metadata').default({}),
}, (table) => [
  index('idx_ingestion_batches_org').on(table.organizationId),
  index('idx_ingestion_batches_status').on(table.status),
]);

// ─── Ingestion Records ───────────────────────────────────────────────────────

export const ingestionRecords = pgTable('ingestion_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  batchId: uuid('batch_id')
    .notNull()
    .references(() => ingestionBatches.id, { onDelete: 'cascade' }),
  recordIndex: integer('record_index').notNull(),
  recordType: varchar('record_type', { length: 50 }).notNull(),
  externalId: varchar('external_id', { length: 255 }),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  resolvedId: uuid('entity_id'),
  errorMessage: text('error_message'),
  errorDetails: jsonb('error_details'),
  fingerprint: varchar('fingerprint', { length: 64 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
}, (table) => [
  index('idx_ingestion_records_batch').on(table.batchId),
  index('idx_ingestion_records_status').on(table.status),
  index('idx_ingestion_records_ext_id').on(table.externalId),
]);

// ─── Grievance Timeline Events ───────────────────────────────────────────────

export const grievanceTimelineEvents = pgTable('grievance_timeline_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  grievanceId: uuid('grievance_id')
    .notNull()
    .references(() => grievances.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  eventDate: timestamp('event_date', { withTimezone: true }).notNull(),
  actor: varchar('actor', { length: 255 }),
  description: text('description'),
  contentHash: varchar('content_hash', { length: 64 }).notNull(),
  sourceSystem: varchar('source_system', { length: 100 }),
  importBatchId: uuid('import_batch_id'),
  sequenceNumber: integer('sequence_number').notNull().default(0),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('idx_timeline_events_dedup').on(
    table.grievanceId,
    table.eventDate,
    table.eventType,
    table.contentHash,
  ),
  index('idx_timeline_events_grievance').on(table.grievanceId),
  index('idx_timeline_events_org').on(table.organizationId),
  index('idx_timeline_events_date').on(table.eventDate),
]);

// ─── Duplicate Groups ────────────────────────────────────────────────────────

export const duplicateGroups = pgTable('duplicate_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id),
  groupType: varchar('group_type', { length: 30 }).notNull(), // 'case' | 'document' | 'timeline_event'
  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending | confirmed | dismissed | merged
  autoScore: real('auto_score'),
  matchReasons: jsonb('match_reasons').notNull().default([]),
  reviewedBy: varchar('reviewed_by', { length: 255 }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  metadata: jsonb('metadata').default({}),
}, (table) => [
  index('idx_duplicate_groups_org').on(table.organizationId),
  index('idx_duplicate_groups_status').on(table.status),
  index('idx_duplicate_groups_type').on(table.groupType),
]);

// ─── Duplicate Group Members ─────────────────────────────────────────────────

export const duplicateGroupMembers = pgTable('duplicate_group_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id')
    .notNull()
    .references(() => duplicateGroups.id, { onDelete: 'cascade' }),
  recordType: varchar('record_type', { length: 30 }).notNull(), // 'grievance' | 'document' | 'timeline_event'
  recordId: uuid('record_id').notNull(),
  similarityScore: real('similarity_score'),
  isAnchor: boolean('is_anchor').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_dup_members_group').on(table.groupId),
  index('idx_dup_members_record').on(table.recordType, table.recordId),
  uniqueIndex('idx_dup_members_unique').on(table.groupId, table.recordType, table.recordId),
]);

// ─── Data Quality Warnings ──────────────────────────────────────────────────

export const dataQualityWarnings = pgTable('data_quality_warnings', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id),
  recordType: varchar('record_type', { length: 30 }).notNull(),
  recordId: uuid('record_id').notNull(),
  batchId: uuid('batch_id').references(() => ingestionBatches.id),
  severity: varchar('severity', { length: 10 }).notNull().default('warning'), // info | warning | error
  category: varchar('category', { length: 50 }).notNull(),
  fieldName: varchar('field_name', { length: 100 }),
  message: text('message').notNull(),
  resolved: boolean('resolved').notNull().default(false),
  resolvedBy: varchar('resolved_by', { length: 255 }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_quality_warnings_org').on(table.organizationId),
  index('idx_quality_warnings_record').on(table.recordType, table.recordId),
  index('idx_quality_warnings_batch').on(table.batchId),
  index('idx_quality_warnings_resolved').on(table.resolved),
]);

// ─── Import provenance (platform 0091, RLS scoped 0064) ───────────────────────
// The migration is authoritative and also installs the guards that make these rows immutable once written or sealed.
// Reached only through lib/ingestion (batch-ingest.ts, source-manifest.ts, document-evidence.ts, post-import-verification.ts).

export const ueIngestionSourceManifests = pgTable('ue_ingestion_source_manifests', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  sourceSystem: varchar('source_system', { length: 100 }).notNull(),
  manifestDigest: varchar('manifest_digest', { length: 64 }).notNull(),
  expectedCaseIds: jsonb('expected_case_ids').notNull(),
  expectedCaseCount: integer('expected_case_count').notNull(),
  expectedDocumentCount: integer('expected_document_count').notNull(),
  declaredBy: text('declared_by').notNull(),
  declaredAt: timestamp('declared_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('ue_ingestion_source_manifests_org_id_idx').on(table.organizationId, table.id),
  uniqueIndex('ue_ingestion_source_manifests_digest_idx').on(table.organizationId, table.sourceSystem, table.manifestDigest),
  check('ue_ingestion_source_manifests_digest_check', sql`${table.manifestDigest} ~ '^[0-9a-f]{64}$'`),
  check('ue_ingestion_source_manifests_ids_check', sql`jsonb_typeof(${table.expectedCaseIds}) = 'array'`),
  check('ue_ingestion_source_manifests_count_check', sql`${table.expectedCaseCount} >= 0 AND ${table.expectedDocumentCount} >= 0 AND ${table.expectedCaseCount} = jsonb_array_length(${table.expectedCaseIds})`),
]);

export const ueIngestionBatchManifests = pgTable('ue_ingestion_batch_manifests', {
  batchId: uuid('batch_id').primaryKey(),
  organizationId: uuid('organization_id').notNull(),
  sourceSystem: varchar('source_system', { length: 100 }).notNull(),
  sourceManifestId: uuid('source_manifest_id'),
  predecessorBatchId: uuid('predecessor_batch_id'),
  recordCount: integer('record_count').notNull(),
  recordDigest: varchar('record_digest', { length: 64 }).notNull(),
  mappingDigest: varchar('mapping_digest', { length: 64 }).notNull(),
  succeeded: integer('succeeded'),
  failed: integer('failed'),
  skipped: integer('skipped'),
  outcome: varchar('outcome', { length: 20 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  sealedAt: timestamp('sealed_at', { withTimezone: true }),
}, (table) => [
  uniqueIndex('ue_ingestion_batch_manifests_org_batch_idx').on(table.organizationId, table.batchId),
  uniqueIndex('ue_ingestion_batch_manifests_successor_idx').on(table.predecessorBatchId).where(sql`predecessor_batch_id IS NOT NULL`),
  uniqueIndex('ue_ingestion_batch_manifests_root_idx').on(table.organizationId, table.sourceSystem).where(sql`predecessor_batch_id IS NULL`),
  check('ue_ingestion_batch_manifests_digest_check', sql`${table.recordDigest} ~ '^[0-9a-f]{64}$' AND ${table.mappingDigest} ~ '^[0-9a-f]{64}$'`),
  check('ue_ingestion_batch_manifests_not_self_check', sql`${table.predecessorBatchId} IS NULL OR ${table.predecessorBatchId} <> ${table.batchId}`),
  check('ue_ingestion_batch_manifests_outcome_check', sql`${table.outcome} IS NULL OR ${table.outcome} IN ('completed', 'partial', 'failed')`),
  check('ue_ingestion_batch_manifests_sealed_check', sql`(${table.sealedAt} IS NULL AND ${table.outcome} IS NULL AND ${table.succeeded} IS NULL AND ${table.failed} IS NULL AND ${table.skipped} IS NULL)
    OR (${table.sealedAt} IS NOT NULL AND ${table.outcome} IS NOT NULL AND ${table.succeeded} >= 0 AND ${table.failed} >= 0 AND ${table.skipped} >= 0
        AND ${table.succeeded} + ${table.failed} + ${table.skipped} = ${table.recordCount})`),
  foreignKey({ name: 'ue_ingestion_batch_manifests_batch_fk', columns: [table.batchId], foreignColumns: [ingestionBatches.id] }),
  foreignKey({ name: 'ue_ingestion_batch_manifests_predecessor_fk', columns: [table.organizationId, table.predecessorBatchId], foreignColumns: [table.organizationId, table.batchId] }),
  foreignKey({ name: 'ue_ingestion_batch_manifests_source_fk', columns: [table.organizationId, table.sourceManifestId], foreignColumns: [ueIngestionSourceManifests.organizationId, ueIngestionSourceManifests.id] }),
]);

export const ueIngestionRecordProvenance = pgTable('ue_ingestion_record_provenance', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  batchId: uuid('batch_id').notNull(),
  grievanceId: uuid('grievance_id').notNull(),
  externalCaseId: varchar('external_case_id', { length: 255 }).notNull(),
  recordFingerprint: varchar('record_fingerprint', { length: 64 }).notNull(),
  sourceStatusRaw: varchar('source_status_raw', { length: 255 }).notNull(),
  sourcePriorityRaw: varchar('source_priority_raw', { length: 255 }),
  sourceStepRaw: varchar('source_step_raw', { length: 255 }),
  mappedStatus: varchar('mapped_status', { length: 20 }).notNull(),
  mappedPriority: varchar('mapped_priority', { length: 20 }).notNull(),
  mappedStep: varchar('mapped_step', { length: 20 }),
  observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
}, (table) => [
  uniqueIndex('ue_ingestion_record_provenance_batch_case_idx').on(table.batchId, table.externalCaseId),
  index('ue_ingestion_record_provenance_case_idx').on(table.organizationId, table.grievanceId),
  check('ue_ingestion_record_provenance_fingerprint_check', sql`${table.recordFingerprint} ~ '^[0-9a-f]{64}$'`),
  foreignKey({ name: 'ue_ingestion_record_provenance_batch_fk', columns: [table.organizationId, table.batchId], foreignColumns: [ueIngestionBatchManifests.organizationId, ueIngestionBatchManifests.batchId] }),
]);

export const ueImportedDocumentEvidence = pgTable('ue_imported_document_evidence', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  documentId: uuid('document_id').notNull(),
  batchId: uuid('batch_id').notNull(),
  sourceDeclaredDigest: varchar('source_declared_digest', { length: 64 }),
  verificationState: varchar('verification_state', { length: 20 }).notNull().default('reference_only'),
  verifiedDigest: varchar('verified_digest', { length: 64 }),
  byteSize: bigint('byte_size', { mode: 'number' }),
  scanState: varchar('scan_state', { length: 20 }).notNull().default('not_scanned'),
  verifiedBy: text('verified_by'),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('ue_imported_document_evidence_document_idx').on(table.documentId),
  index('ue_imported_document_evidence_org_idx').on(table.organizationId, table.verificationState),
  check('ue_imported_document_evidence_state_check', sql`${table.verificationState} IN ('reference_only', 'digest_verified', 'digest_mismatch')`),
  check('ue_imported_document_evidence_scan_check', sql`${table.scanState} IN ('not_scanned', 'clean', 'infected')`),
  check('ue_imported_document_evidence_digest_check', sql`(${table.sourceDeclaredDigest} IS NULL OR ${table.sourceDeclaredDigest} ~ '^[0-9a-f]{64}$')
    AND (${table.verifiedDigest} IS NULL OR ${table.verifiedDigest} ~ '^[0-9a-f]{64}$')`),
  check('ue_imported_document_evidence_verified_check', sql`(${table.verificationState} = 'reference_only' AND ${table.verifiedDigest} IS NULL AND ${table.verifiedAt} IS NULL AND ${table.byteSize} IS NULL)
    OR (${table.verificationState} = 'digest_verified' AND ${table.sourceDeclaredDigest} IS NOT NULL AND ${table.verifiedDigest} = ${table.sourceDeclaredDigest}
        AND ${table.byteSize} >= 0 AND ${table.verifiedAt} IS NOT NULL AND ${table.verifiedBy} IS NOT NULL)
    OR (${table.verificationState} = 'digest_mismatch' AND ${table.sourceDeclaredDigest} IS NOT NULL AND ${table.verifiedDigest} IS NOT NULL
        AND ${table.verifiedDigest} <> ${table.sourceDeclaredDigest} AND ${table.verifiedAt} IS NOT NULL AND ${table.verifiedBy} IS NOT NULL)`),
  foreignKey({ name: 'ue_imported_document_evidence_batch_fk', columns: [table.organizationId, table.batchId], foreignColumns: [ueIngestionBatchManifests.organizationId, ueIngestionBatchManifests.batchId] }),
]);

// ─── Type Exports ────────────────────────────────────────────────────────────

export type IngestionBatch = typeof ingestionBatches.$inferSelect;
export type NewIngestionBatch = typeof ingestionBatches.$inferInsert;
export type IngestionRecord = typeof ingestionRecords.$inferSelect;
export type NewIngestionRecord = typeof ingestionRecords.$inferInsert;
export type GrievanceTimelineEvent = typeof grievanceTimelineEvents.$inferSelect;
export type NewGrievanceTimelineEvent = typeof grievanceTimelineEvents.$inferInsert;
export type DuplicateGroup = typeof duplicateGroups.$inferSelect;
export type NewDuplicateGroup = typeof duplicateGroups.$inferInsert;
export type DuplicateGroupMember = typeof duplicateGroupMembers.$inferSelect;
export type NewDuplicateGroupMember = typeof duplicateGroupMembers.$inferInsert;
export type DataQualityWarning = typeof dataQualityWarnings.$inferSelect;
export type NewDataQualityWarning = typeof dataQualityWarnings.$inferInsert;
