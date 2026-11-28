/**
 * Procedural rules (platform migration 0090, RLS scoped 0063). Drizzle mirror of the governed SQL; the SQL is the authority
 * (CHECKs, lifecycle and append-only triggers live there). See lib/procedural-rules.
 */
import { date, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

const lifecycleColumns = {
  status: text('status').notNull().default('draft'),
  origin: text('origin').notNull(),
  contentDigest: text('content_digest').notNull(),
  draftedBy: text('drafted_by').notNull(),
  draftedAt: timestamp('drafted_at', { withTimezone: true }).notNull().defaultNow(),
  reviewedBy: text('reviewed_by'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  adoptedBy: text('adopted_by'),
  adoptedAt: timestamp('adopted_at', { withTimezone: true }),
  closedBy: text('closed_by'),
  closedAt: timestamp('closed_at', { withTimezone: true }),
};

export const proceduralRuleSources = pgTable(
  'procedural_rule_sources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    sourceKind: text('source_kind').notNull(),
    title: text('title').notNull(),
    edition: text('edition').notNull(),
    language: text('language').notNull(),
    reference: text('reference').notNull(),
    effectiveFrom: date('effective_from').notNull(),
    effectiveTo: date('effective_to'),
    supersedesSourceId: uuid('supersedes_source_id'),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_procedural_rule_sources_org').on(t.organizationId)],
);

export const proceduralRuleSets = pgTable(
  'procedural_rule_sets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    ruleKey: text('rule_key').notNull(),
    version: integer('version').notNull(),
    sourceId: uuid('source_id').notNull(),
    regime: text('regime').notNull(),
    procedureRoute: text('procedure_route').notNull(),
    applicability: jsonb('applicability').notNull(),
    effectiveFrom: date('effective_from').notNull(),
    effectiveTo: date('effective_to'),
    definition: jsonb('definition').notNull(),
    ...lifecycleColumns,
  },
  (t) => [
    uniqueIndex('procedural_rule_sets_key_version_uq').on(t.organizationId, t.ruleKey, t.version),
    index('idx_procedural_rule_sets_selection').on(t.organizationId, t.regime, t.procedureRoute, t.status),
  ],
);

export const proceduralHolidayCalendars = pgTable(
  'procedural_holiday_calendars',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    calendarKey: text('calendar_key').notNull(),
    version: integer('version').notNull(),
    sourceReference: text('source_reference').notNull(),
    coverageFrom: date('coverage_from').notNull(),
    coverageTo: date('coverage_to').notNull(),
    days: date('days').array().notNull(),
    ...lifecycleColumns,
  },
  (t) => [uniqueIndex('procedural_holiday_calendars_key_version_uq').on(t.organizationId, t.calendarKey, t.version)],
);

export const proceduralRuleLifecycleEvents = pgTable(
  'procedural_rule_lifecycle_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    subjectType: text('subject_type').notNull(),
    subjectId: uuid('subject_id').notNull(),
    fromStatus: text('from_status'),
    toStatus: text('to_status').notNull(),
    actorId: text('actor_id').notNull(),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_procedural_rule_lifecycle_subject').on(t.organizationId, t.subjectType, t.subjectId)],
);

export const grievanceProcedureBindings = pgTable(
  'grievance_procedure_bindings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    grievanceId: uuid('grievance_id').notNull(),
    regime: text('regime'),
    procedureRoute: text('procedure_route'),
    employerRef: text('employer_ref'),
    bargainingGroup: text('bargaining_group'),
    classification: text('classification'),
    matterCategory: text('matter_category'),
    referenceDay: date('reference_day'),
    determinations: jsonb('determinations').notNull().default({}),
    recordedBy: text('recorded_by').notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
    supersededBy: text('superseded_by'),
    supersededAt: timestamp('superseded_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('ux_grievance_procedure_bindings_current').on(t.grievanceId).where(sql`superseded_at IS NULL`)],
);

export const grievanceProceduralFacts = pgTable(
  'grievance_procedural_facts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    grievanceId: uuid('grievance_id').notNull(),
    factKind: text('fact_kind').notNull(),
    payload: jsonb('payload').notNull(),
    recordedBy: text('recorded_by').notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
    voidedBy: text('voided_by'),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    voidReason: text('void_reason'),
  },
  (t) => [index('idx_grievance_procedural_facts_grievance').on(t.grievanceId, t.factKind).where(sql`voided_at IS NULL`)],
);

export const grievanceProceduralExceptions = pgTable(
  'grievance_procedural_exceptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    grievanceId: uuid('grievance_id').notNull(),
    clockKey: text('clock_key').notNull(),
    codes: text('codes').array().notNull(),
    evidence: jsonb('evidence').notNull(),
    evidenceDigest: text('evidence_digest').notNull(),
    status: text('status').notNull().default('open'),
    raisedBy: text('raised_by').notNull(),
    raisedAt: timestamp('raised_at', { withTimezone: true }).notNull().defaultNow(),
    resolvedBy: text('resolved_by'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolution: text('resolution'),
  },
  (t) => [uniqueIndex('ux_grievance_procedural_exceptions_open').on(t.grievanceId, t.clockKey).where(sql`status = 'open'`)],
);
