/**
 * @nzila/platform-cognition-core — Drizzle schema (Phase-2 wiring stub)
 *
 * Defines the canonical table layout for the persistent cognition store.
 *
 * This schema is intentionally NOT yet bound to the runtime store (which is
 * file-backed under ops/cognition-memory/, mirroring platform-decision-engine).
 * It exists so:
 *
 *   1. Phase-2 migration is a mechanical wiring task — the shape is fixed.
 *   2. Other packages (e.g. @nzila/db introspection, governance audits) can
 *      reason about cognition tables today.
 *   3. DBAs can review and approve column types BEFORE any migration SQL is
 *      written. The corresponding migration file will live under
 *      `migrations/` once approved.
 *
 * No `relations()` calls and no `pgTable.$inferSelect` consumers are exported
 * from this package today — keeping it pure shape.
 *
 * @module @nzila/platform-cognition-core/schema
 */
import { sql } from 'drizzle-orm'
import {
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

// ── Memory events ───────────────────────────────────────────────────────────

export const cognitionMemoryEvents = pgTable(
  'cognition_memory_events',
  {
    id: text('id').primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    orgId: uuid('org_id').notNull(),
    userId: uuid('user_id'),
    entityType: text('entity_type'),
    entityId: text('entity_id'),
    kind: text('kind').notNull(), // memoryKindSchema enum
    source: text('source').notNull(), // memorySourceSchema enum
    type: text('type').notNull(),
    payload: jsonb('payload').notNull().default(sql`'{}'::jsonb`),
    salience: real('salience').notNull(),
    tags: text('tags').array().notNull().default(sql`ARRAY[]::text[]`),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    redactedAt: timestamp('redacted_at', { withTimezone: true }),
    redactionReason: text('redaction_reason'),
  },
  (t) => ({
    bySubject: index('cognition_mem_subject_idx').on(t.tenantId, t.orgId, t.userId),
    byEntity: index('cognition_mem_entity_idx').on(t.entityType, t.entityId),
    byOccurredAt: index('cognition_mem_occurred_at_idx').on(t.occurredAt),
  }),
)

// ── Trajectory risk scores ──────────────────────────────────────────────────

export const cognitionRiskScores = pgTable(
  'cognition_risk_scores',
  {
    id: text('id').primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    orgId: uuid('org_id').notNull(),
    userId: uuid('user_id'),
    entityType: text('entity_type'),
    entityId: text('entity_id'),
    kind: text('kind').notNull(),
    probability: real('probability').notNull(),
    confidence: real('confidence').notNull(),
    contributions: jsonb('contributions').notNull(),
    features: jsonb('features').notNull(),
    modelVersion: text('model_version').notNull(),
    scoredAt: timestamp('scored_at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    bySubjectKind: index('cognition_risk_subject_kind_idx').on(
      t.tenantId,
      t.orgId,
      t.kind,
    ),
    byScoredAt: index('cognition_risk_scored_at_idx').on(t.scoredAt),
  }),
)

// ── Consent policies ────────────────────────────────────────────────────────

export const cognitionConsentPolicies = pgTable(
  'cognition_consent_policies',
  {
    id: text('id').primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    orgId: uuid('org_id').notNull(),
    userId: uuid('user_id'),
    entityType: text('entity_type'),
    entityId: text('entity_id'),
    allowedZones: text('allowed_zones').array().notNull(),
    allowedKinds: text('allowed_kinds').array().notNull(),
    retentionDays: integer('retention_days').notNull(),
    excludedTags: text('excluded_tags').array().notNull().default(sql`ARRAY[]::text[]`),
    jurisdiction: text('jurisdiction').notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    lastConfirmedAt: timestamp('last_confirmed_at', { withTimezone: true }),
  },
  (t) => ({
    bySubject: index('cognition_consent_subject_idx').on(
      t.tenantId,
      t.orgId,
      t.userId,
    ),
  }),
)
