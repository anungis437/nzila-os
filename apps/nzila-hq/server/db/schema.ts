/**
 * Nzila HQ — Drizzle schema (Phase 1: real persistence for time-series + audit).
 *
 * Scope intentionally narrow: we persist the *historical* and *audit* tables
 * the cockpit needs, where in-memory derivation is a real-world gap. The
 * entity tables (ventures/opportunities/tasks/contacts/orgs/etc.) remain
 * sourced from `seed-data.ts` until a dedicated persistence PR migrates them
 * — at that point the same `HqRepository` interface absorbs them with no
 * page-level change.
 *
 * Tables here:
 *   - metrics_snapshots         daily portfolio KPI history
 *   - dependency_scores         per-venture dependency score history
 *   - allocations_history       per-venture allocation recommendations over time
 *   - cash_events               real cash inflow/outflow ledger entries
 *   - invoices                  real AR ledger entries
 *   - report_runs               every executive report generation, with hash
 *   - audit_log                 sensitive operations (export, edit, role-change)
 *
 * All tables include audit timestamps and (where applicable) ownership +
 * soft-delete fields (`deleted_at nullable`). UUID primary keys default at
 * the DB level via `gen_random_uuid()` so raw-SQL seeders also get them.
 */
import { sql } from 'drizzle-orm'
import {
  bigint,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

// Helpers ─────────────────────────────────────────────────────────────────
const id = () =>
  uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`)
const createdAt = () =>
  timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`)
const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`)
const deletedAt = () => timestamp('deleted_at', { withTimezone: true })

// ─────────────────────────────────────────────────────────────────────────
// metrics_snapshots — one row per portfolio KPI capture (daily expected)
// ─────────────────────────────────────────────────────────────────────────
export const metricsSnapshots = pgTable(
  'hq_metrics_snapshots',
  {
    id: id(),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull(),
    activeVentures: bigint('active_ventures', { mode: 'number' }).notNull(),
    totalMrrCents: bigint('total_mrr_cents', { mode: 'number' }).notNull(),
    weightedPipelineCents: bigint('weighted_pipeline_cents', { mode: 'number' }).notNull(),
    founderBottleneckScore: bigint('founder_bottleneck_score', { mode: 'number' }).notNull(),
    cashRunwayMonths: bigint('cash_runway_months', { mode: 'number' }),
    extra: jsonb('extra').$type<Record<string, number | string | null>>(),
    createdAt: createdAt(),
  },
  (t) => [index('idx_metrics_snapshots_captured_at').on(t.capturedAt)],
)

// ─────────────────────────────────────────────────────────────────────────
// dependency_scores — per-venture history of the dependency engine output
// ─────────────────────────────────────────────────────────────────────────
export const dependencyScores = pgTable(
  'hq_dependency_scores',
  {
    id: id(),
    ventureSlug: varchar('venture_slug', { length: 80 }).notNull(),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull(),
    score: bigint('score', { mode: 'number' }).notNull(),
    signal: varchar('signal', { length: 16 }).notNull(), // green | amber | red
    factors: jsonb('factors').$type<Record<string, unknown>>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('idx_dependency_scores_venture_captured').on(t.ventureSlug, t.capturedAt),
  ],
)

// ─────────────────────────────────────────────────────────────────────────
// allocations_history — per-venture allocation recommendations over time
// ─────────────────────────────────────────────────────────────────────────
export const allocationsHistory = pgTable(
  'hq_allocations_history',
  {
    id: id(),
    ventureSlug: varchar('venture_slug', { length: 80 }).notNull(),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull(),
    composite: bigint('composite', { mode: 'number' }).notNull(),
    recommendation: varchar('recommendation', { length: 32 }).notNull(),
    confidence: varchar('confidence', { length: 16 }).notNull(),
    axes: jsonb('axes').$type<Record<string, unknown>>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('idx_allocations_history_venture_captured').on(t.ventureSlug, t.capturedAt),
  ],
)

// ─────────────────────────────────────────────────────────────────────────
// cash_events — real ledger entries (replaces synthesized CashEvent[])
// ─────────────────────────────────────────────────────────────────────────
export const cashEvents = pgTable(
  'hq_cash_events',
  {
    id: id(),
    kind: varchar('kind', { length: 16 }).notNull(), // inflow | outflow
    category: varchar('category', { length: 32 }).notNull(),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    ventureSlug: varchar('venture_slug', { length: 80 }),
    description: text('description').notNull().default(''),
    sourceSystem: varchar('source_system', { length: 32 }).notNull().default('manual'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [index('idx_cash_events_occurred_at').on(t.occurredAt)],
)

// ─────────────────────────────────────────────────────────────────────────
// invoices — real AR ledger entries
// ─────────────────────────────────────────────────────────────────────────
export const invoices = pgTable(
  'hq_invoices',
  {
    id: id(),
    externalId: varchar('external_id', { length: 128 }),
    ventureSlug: varchar('venture_slug', { length: 80 }).notNull(),
    clientOrgId: varchar('client_org_id', { length: 128 }).notNull(),
    clientName: varchar('client_name', { length: 256 }).notNull(),
    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull(),
    dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    status: varchar('status', { length: 16 }).notNull(), // draft|sent|paid|void|overdue
    sourceSystem: varchar('source_system', { length: 32 }).notNull().default('manual'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    index('idx_invoices_venture').on(t.ventureSlug),
    index('idx_invoices_status_due').on(t.status, t.dueAt),
    uniqueIndex('uq_invoices_external_id').on(t.externalId),
  ],
)

// ─────────────────────────────────────────────────────────────────────────
// report_runs — every executive report generation, with hash for dedup
// ─────────────────────────────────────────────────────────────────────────
export const reportRuns = pgTable(
  'hq_report_runs',
  {
    id: id(),
    kind: varchar('kind', { length: 64 }).notNull(),
    generatedForUserId: varchar('generated_for_user_id', { length: 128 }).notNull(),
    generatedForRole: varchar('generated_for_role', { length: 32 }).notNull(),
    contentHash: varchar('content_hash', { length: 64 }).notNull(),
    summary: text('summary').notNull().default(''),
    body: text('body').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('idx_report_runs_kind_created').on(t.kind, t.createdAt),
    index('idx_report_runs_user_created').on(t.generatedForUserId, t.createdAt),
  ],
)

// ─────────────────────────────────────────────────────────────────────────
// audit_log — sensitive operations (export, edit, role-change, view-finance)
// ─────────────────────────────────────────────────────────────────────────
export const auditLog = pgTable(
  'hq_audit_log',
  {
    id: id(),
    actorUserId: varchar('actor_user_id', { length: 128 }).notNull(),
    actorRole: varchar('actor_role', { length: 32 }).notNull(),
    action: varchar('action', { length: 64 }).notNull(), // export.report | edit.venture | view.finance | …
    resourceKind: varchar('resource_kind', { length: 64 }).notNull(),
    resourceId: varchar('resource_id', { length: 256 }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    ipAddress: varchar('ip_address', { length: 64 }),
    userAgent: text('user_agent'),
    occurredAt: timestamp('occurred_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index('idx_audit_log_actor_occurred').on(t.actorUserId, t.occurredAt),
    index('idx_audit_log_action_occurred').on(t.action, t.occurredAt),
    index('idx_audit_log_resource').on(t.resourceKind, t.resourceId),
  ],
)
