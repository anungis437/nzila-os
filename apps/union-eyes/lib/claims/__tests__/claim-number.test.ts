import { describe, expect, it } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import { allocateClaimNumber } from '../claim-number'

const dialect = new PgDialect()

function executor(lastSequence: number | null) {
  const statements: { sql: string; params: unknown[] }[] = []
  const tx = {
    execute: async (query: Parameters<PgDialect['sqlToQuery']>[0]) => {
      const compiled = dialect.sqlToQuery(query)
      statements.push({ sql: compiled.sql, params: compiled.params })
      return /pg_advisory_xact_lock/.test(compiled.sql)
        ? []
        : [{ last_sequence: lastSequence ?? 0 }]
    },
  }
  return { tx: tx as never, statements }
}

describe('allocateClaimNumber', () => {
  const now = new Date('2026-10-15T12:00:00Z')

  it('takes a per-organization, per-day advisory lock before reading the sequence', async () => {
    const { tx, statements } = executor(null)
    await allocateClaimNumber(tx, '3086b9ba-7e02-4b29-8ed5-0636d590e22b', now)
    expect(statements[0].sql).toContain('pg_advisory_xact_lock')
    expect(statements[0].params[0]).toBe(
      'claim_number:3086b9ba-7e02-4b29-8ed5-0636d590e22b:20261015',
    )
    expect(statements[1].sql).toContain('organization_id =')
    // An untyped FROM parameter would select the POSIX-regex substring overload and always yield NULL.
    expect(statements[1].sql).toMatch(/substring\(claim_number FROM \$\d+::integer\)/)
  })

  it('starts each organization at 0001 independently', async () => {
    expect(await allocateClaimNumber(executor(null).tx, 'org-a', now)).toBe('CLM-20261015-0001')
    expect(await allocateClaimNumber(executor(null).tx, 'org-b', now)).toBe('CLM-20261015-0001')
  })

  it('increments numerically, including past four digits', async () => {
    expect(await allocateClaimNumber(executor(7).tx, 'org-a', now)).toBe('CLM-20261015-0008')
    expect(await allocateClaimNumber(executor(9999).tx, 'org-a', now)).toBe('CLM-20261015-10000')
  })
})
