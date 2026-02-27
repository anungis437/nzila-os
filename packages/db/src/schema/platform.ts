/**
 * Nzila OS — Platform infrastructure schema
 *
 * Tables for platform-level observability that are NOT org-scoped
 * in the traditional sense but reference entityId for filtering.
 */
import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  varchar,
  real,
  jsonb,
  boolean,
} from 'drizzle-orm/pg-core'
import { entities } from './entities'

// ── Platform Request Metrics ────────────────────────────────────────────────

export const platformRequestMetrics = pgTable('platform_request_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  route: varchar('route', { length: 512 }).notNull(),
  entityId: uuid('entity_id').notNull().references(() => entities.id),
  latencyMs: integer('latency_ms').notNull(),
  statusCode: integer('status_code').notNull(),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Isolation Audit Results ─────────────────────────────────────────────────

export const platformIsolationAudits = pgTable('platform_isolation_audits', {
  id: uuid('id').primaryKey().defaultRandom(),
  isolationScore: real('isolation_score').notNull(),
  totalChecks: integer('total_checks').notNull(),
  passedChecks: integer('passed_checks').notNull(),
  violations: jsonb('violations').notNull().default([]),
  auditedAt: timestamp('audited_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Governance Proof Packs ──────────────────────────────────────────────────

export const platformProofPacks = pgTable('platform_proof_packs', {
  id: uuid('id').primaryKey().defaultRandom(),
  contractTestHash: varchar('contract_test_hash', { length: 128 }).notNull(),
  ciPipelineStatus: varchar('ci_pipeline_status', { length: 64 }).notNull(),
  lastMigrationId: varchar('last_migration_id', { length: 256 }).notNull(),
  auditIntegrityHash: varchar('audit_integrity_hash', { length: 128 }).notNull(),
  secretScanStatus: varchar('secret_scan_status', { length: 64 }).notNull(),
  redTeamSummary: text('red_team_summary').notNull(),
  signatureHash: varchar('signature_hash', { length: 256 }).notNull(),
  immutable: boolean('immutable').notNull().default(true),
  payload: jsonb('payload').notNull().default({}),
  generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
})
