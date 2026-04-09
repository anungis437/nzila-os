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
} from 'drizzle-orm/pg-core';
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

// ─── Type Exports ────────────────────────────────────────────────────────────

export type IngestionBatch = typeof ingestionBatches.$inferSelect;
export type NewIngestionBatch = typeof ingestionBatches.$inferInsert;
export type IngestionRecord = typeof ingestionRecords.$inferSelect;
export type NewIngestionRecord = typeof ingestionRecords.$inferInsert;
export type GrievanceTimelineEvent = typeof grievanceTimelineEvents.$inferSelect;
export type NewGrievanceTimelineEvent = typeof grievanceTimelineEvents.$inferInsert;
