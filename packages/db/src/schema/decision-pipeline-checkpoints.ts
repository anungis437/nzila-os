import { index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

/**
 * decision_pipeline_checkpoints
 *
 * Stores the durable cursor for the incremental materialization pipeline.
 * One row per named pipeline. Updated only after a fully successful write.
 * Includes both a timestamp AND the last audit record id to avoid timestamp
 * collision ambiguity (two records inserted within the same millisecond).
 */
export const decisionPipelineCheckpoints = pgTable(
  'decision_pipeline_checkpoints',
  {
    id: text('id').primaryKey(),
    pipelineName: text('pipeline_name').notNull().unique(),

    // Cursor — both fields required for unambiguous resume
    lastSuccessfulAuditCreatedAt: timestamp('last_successful_audit_created_at', {
      withTimezone: true,
    }),
    lastSuccessfulAuditId: text('last_successful_audit_id'),

    // Metadata about the last run that advanced this checkpoint
    lastRunStartedAt: timestamp('last_run_started_at', { withTimezone: true }).notNull(),
    lastRunCompletedAt: timestamp('last_run_completed_at', { withTimezone: true }),
    lastRunStatus: text('last_run_status').notNull().default('running'), // 'running'|'succeeded'|'failed'|'skipped'

    // Counters from the last run
    recordsScanned: integer('records_scanned').notNull().default(0),
    recordsMaterialized: integer('records_materialized').notNull().default(0),

    // Failure context
    failureReason: text('failure_reason'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('dpc_pipeline_name_idx').on(table.pipelineName),
    index('dpc_last_run_status_idx').on(table.lastRunStatus),
  ],
)
