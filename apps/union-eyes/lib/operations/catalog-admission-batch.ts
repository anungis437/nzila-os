import { createHash } from 'node:crypto'
import type { CatalogRow } from './catalog-admission-core.mjs'

const identity = (statement: string) => createHash('sha256').update(statement).digest('hex')

/** One fresh PostgreSQL statement, using each exact source-owned SELECT as a
 * subquery. json_agg retains the original record fields and row/array ordering;
 * it does not convert the record to jsonb or reconstruct any catalog values.
 */
export function compileCatalogSnapshot(statements: readonly string[]): string {
  if (!statements.length) throw new Error('Catalog snapshot plan is empty')
  return statements.map((statement, index) => {
    if (!/^\s*SELECT\b/i.test(statement) || statement.includes(';')) {
      throw new Error('Catalog snapshot requires a single source-owned SELECT')
    }
    return `SELECT ${index}::integer AS query_index, '${identity(statement)}'::text AS query_hash,
      COALESCE((SELECT json_agg(catalog_rows) FROM (
${statement}
      ) AS catalog_rows), '[]'::json) AS query_rows`
  }).join('\nUNION ALL\n') + '\nORDER BY query_index'
}

/** Fail closed on a missing, extra, duplicated or mislabeled result set. The
 * replay port accepts exact SQL identities only; a newly added inspection read
 * cannot silently consume a different result or fall back to an empty array.
 */
export function catalogSnapshotExecutor(
  statements: readonly string[],
  envelope: CatalogRow[],
): (statement: string) => Promise<CatalogRow[]> {
  if (!statements.length) throw new Error('Catalog snapshot plan is empty')
  if (envelope.length !== statements.length) throw new Error('Catalog snapshot result count differs')
  const results = new Map<number, CatalogRow[]>()
  for (const result of envelope) {
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('Catalog snapshot result is malformed')
    const keys = Object.keys(result).sort()
    if (JSON.stringify(keys) !== JSON.stringify(['query_hash', 'query_index', 'query_rows'])) {
      throw new Error('Catalog snapshot result fields differ')
    }
    const index = result.query_index
    if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= statements.length || results.has(index)) {
      throw new Error('Catalog snapshot result identity is invalid or duplicated')
    }
    if (result.query_hash !== identity(statements[index])) throw new Error('Catalog snapshot SQL identity differs')
    const rows = result.query_rows
    if (!Array.isArray(rows) || rows.some(row => !row || typeof row !== 'object' || Array.isArray(row))) {
      throw new Error('Catalog snapshot rows are malformed')
    }
    results.set(index, rows as CatalogRow[])
  }
  const byStatement = new Map(statements.map((statement, index) => [statement, results.get(index)!]))
  return async statement => {
    const rows = byStatement.get(statement)
    if (!rows) throw new Error('Catalog inspection requested an unplanned SQL statement')
    return rows
  }
}
