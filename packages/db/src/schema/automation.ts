/**
 * Nzila OS — Automation / Orchestrator tables
 *
 * Tracks commands dispatched from the outer loop (WhatsApp / webhook / CLI)
 * through the Nzila Playbook Runner inner loop (GitHub Actions).
 */
import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  pgEnum,
  boolean,
  varchar,
  integer,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

// ── Enums ───────────────────────────────────────────────────────────────────

export const playbookNameEnum = pgEnum('playbook_name', [
  // Platform CI playbooks
  'contract_guardian',
  'lint_check',
  'typecheck',
  'unit_tests',
  'full_ci',
  // Domain workflow playbooks
  'evidence_seal',
  'sla_escalation',
  'reminder_dispatch',
  'onboarding_trigger',
])
export const commandStatusEnum = pgEnum('command_status', [
  'pending',
  'approved',
  'dispatched',
  'running',
  'succeeded',
  'failed',
  'cancelled',
])

// ── automation_commands ─────────────────────────────────────────────────────

export const automationCommands = pgTable(
  'automation_commands',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Org scope for strict tenancy + idempotency uniqueness */
    orgId: uuid('org_id').notNull(),
    /** Caller-supplied correlation ID (UUID v4) — bridges outer → inner loop */
    correlationId: uuid('correlation_id').notNull().unique(),
    /** Idempotency key unique per org */
    idempotencyKey: varchar('idempotency_key', { length: 255 }).notNull(),
    /** Which playbook to run */
    playbook: playbookNameEnum('playbook').notNull(),
    /** Current lifecycle status */
    status: commandStatusEnum('status').notNull().default('pending'),
    /** Optimistic concurrency version */
    version: integer('version').notNull().default(1),
    /** Retry attempt counter */
    attemptCount: integer('attempt_count').notNull().default(0),
    /** If true, no mutations (issues, PRs, deploys) */
    dryRun: boolean('dry_run').notNull().default(true),
    /** Who requested this (WhatsApp number, API key ID, system principal) */
    requestedBy: text('requested_by').notNull(),
    /** Freeform args passed through to the workflow */
    args: jsonb('args').notNull().default({}),
    /** GitHub Actions run ID once dispatched */
    runId: text('run_id'),
    /** Full URL to the GitHub Actions run */
    runUrl: text('run_url'),
    /** Error message if dispatch or execution failed */
    errorMessage: text('error_message'),
    /** Owning worker instance for lease-based coordination */
    executionOwner: varchar('execution_owner', { length: 128 }),
    /** Lease expiry to support multi-instance recovery */
    leaseExpiresAt: timestamp('lease_expires_at', { withTimezone: true }),
    /** Last worker heartbeat for stuck-run detection */
    lastHeartbeatAt: timestamp('last_heartbeat_at', { withTimezone: true }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('automation_commands_org_idempotency_uidx').on(table.orgId, table.idempotencyKey),
    index('automation_commands_org_status_idx').on(table.orgId, table.status),
    index('automation_commands_status_updated_idx').on(table.status, table.updatedAt),
    index('automation_commands_lease_idx').on(table.status, table.leaseExpiresAt),
  ],
)

// ── automation_events (append-only audit trail for orchestrator) ─────────

export const automationEvents = pgTable(
  'automation_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** FK to the command this event belongs to */
    commandId: uuid('command_id')
      .notNull()
      .references(() => automationCommands.id),
    /** Org scope for operator timelines */
    orgId: uuid('org_id').notNull(),
    /** Correlation ID (denormalized for fast lookup) */
    correlationId: uuid('correlation_id').notNull(),
    /** Event type: created, approved, dispatched, started, completed, failed */
    event: varchar('event', { length: 50 }).notNull(),
    /** Actor: system, user ID, webhook source */
    actor: text('actor').notNull(),
    /** Optional payload (workflow outputs, error details, etc.) */
    payload: jsonb('payload').default({}),
    /** Hash for chain integrity (mirrors audit_events pattern) */
    hash: text('hash').notNull(),
    previousHash: text('previous_hash'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('automation_events_org_created_idx').on(table.orgId, table.createdAt),
    index('automation_events_command_created_idx').on(table.commandId, table.createdAt),
  ],
)
