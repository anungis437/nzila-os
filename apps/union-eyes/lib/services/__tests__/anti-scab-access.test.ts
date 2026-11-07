import { describe, expect, it } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import { antiScabAuthorCondition } from '../anti-scab-access'

const dialect = new PgDialect()
const render = (condition: ReturnType<typeof antiScabAuthorCondition>) => dialect.sqlToQuery(condition)

// DEF-0B4-OHS-ANTI-SCAB-RECORD-NO-AUTHOR-OR-CASE-AUTHORITY
describe('antiScabAuthorCondition', () => {
  it('reaches only the rows the caller filed', () => {
    const query = render(antiScabAuthorCondition('steward-a'))
    expect(query.sql).toContain('"created_by" = $1')
    expect(query.params).toEqual(['steward-a'])
  })

  it('reaches nothing without an identity (a record with no author is reached by no one)', () => {
    expect(render(antiScabAuthorCondition(null)).sql).toBe('false')
    expect(render(antiScabAuthorCondition(undefined)).sql).toBe('false')
    expect(render(antiScabAuthorCondition('')).sql).toBe('false')
  })
})
