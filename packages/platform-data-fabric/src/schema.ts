/**
 * @nzila/platform-data-fabric — Drizzle Schema
 */
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  integer,
  index,
} from 'drizzle-orm/pg-core'

// ── Canonical Records ───────────────────────────────────────────────────────

export const canonicalRecords = pgTable(
  'canonical_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    entityType: varchar('entity_type', { length: 64 }).notNull(),
    resourceId: uuid('entity_id').notNull(),
    sourceSystem: varchar('source_system', { length: 128 }).notNull(),
    sourceRecordId: varchar('source_record_id', { length: 256 }).notNull(),
    mappingVersion: integer('mapping_version').notNull().default(1),
    transformationLog: jsonb('transformation_log').notNull().default([]),
    payload: jsonb('payload').notNull().default({}),
    ingestedAt: timestamp('ingested_at', { withTimezone: true }).notNull(),
    mappedAt: timestamp('mapped_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('canonical_records_tenant_idx').on(table.tenantId),
    index('canonical_records_entity_idx').on(table.entityType, table.resourceId),
    index('canonical_records_source_idx').on(table.sourceSystem, table.sourceRecordId),
  ],
)

// ── Record Lineage ──────────────────────────────────────────────────────────

export const recordLineage = pgTable(
  'record_lineage',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    canonicalRecordId: uuid('canonical_record_id').notNull().references(() => canonicalRecords.id),
    sourceSystem: varchar('source_system', { length: 128 }).notNull(),
    sourceRecordId: varchar('source_record_id', { length: 256 }).notNull(),
    mappingVersion: integer('mapping_version').notNull(),
    transformationLog: jsonb('transformation_log').notNull().default([]),
    ingestedAt: timestamp('ingested_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    index('record_lineage_canonical_idx').on(table.canonicalRecordId),
    index('record_lineage_source_idx').on(table.sourceSystem, table.sourceRecordId),
  ],
)

// ── Sync Jobs ───────────────────────────────────────────────────────────────

export const syncJobs = pgTable(
  'sync_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    sourceSystem: varchar('source_system', { length: 128 }).notNull(),
    status: varchar('status', { length: 32 }).notNull().default('pending'),
    recordsProcessed: integer('records_processed').notNull().default(0),
    recordsFailed: integer('records_failed').notNull().default(0),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    errorLog: text('error_log'),
  },
  (table) => [
    index('sync_jobs_tenant_idx').on(table.tenantId),
    index('sync_jobs_status_idx').on(table.status),
  ],
)

// ── Sync Conflicts ──────────────────────────────────────────────────────────

export const syncConflicts = pgTable(
  'sync_conflicts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    entityType: varchar('entity_type', { length: 64 }).notNull(),
    resourceId: uuid('entity_id').notNull(),
    sourceSystemA: varchar('source_system_a', { length: 128 }).notNull(),
    sourceSystemB: varchar('source_system_b', { length: 128 }).notNull(),
    conflictingField: varchar('conflicting_field', { length: 256 }).notNull(),
    valueA: jsonb('value_a'),
    valueB: jsonb('value_b'),
    resolution: varchar('resolution', { length: 32 }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolvedBy: varchar('resolved_by', { length: 256 }),
    detectedAt: timestamp('detected_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('sync_conflicts_tenant_idx').on(table.tenantId),
    index('sync_conflicts_entity_idx').on(table.entityType, table.resourceId),
  ],
)
