import { index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

/**
 * pipeline_alerts
 *
 * Persisted alert records emitted by the decision-aggregate materialization
 * pipeline (and any future pipelines using @nzila/pipeline-alerting).
 * Severities: 'critical' | 'warning' | 'info'
 *
 * Critical alerts are surfaced via the /api/pipeline-health endpoint which
 * returns HTTP 503, enabling external health monitors to page on-call.
 */
export const pipelineAlerts = pgTable(
  'pipeline_alerts',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    // Source
    pipelineName: text('pipeline_name').notNull(),
    errorCode: text('error_code').notNull(),

    // Classification
    severity: text('severity').notNull(), // 'critical' | 'warning' | 'info'
    message: text('message').notNull(),

    // Arbitrary structured context (threshold values, org ids, lag ms, etc.)
    metadata: jsonb('metadata'),

    // Lifecycle
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (table) => [
    index('pa_pipeline_created_idx').on(table.pipelineName, table.createdAt),
    index('pa_severity_created_idx').on(table.severity, table.createdAt),
    index('pa_resolved_at_idx').on(table.resolvedAt),
  ],
)
