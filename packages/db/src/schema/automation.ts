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
} from 'drizzle-orm/pg-core'

// ── Enums ───────────────────────────────────────────────────────────────────

export const playbookNameEnum = pgEnum('playbook_name', [
  'contract_guardian',
  'lint_check',
  'typecheck',
  'unit_tests',
  'full_ci',
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

export const automationCommands = pgTable('automation_commands', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** Caller-supplied correlation ID (UUID v4) — bridges outer → inner loop */
  correlationId: uuid('correlation_id').notNull().unique(),
  /** Which playbook to run */
  playbook: playbookNameEnum('playbook').notNull(),
  /** Current lifecycle status */
  status: commandStatusEnum('status').notNull().default('pending'),
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
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── automation_events (append-only audit trail for orchestrator) ─────────

export const automationEvents = pgTable('automation_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** FK to the command this event belongs to */
  commandId: uuid('command_id')
    .notNull()
    .references(() => automationCommands.id),
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
})
