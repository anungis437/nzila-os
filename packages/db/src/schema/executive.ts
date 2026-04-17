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