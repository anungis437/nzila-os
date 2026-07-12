/**
 * Nzila OS — Platform infrastructure schema
 *
 * Tables for platform-level observability that are NOT org-scoped
 * in the traditional sense but reference orgId for filtering.
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
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { orgs } from './orgs'

// ── Platform Request Metrics ────────────────────────────────────────────────

export const platformRequestMetrics = pgTable('platform_request_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  route: varchar('route', { length: 512 }).notNull(),
  orgId: uuid('org_id').notNull().references(() => orgs.id),
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

// ── Idempotency Cache ───────────────────────────────────────────────────────

/**
 * Postgres-backed idempotency cache for multi-instance deployments.
 *
 * Stores cached responses keyed by (orgId + route + idempotencyKey) so that
 * replayed mutation requests return the original response without re-executing
 * the handler. Entries expire after 24 hours via `expires_at`.
 */
export const idempotencyCache = pgTable(
  'idempotency_cache',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Composite cache key: `idempotency:{orgId}:{route}:{idempotencyKey}` */
    cacheKey: varchar('cache_key', { length: 768 }).notNull(),
    /** SHA-256 of the original request body (for payload-mismatch detection) */
    payloadHash: varchar('payload_hash', { length: 128 }).notNull(),
    /** Cached HTTP status code */
    status: integer('status').notNull(),
    /** Cached response body (stringified JSON) */
    body: text('body').notNull(),
    /** Cached response headers */
    headers: jsonb('headers').notNull().default({}),
    /**
     * Fencing token of the worker currently holding an in-flight reservation
     * (status = 0). NULL for completed entries. `finalize`/`release` are
     * conditional on this token so a worker whose lease was reclaimed after a
     * crash cannot overwrite the new owner's state.
     */
    reservationOwner: varchar('reservation_owner', { length: 64 }),
    /** When this entry was created */
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    /**
     * For a completed entry: auto-expiry timestamp (cleanup jobs / queries).
     * For an in-flight reservation (status = 0): the LEASE deadline — after it
     * passes the reservation is stale and may be atomically reclaimed.
     */
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex('idempotency_cache_key_idx').on(table.cacheKey),
    index('idempotency_cache_expires_idx').on(table.expiresAt),
  ],
)

// ── Cost Events (org-scoped) ────────────────────────────────────────────────

export const platformCostEvents = pgTable(
  'platform_cost_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => orgs.id),
    appId: varchar('app_id', { length: 128 }).notNull(),
    category: varchar('category', { length: 64 }).notNull(),
    units: real('units').notNull(),
    estCostUsd: real('est_cost_usd').notNull(),
    correlationId: uuid('correlation_id'),
    route: varchar('route', { length: 512 }),
    metadata: jsonb('metadata').default({}),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('cost_events_org_idx').on(table.orgId),
    index('cost_events_org_date_idx').on(table.orgId, table.recordedAt),
    index('cost_events_category_idx').on(table.orgId, table.category),
  ],
)

// ── Cost Daily Rollups (org-scoped) ─────────────────────────────────────────

export const platformCostRollups = pgTable(
  'platform_cost_rollups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => orgs.id),
    appId: varchar('app_id', { length: 128 }).notNull(),
    category: varchar('category', { length: 64 }).notNull(),
    day: varchar('day', { length: 10 }).notNull(),
    totalUnits: real('total_units').notNull(),
    totalEstCostUsd: real('total_est_cost_usd').notNull(),
    eventCount: integer('event_count').notNull(),
    rolledUpAt: timestamp('rolled_up_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('cost_rollup_org_app_cat_day_idx').on(table.orgId, table.appId, table.category, table.day),
    index('cost_rollup_org_day_idx').on(table.orgId, table.day),
  ],
)

// ── Cost Budget Breaches (audit trail) ──────────────────────────────────────

export const platformCostBudgetBreaches = pgTable(
  'platform_cost_budget_breaches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => orgs.id),
    state: varchar('state', { length: 32 }).notNull(),
    dailySpendUsd: real('daily_spend_usd').notNull(),
    monthlySpendUsd: real('monthly_spend_usd').notNull(),
    categoryBreaches: jsonb('category_breaches').notNull().default([]),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('cost_breach_org_idx').on(table.orgId),
    index('cost_breach_org_date_idx').on(table.orgId, table.recordedAt),
  ],
)

// ── Org Rate Limit Throttle Log ─────────────────────────────────────────────

export const platformRateLimitThrottles = pgTable(
  'platform_rate_limit_throttles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => orgs.id),
    routeGroup: varchar('route_group', { length: 128 }).notNull(),
    requestCount: integer('request_count').notNull(),
    limitMax: integer('limit_max').notNull(),
    windowMs: integer('window_ms').notNull(),
    throttledAt: timestamp('throttled_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('rate_throttle_org_idx').on(table.orgId),
    index('rate_throttle_org_date_idx').on(table.orgId, table.throttledAt),
  ],
)

// ── Deployment Profile Records ──────────────────────────────────────────────

export const platformDeploymentProfiles = pgTable('platform_deployment_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  profile: varchar('profile', { length: 32 }).notNull(),
  environment: varchar('environment', { length: 32 }).notNull(),
  validations: jsonb('validations').notNull().default({}),
  egressAllowlist: jsonb('egress_allowlist').notNull().default([]),
  payload: jsonb('payload').notNull().default({}),
  validatedAt: timestamp('validated_at', { withTimezone: true }).notNull().defaultNow(),
})
