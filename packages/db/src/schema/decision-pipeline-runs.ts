import { index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

/**
 * decision_pipeline_runs
 *
 * Immutable run log for every execution of the decision aggregate materialization
 * pipeline. Written at run start (status=running) and updated on completion.
 * Never deleted — retained for audit and freshness SLA trend analysis.
 */
export const decisionPipelineRuns = pgTable(
  'decision_pipeline_runs',
  {
    id: text('id').primaryKey(),
    pipelineName: text('pipeline_name').notNull(),

    // Execution parameters
    mode: text('mode').notNull(), // 'incremental'|'full_rebuild'|'org_specific'|'dry_run'
    organizationId: text('organization_id'), // null except in org_specific mode

    // Timing
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),

    // Outcome
    status: text('status').notNull().default('running'), // 'running'|'succeeded'|'failed'|'skipped'

    // Volume
    recordsScanned: integer('records_scanned').notNull().default(0),
    recordsMaterialized: integer('records_materialized').notNull().default(0),
    aggregatesWritten: integer('aggregates_written').notNull().default(0),

    // Freshness
    freshnessLagMs: integer('freshness_lag_ms'),

    // Error context (populated on failure)
    errorCode: text('error_code'),
    errorMessage: text('error_message'),

    // Arbitrary extra context (window size, from/to range, etc.)
    metadata: jsonb('metadata'),
  },
  (table) => [
    index('dpr_name_started_idx').on(table.pipelineName, table.startedAt),
    index('dpr_org_started_idx').on(table.organizationId, table.startedAt),
    index('dpr_status_started_idx').on(table.status, table.startedAt),
  ],
)
