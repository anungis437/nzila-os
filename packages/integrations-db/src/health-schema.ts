/**
 * Nzila OS — Integration DB: Health + Metrics + SLO schemas (Drizzle ORM)
 *
 * Org-scoped tables for provider health, delivery metrics, and SLO targets.
 * No secrets stored — only operational telemetry.
 *
 * @invariant INTEGRATION_HEALTHCHECK_REQUIRED_002
 */
import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  real,
  pgEnum,
  jsonb,
  boolean,
} from 'drizzle-orm/pg-core'
import { integrationProviderEnum } from './schema'

// ── Enums ───────────────────────────────────────────────────────────────────

export const healthStatusEnum = pgEnum('health_status', ['ok', 'degraded', 'down'])

export const circuitStateEnum = pgEnum('circuit_state', ['closed', 'open', 'half_open'])

// ── integration_provider_health ─────────────────────────────────────────────

export const integrationProviderHealth = pgTable('integration_provider_health', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  provider: integrationProviderEnum('provider').notNull(),
  status: healthStatusEnum('status').notNull().default('ok'),
  lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }),
  lastErrorCode: text('last_error_code'),
  lastErrorMessage: text('last_error_message'),
  consecutiveFailures: integer('consecutive_failures').notNull().default(0),
  circuitState: circuitStateEnum('circuit_state').notNull().default('closed'),
  circuitOpenedAt: timestamp('circuit_opened_at', { withTimezone: true }),
  circuitNextRetryAt: timestamp('circuit_next_retry_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── integration_provider_metrics ────────────────────────────────────────────

export const integrationProviderMetrics = pgTable('integration_provider_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  provider: integrationProviderEnum('provider').notNull(),
  windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
  windowEnd: timestamp('window_end', { withTimezone: true }).notNull(),
  sentCount: integer('sent_count').notNull().default(0),
  successCount: integer('success_count').notNull().default(0),
  failureCount: integer('failure_count').notNull().default(0),
  p50LatencyMs: real('p50_latency_ms').notNull().default(0),
  p95LatencyMs: real('p95_latency_ms').notNull().default(0),
  p99LatencyMs: real('p99_latency_ms').notNull().default(0),
  rateLimitedCount: integer('rate_limited_count').notNull().default(0),
  timeoutCount: integer('timeout_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── integration_slo_targets ─────────────────────────────────────────────────

export const integrationSloTargets = pgTable('integration_slo_targets', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id'),
  provider: integrationProviderEnum('provider').notNull(),
  channel: text('channel'),
  /** Minimum success rate (0–1), e.g. 0.99 = 99% */
  successRateTarget: real('success_rate_target').notNull().default(0.99),
  /** Maximum P95 latency in milliseconds */
  p95LatencyTarget: real('p95_latency_target').notNull().default(5000),
  /** Window in days for SLO evaluation */
  windowDays: integer('window_days').notNull().default(30),
  /** Is this the platform default (orgId null) or org override? */
  isDefault: boolean('is_default').notNull().default(false),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
