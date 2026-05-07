import {
  pgTable,
  uuid,
  text,
  timestamp,
  numeric,
  jsonb,
  varchar,
  integer,
  boolean,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { orgs } from './orgs'

export const pilotDefinitions = pgTable(
  'pilot_definitions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => orgs.id),
    appScope: varchar('app_scope', { length: 64 }).notNull(),
    pilotName: text('pilot_name').notNull(),
    pilotType: varchar('pilot_type', { length: 64 }).notNull(),
    status: varchar('status', { length: 32 }).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    targetEndAt: timestamp('target_end_at', { withTimezone: true }),
    ownerUserId: text('owner_user_id'),
    metadataJson: jsonb('metadata_json').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('pilot_definitions_org_idx').on(table.orgId),
    index('pilot_definitions_scope_idx').on(table.orgId, table.appScope),
    index('pilot_definitions_status_idx').on(table.orgId, table.status),
  ],
)

export const pilotMetricEvents = pgTable(
  'pilot_metric_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => orgs.id),
    pilotId: uuid('pilot_id').notNull().references(() => pilotDefinitions.id),
    appScope: varchar('app_scope', { length: 64 }).notNull(),
    metricType: varchar('metric_type', { length: 32 }).notNull(),
    metricName: varchar('metric_name', { length: 128 }).notNull(),
    valueNumeric: numeric('value_numeric', { precision: 18, scale: 6 }),
    valueJson: jsonb('value_json'),
    resourceId: text('entity_id'),
    entityType: varchar('entity_type', { length: 64 }),
    traceId: text('trace_id'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    idempotencyKey: text('idempotency_key'),
  },
  (table) => [
    index('pilot_metric_events_org_pilot_idx').on(table.orgId, table.pilotId),
    index('pilot_metric_events_metric_idx').on(table.orgId, table.metricName, table.occurredAt),
    index('pilot_metric_events_trace_idx').on(table.traceId),
    uniqueIndex('pilot_metric_events_dedupe_idx').on(table.orgId, table.pilotId, table.metricName, table.idempotencyKey),
  ],
)

export const pilotMetricRollups = pgTable(
  'pilot_metric_rollups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => orgs.id),
    pilotId: uuid('pilot_id').notNull().references(() => pilotDefinitions.id),
    appScope: varchar('app_scope', { length: 64 }).notNull(),
    metricName: varchar('metric_name', { length: 128 }).notNull(),
    windowType: varchar('window_type', { length: 16 }).notNull(),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
    windowEnd: timestamp('window_end', { withTimezone: true }).notNull(),
    valueNumeric: numeric('value_numeric', { precision: 18, scale: 6 }),
    valueJson: jsonb('value_json'),
    computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('pilot_metric_rollups_uni_idx').on(table.orgId, table.pilotId, table.metricName, table.windowType, table.windowStart),
    index('pilot_metric_rollups_org_idx').on(table.orgId, table.pilotId, table.windowType),
  ],
)

export const pilotHealthScores = pgTable(
  'pilot_health_scores',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => orgs.id),
    pilotId: uuid('pilot_id').notNull().references(() => pilotDefinitions.id),
    scoreTotal: integer('score_total').notNull(),
    scoreAdoption: integer('score_adoption').notNull(),
    scoreOperations: integer('score_operations').notNull(),
    scoreReliability: integer('score_reliability').notNull(),
    scoreRevenue: integer('score_revenue').notNull(),
    scoreWorkflow: integer('score_workflow').notNull(),
    riskLevel: varchar('risk_level', { length: 16 }).notNull(),
    computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
    rationaleJson: jsonb('rationale_json').notNull().default({}),
  },
  (table) => [
    index('pilot_health_scores_org_idx').on(table.orgId, table.pilotId, table.computedAt),
  ],
)

export const pilotAlerts = pgTable(
  'pilot_alerts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => orgs.id),
    pilotId: uuid('pilot_id').notNull().references(() => pilotDefinitions.id),
    ruleId: uuid('rule_id'),
    alertType: varchar('alert_type', { length: 64 }).notNull(),
    severity: varchar('severity', { length: 16 }).notNull(),
    status: varchar('status', { length: 32 }).notNull().default('open'),
    dedupKey: text('dedup_key').notNull(),
    correlationId: text('correlation_id'),
    occurrenceCount: integer('occurrence_count').notNull().default(1),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    windowStart: timestamp('window_start', { withTimezone: true }),
    windowEnd: timestamp('window_end', { withTimezone: true }),
    metricValue: numeric('metric_value', { precision: 18, scale: 6 }),
    thresholdValue: numeric('threshold_value', { precision: 18, scale: 6 }),
    playbookKey: varchar('playbook_key', { length: 128 }),
    whatHappened: text('what_happened'),
    whyItMatters: text('why_it_matters'),
    whatToDoNext: text('what_to_do_next'),
    assigneeUserId: text('assignee_user_id'),
    acknowledgedBy: text('acknowledged_by'),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
    resolvedBy: text('resolved_by'),
    resolutionNotes: text('resolution_notes'),
    escalatedAt: timestamp('escalated_at', { withTimezone: true }),
    title: text('title').notNull(),
    message: text('message').notNull(),
    metricName: varchar('metric_name', { length: 128 }),
    detectedAt: timestamp('detected_at', { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    metadataJson: jsonb('metadata_json').notNull().default({}),
  },
  (table) => [
    index('pilot_alerts_org_idx').on(table.orgId, table.pilotId, table.detectedAt),
    index('pilot_alerts_open_idx').on(table.orgId, table.pilotId, table.resolvedAt),
    index('pilot_alerts_dedup_idx').on(table.orgId, table.pilotId, table.dedupKey),
    index('pilot_alerts_correlation_idx').on(table.orgId, table.pilotId, table.correlationId),
  ],
)

export const pilotAlertRules = pgTable(
  'pilot_alert_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => orgs.id),
    pilotId: uuid('pilot_id').notNull().references(() => pilotDefinitions.id),
    metricName: varchar('metric_name', { length: 128 }).notNull(),
    ruleType: varchar('rule_type', { length: 32 }).notNull(),
    operator: varchar('operator', { length: 16 }).notNull(),
    thresholdValue: numeric('threshold_value', { precision: 18, scale: 6 }).notNull(),
    windowMinutes: integer('window_minutes').notNull(),
    severity: varchar('severity', { length: 16 }).notNull(),
    enabled: boolean('enabled').notNull().default(true),
    cooldownMinutes: integer('cooldown_minutes').notNull().default(30),
    playbookKey: varchar('playbook_key', { length: 128 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('pilot_alert_rules_org_idx').on(table.orgId, table.pilotId),
    index('pilot_alert_rules_metric_idx').on(table.orgId, table.pilotId, table.metricName),
    uniqueIndex('pilot_alert_rules_uni_idx').on(table.orgId, table.pilotId, table.metricName, table.ruleType, table.operator),
  ],
)

export const pilotAlertEscalations = pgTable(
  'pilot_alert_escalations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => orgs.id),
    pilotId: uuid('pilot_id').notNull().references(() => pilotDefinitions.id),
    severity: varchar('severity', { length: 16 }).notNull(),
    notifyAfterMinutes: integer('notify_after_minutes').notNull(),
    escalationChannel: varchar('escalation_channel', { length: 32 }).notNull(),
    escalationTarget: text('escalation_target').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('pilot_alert_escalations_org_idx').on(table.orgId, table.pilotId),
    index('pilot_alert_escalations_sev_idx').on(table.orgId, table.pilotId, table.severity),
  ],
)
