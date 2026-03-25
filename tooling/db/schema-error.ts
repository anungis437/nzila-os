/**
 * Structured Schema Error — Runtime Observability (Phase 8)
 *
 * Provides a typed error class for database schema mismatches at runtime.
 * Wraps query failures caused by missing columns, relations, or type mismatches
 * with structured metadata for observability pipelines (App Insights, Datadog, etc.).
 *
 * Usage:
 *   import { SchemaError, wrapSchemaQuery } from 'tooling/db/schema-error'
 *
 *   const rows = await wrapSchemaQuery(
 *     () => db.select().from(duesTransactions).where(eq(orgId, id)),
 *     { table: 'dues_transactions', route: '/api/dues', orgId }
 *   )
 */

export interface SchemaErrorContext {
  /** The DB table being queried */
  table: string
  /** The specific column that caused the error, if identifiable */
  column?: string
  /** The API route or page path where the error occurred */
  route?: string
  /** The organization ID for tenant context */
  orgId?: string
  /** A sanitized description of the query (no values, just structure) */
  query?: string
}

/**
 * Structured error class for schema-related database failures.
 * Emits structured JSON logs suitable for observability ingestion.
 */
export class SchemaError extends Error {
  public readonly code = 'SCHEMA_MISMATCH' as const
  public readonly context: SchemaErrorContext
  public readonly timestamp: string

  constructor(message: string, context: SchemaErrorContext) {
    super(message)
    this.name = 'SchemaError'
    this.context = context
    this.timestamp = new Date().toISOString()
  }

  /** Produces a flat JSON-serializable object for structured logging. */
  toStructuredLog(): Record<string, unknown> {
    return {
      error_code: this.code,
      error_name: this.name,
      message: this.message,
      table: this.context.table,
      column: this.context.column ?? null,
      route: this.context.route ?? null,
      org_id: this.context.orgId ?? null,
      query: this.context.query ?? null,
      timestamp: this.timestamp,
    }
  }
}

/** Patterns that indicate a schema-level DB error vs. a transient/logic error. */
const SCHEMA_ERROR_PATTERNS = [
  'column',
  'relation',
  'does not exist',
  'type mismatch',
  'undefined column',
  'unknown column',
  'no such table',
]

/**
 * Wraps a database query with structured schema error detection.
 * If the query fails with a schema-related error, logs structured JSON
 * and re-throws as a SchemaError. Non-schema errors pass through unchanged.
 */
export async function wrapSchemaQuery<T>(
  queryFn: () => Promise<T>,
  context: SchemaErrorContext,
): Promise<T> {
  try {
    return await queryFn()
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    const messageLower = message.toLowerCase()

    const isSchemaError = SCHEMA_ERROR_PATTERNS.some((p) => messageLower.includes(p))

    if (isSchemaError) {
      const schemaErr = new SchemaError(
        `Schema mismatch on table "${context.table}": ${message}`,
        context,
      )
      // Structured log for observability pipeline ingestion
      console.error(JSON.stringify(schemaErr.toStructuredLog()))
      throw schemaErr
    }

    // Non-schema errors pass through unmodified
    throw err
  }
}
