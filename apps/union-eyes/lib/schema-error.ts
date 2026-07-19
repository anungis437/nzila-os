/**
 * Structured Schema Error — Runtime Observability
 *
 * Wraps database query failures caused by missing columns, relations, or type
 * mismatches with structured metadata for observability pipelines.
 *
 * Originated from tooling/db/schema-error.ts — imported here for application use.
 */

import { logger } from '@/lib/logger';

export interface SchemaErrorContext {
  table: string
  column?: string
  route?: string
  orgId?: string
  query?: string
}

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
 * If the query fails with a schema-related error, re-throws as a SchemaError
 * with structured JSON for observability ingestion. Non-schema errors pass through.
 */
export async function wrapSchemaQuery<T>(
  queryFn: () => Promise<T>,
  context: SchemaErrorContext,
): Promise<T> {
  try {
    return await queryFn()
  } catch (err: any) {
    const message = err instanceof Error ? err.message : String(err)
    const messageLower = message.toLowerCase()

    const isSchemaError = SCHEMA_ERROR_PATTERNS.some((p) => messageLower.includes(p))

    if (isSchemaError) {
      const schemaErr = new SchemaError(
        `Schema mismatch on table "${context.table}": ${message}`,
        context,
      )
      logger.error('[SchemaError]', schemaErr.toStructuredLog())
      throw schemaErr
    }

    throw err
  }
}
