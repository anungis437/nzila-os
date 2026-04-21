import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  date,
  boolean,
  real,
  text,
  numeric,
  integer,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { orgs } from './orgs'

export const founderTimeLogs = pgTable(
  'founder_time_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => orgs.id),
    date: timestamp('date', { withTimezone: true }).notNull(),
    ventureId: varchar('venture_id', { length: 64 }).notNull(),
    category: varchar('category', { length: 32 }).notNull(),
    hours: real('hours').notNull(),
    notes: text('notes'),
    impactScore: integer('impact_score'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('founder_time_logs_org_date_idx').on(table.orgId, table.date),
    index('founder_time_logs_venture_idx').on(table.orgId, table.ventureId, table.date),
    index('founder_time_logs_category_idx').on(table.orgId, table.category, table.date),
  ],
)

export const weeklyFocusTargets = pgTable(
  'weekly_focus_targets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => orgs.id),
    ventureId: varchar('venture_id', { length: 64 }).notNull(),
    weekStart: timestamp('week_start', { withTimezone: true }).notNull(),
    targetHours: real('target_hours').notNull(),
    rationale: text('rationale'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('weekly_focus_targets_org_venture_week_idx').on(table.orgId, table.ventureId, table.weekStart),
    index('weekly_focus_targets_org_week_idx').on(table.orgId, table.weekStart),
  ],
)

export const treasurySnapshots = pgTable(
  'treasury_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => orgs.id),
    date: timestamp('date', { withTimezone: true }).notNull(),
    cashOnHand: numeric('cash_on_hand', { precision: 18, scale: 2 }).notNull().default('0'),
    restrictedCash: numeric('restricted_cash', { precision: 18, scale: 2 }).notNull().default('0'),
    receivables: numeric('receivables', { precision: 18, scale: 2 }).notNull().default('0'),
    liabilitiesDue30d: numeric('liabilities_due_30d', { precision: 18, scale: 2 }).notNull().default('0'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('treasury_snapshots_org_date_idx').on(table.orgId, table.date),
  ],
)

export const runwayAssumptions = pgTable(
  'runway_assumptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => orgs.id),
    mode: varchar('mode', { length: 16 }).notNull(),
    expectedMonthlyRevenue: numeric('expected_monthly_revenue', { precision: 18, scale: 2 }).notNull().default('0'),
    plannedHires: integer('planned_hires').notNull().default(0),
    discretionarySpend: numeric('discretionary_spend', { precision: 18, scale: 2 }).notNull().default('0'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('runway_assumptions_org_mode_idx').on(table.orgId, table.mode),
  ],
)

export const executionInitiatives = pgTable(
  'execution_initiatives',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => orgs.id),
    title: text('title').notNull(),
    venture: varchar('venture', { length: 64 }),
    zone: varchar('zone', { length: 32 }),
    owner: varchar('owner', { length: 128 }),
    dueDate: date('due_date'),
    status: varchar('status', { length: 32 }).notNull().default('not-started'),
    urgent: boolean('urgent').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('execution_initiatives_org_status_idx').on(table.orgId, table.status),
    index('execution_initiatives_org_due_idx').on(table.orgId, table.dueDate),
    index('execution_initiatives_org_zone_idx').on(table.orgId, table.zone),
  ],
)

export const executiveDecisions = pgTable(
  'executive_decisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => orgs.id),
    date: timestamp('date', { withTimezone: true }).notNull().defaultNow(),
    title: text('title').notNull(),
    rationale: text('rationale'),
    ventureId: varchar('venture_id', { length: 64 }),
    category: varchar('category', { length: 32 }).notNull(),
    priority: varchar('priority', { length: 16 }).notNull().default('p2'),
    owner: varchar('owner', { length: 128 }),
    dueDate: date('due_date'),
    status: varchar('status', { length: 32 }).notNull().default('proposed'),
    linkedInitiativeId: uuid('linked_initiative_id').references(() => executionInitiatives.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('executive_decisions_org_status_idx').on(table.orgId, table.status),
    index('executive_decisions_org_due_idx').on(table.orgId, table.dueDate),
    index('executive_decisions_org_venture_idx').on(table.orgId, table.ventureId),
    index('executive_decisions_org_created_idx').on(table.orgId, table.createdAt),
  ],
)

export const decisionScorebacks = pgTable(
  'decision_scorebacks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => orgs.id),
    decisionId: uuid('decision_id').notNull().references(() => executiveDecisions.id),
    expectedResult: text('expected_result').notNull(),
    expectedRoiPct: real('expected_roi_pct'),
    expectedByDate: date('expected_by_date'),
    actualResult: text('actual_result'),
    actualRoiPct: real('actual_roi_pct'),
    outcomeStatus: varchar('outcome_status', { length: 32 }).notNull().default('pending'),
    accuracyScore: real('accuracy_score'),
    confidenceAtDecision: real('confidence_at_decision'),
    evaluatedAt: timestamp('evaluated_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('decision_scorebacks_org_status_idx').on(table.orgId, table.outcomeStatus),
    index('decision_scorebacks_org_evaluated_idx').on(table.orgId, table.evaluatedAt),
    uniqueIndex('decision_scorebacks_org_decision_idx').on(table.orgId, table.decisionId),
  ],
)

// ── ExecutiveOS — agent runs / insights / actions ──────────────────────────
//
// Substrate for the Nzila ExecutiveOS autonomous agent stack
// (Chief of Staff, CFO, RevOps, Platform Reliability, etc.).
// Every agent invocation produces:
//   - a run record (audit + telemetry)
//   - 0..N insights (observations)
//   - 0..N actions (insight | recommendation | draft_action) which may
//     require human approval before execution.
// Approvals are tracked inline; material executions write back here.

export const executiveAgentRuns = pgTable(
  'executive_agent_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => orgs.id),
    agentKey: varchar('agent_key', { length: 64 }).notNull(),
    agentVersion: varchar('agent_version', { length: 16 }).notNull().default('v1'),
    triggeredBy: varchar('triggered_by', { length: 32 }).notNull().default('schedule'),
    actorId: varchar('actor_id', { length: 128 }),
    correlationId: varchar('correlation_id', { length: 64 }),
    status: varchar('status', { length: 16 }).notNull().default('succeeded'),
    durationMs: integer('duration_ms').notNull().default(0),
    inputDigest: jsonb('input_digest'),
    summary: text('summary'),
    errorMessage: text('error_message'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('executive_agent_runs_org_agent_idx').on(table.orgId, table.agentKey, table.startedAt),
    index('executive_agent_runs_org_status_idx').on(table.orgId, table.status, table.startedAt),
    index('executive_agent_runs_org_correlation_idx').on(table.orgId, table.correlationId),
  ],
)

export const executiveAgentInsights = pgTable(
  'executive_agent_insights',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => orgs.id),
    runId: uuid('run_id').notNull().references(() => executiveAgentRuns.id, { onDelete: 'cascade' }),
    agentKey: varchar('agent_key', { length: 64 }).notNull(),
    domain: varchar('domain', { length: 32 }).notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    severity: varchar('severity', { length: 16 }).notNull().default('info'),
    confidence: real('confidence').notNull().default(0.5),
    evidence: jsonb('evidence'),
    consequenceIfIgnored: text('consequence_if_ignored'),
    recommendedNextStep: text('recommended_next_step'),
    dismissedAt: timestamp('dismissed_at', { withTimezone: true }),
    dismissedBy: varchar('dismissed_by', { length: 128 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('executive_agent_insights_org_agent_idx').on(table.orgId, table.agentKey, table.createdAt),
    index('executive_agent_insights_org_severity_idx').on(table.orgId, table.severity, table.createdAt),
    index('executive_agent_insights_org_domain_idx').on(table.orgId, table.domain, table.createdAt),
    index('executive_agent_insights_run_idx').on(table.runId),
  ],
)

export const executiveAgentActions = pgTable(
  'executive_agent_actions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => orgs.id),
    runId: uuid('run_id').notNull().references(() => executiveAgentRuns.id, { onDelete: 'cascade' }),
    insightId: uuid('insight_id').references(() => executiveAgentInsights.id, { onDelete: 'set null' }),
    agentKey: varchar('agent_key', { length: 64 }).notNull(),
    actionClass: varchar('action_class', { length: 24 }).notNull(),
    title: text('title').notNull(),
    description: text('description'),
    payload: jsonb('payload'),
    requiresApproval: boolean('requires_approval').notNull().default(true),
    approvalState: varchar('approval_state', { length: 16 }).notNull().default('pending'),
    approverId: varchar('approver_id', { length: 128 }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    rejectionReason: text('rejection_reason'),
    executedAt: timestamp('executed_at', { withTimezone: true }),
    executionResult: jsonb('execution_result'),
    executionStatus: varchar('execution_status', { length: 16 }).notNull().default('not_executed'),
    confidence: real('confidence').notNull().default(0.5),
    riskLevel: varchar('risk_level', { length: 16 }).notNull().default('low'),
    dueDate: date('due_date'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('executive_agent_actions_org_state_idx').on(table.orgId, table.approvalState, table.createdAt),
    index('executive_agent_actions_org_agent_idx').on(table.orgId, table.agentKey, table.createdAt),
    index('executive_agent_actions_org_class_idx').on(table.orgId, table.actionClass, table.createdAt),
    index('executive_agent_actions_org_due_idx').on(table.orgId, table.dueDate),
    index('executive_agent_actions_run_idx').on(table.runId),
  ],
)

// ── Learning loop: recommendation memory ──────────────────────────────────
// Persistent, ranked recommendations that survive across agent runs so we
// can correlate outcome quality back to the original signal.
export const executiveRecommendations = pgTable(
  'executive_recommendations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => orgs.id),
    /** Stable key so the same underlying signal dedupes across runs, e.g. `churn-risk:<accountId>`. */
    dedupeKey: varchar('dedupe_key', { length: 256 }).notNull(),
    sourceAgent: varchar('source_agent', { length: 64 }).notNull(),
    sourceRunId: uuid('source_run_id'),
    sourceActionId: uuid('source_action_id'),
    kind: varchar('kind', { length: 16 }).notNull(), // 'risk' | 'opportunity' | 'task'
    domains: jsonb('domains').notNull().default([]),
    title: text('title').notNull(),
    narrative: text('narrative').notNull(),
    /** Ranked score snapshot at time of first sighting. */
    rankScore: real('rank_score').notNull(),
    rankBucket: varchar('rank_bucket', { length: 16 }).notNull(),
    rankExplanation: jsonb('rank_explanation').notNull().default([]),
    confidence: real('confidence').notNull().default(0.5),
    reversibility: real('reversibility').notNull().default(0.5),
    estimatedValueCad: numeric('estimated_value_cad', { precision: 18, scale: 2 }),
    owner: varchar('owner', { length: 128 }),
    evidence: jsonb('evidence').notNull().default({}),
    /** Lifecycle: open → accepted/rejected/postponed/modified → closed */
    status: varchar('status', { length: 24 }).notNull().default('open'),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('executive_recommendations_org_dedupe_idx').on(table.orgId, table.dedupeKey),
    index('executive_recommendations_org_status_idx').on(table.orgId, table.status, table.rankScore),
    index('executive_recommendations_org_kind_idx').on(table.orgId, table.kind, table.rankBucket),
    index('executive_recommendations_org_agent_idx').on(table.orgId, table.sourceAgent),
  ],
)

export const executiveRecommendationFeedback = pgTable(
  'executive_recommendation_feedback',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    recommendationId: uuid('recommendation_id').notNull().references(() => executiveRecommendations.id, { onDelete: 'cascade' }),
    actorId: varchar('actor_id', { length: 128 }).notNull(),
    /** 'accept' | 'reject' | 'postpone' | 'modify' | 'mark_wrong' | 'mark_high_impact' */
    verdict: varchar('verdict', { length: 24 }).notNull(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('executive_recommendation_feedback_rec_idx').on(table.recommendationId, table.createdAt),
    index('executive_recommendation_feedback_verdict_idx').on(table.verdict),
  ],
)

export const executiveRecommendationOutcomes = pgTable(
  'executive_recommendation_outcomes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    recommendationId: uuid('recommendation_id').notNull().references(() => executiveRecommendations.id, { onDelete: 'cascade' }),
    /** Concrete outcome class: 'resolved' | 'escalated' | 'fizzled' | 'blocked' | 'unknown' */
    outcome: varchar('outcome', { length: 24 }).notNull(),
    realizedValueCad: numeric('realized_value_cad', { precision: 18, scale: 2 }),
    daysToResolve: integer('days_to_resolve'),
    notes: text('notes'),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('executive_recommendation_outcomes_rec_idx').on(table.recommendationId, table.recordedAt),
    index('executive_recommendation_outcomes_class_idx').on(table.outcome),
  ],
)

/**
 * Periodic snapshot of the top-N ranked recommendations so we can trend
 * priority drift over time (was "X was top-5 last week, now backlog — why?").
 */
export const executivePrioritySnapshots = pgTable(
  'executive_priority_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => orgs.id),
    snapshotAt: timestamp('snapshot_at', { withTimezone: true }).notNull().defaultNow(),
    /** JSON array of { recommendationId, rankScore, rankBucket, title }, ordered by score desc. */
    topRanked: jsonb('top_ranked').notNull().default([]),
    /** Summary metrics at snapshot time. */
    metrics: jsonb('metrics').notNull().default({}),
  },
  (table) => [
    index('executive_priority_snapshots_org_time_idx').on(table.orgId, table.snapshotAt),
  ],
)