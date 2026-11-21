import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

/** Explicit connection infrastructure for a caller-owned typed schema.
 * No environment lookup, shared singleton, default schema or authority grant.
 */
export function createPostgresDatabase<TSchema extends Record<string, unknown>>(
  connectionString: string,
  schema: TSchema,
  options: postgres.Options<Record<string, never>>,
): PostgresJsDatabase<TSchema> {
  if (typeof connectionString !== 'string' || !connectionString.trim()) {
    throw new Error('An explicit Postgres connection URL is required')
  }
  return drizzle(postgres(connectionString, options), { schema })
}
