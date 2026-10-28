import { afterEach, describe, expect, it } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import { claimHistoryReference, publicClaimHistory } from './claim-history-reference'

const dialect = new PgDialect()
const original = process.env.UE_CANONICAL_BOOTSTRAP_V2

afterEach(() => {
  if (original === undefined) delete process.env.UE_CANONICAL_BOOTSTRAP_V2
  else process.env.UE_CANONICAL_BOOTSTRAP_V2 = original
})

describe('claim history reference', () => {
  it.each(['0', '1', undefined])('resolves the internal primary key in bootstrap mode %s', (mode) => {
    if (mode === undefined) delete process.env.UE_CANONICAL_BOOTSTRAP_V2
    else process.env.UE_CANONICAL_BOOTSTRAP_V2 = mode
    const query = dialect.sqlToQuery(claimHistoryReference('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'))
    expect(query.sql).toContain('SELECT id FROM public.claims WHERE claim_id =')
    expect(query.params).toEqual(['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'])
  })

  it('returns the public case id to callers', () => {
    expect(publicClaimHistory({ claimId: 'internal', message: 'x' }, 'public').claimId).toBe('public')
  })
})
