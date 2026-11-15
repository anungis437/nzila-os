import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { catalogSnapshotExecutor, compileCatalogSnapshot } from './catalog-admission-batch'

const statements = ['SELECT false AS privileged', 'SELECT ARRAY[\'b\',\'a\']::text[] AS columns']
const hash = (statement: string) => createHash('sha256').update(statement).digest('hex')
const envelope = () => statements.map((statement, query_index) => ({ query_index, query_hash: hash(statement), query_rows: query_index ? [{ columns: ['b', 'a'] }] : [{ privileged: false }] }))

describe('one-statement catalog snapshot transport', () => {
  it('embeds every exact SELECT and its identity once in a single ordered statement', () => {
    const compiled = compileCatalogSnapshot(statements)
    for (const statement of statements) {
      expect(compiled.split(statement)).toHaveLength(2)
      expect(compiled).toContain(hash(statement))
    }
    expect(compiled).toContain('json_agg(catalog_rows)')
    expect(compiled).not.toContain('jsonb_agg')
    expect(compiled).toMatch(/ORDER BY query_index$/)
    expect(compiled).not.toContain(';')
  })

  it('replays exact identities regardless of envelope row order, preserving field and array values', async () => {
    const replay = catalogSnapshotExecutor(statements, envelope().reverse())
    expect(await replay(statements[0])).toEqual([{ privileged: false }])
    expect(await replay(statements[1])).toEqual([{ columns: ['b', 'a'] }])
    await expect(replay('SELECT true AS privileged')).rejects.toThrow('unplanned SQL')
  })

  for (const mode of ['missing', 'extra', 'duplicate', 'wrong hash', 'wrong index', 'missing field', 'extra field', 'null rows', 'scalar row', 'array row'] as const) {
    it(`fails closed on ${mode} results`, () => {
      const rows: Record<string, unknown>[] = envelope()
      if (mode === 'missing') rows.pop()
      if (mode === 'extra') rows.push(envelope()[0])
      if (mode === 'duplicate') rows[1] = { ...rows[0] }
      if (mode === 'wrong hash') rows[0].query_hash = hash('SELECT true AS privileged')
      if (mode === 'wrong index') rows[0].query_index = '0'
      if (mode === 'missing field') delete rows[0].query_rows
      if (mode === 'extra field') rows[0].unexpected = []
      if (mode === 'null rows') rows[0].query_rows = null
      if (mode === 'scalar row') rows[0].query_rows = [false]
      if (mode === 'array row') rows[0].query_rows = [[]]
      expect(() => catalogSnapshotExecutor(statements, rows)).toThrow('Catalog snapshot')
    })
  }

  it('refuses an empty plan, mutations or multiple statements before database access', () => {
    expect(() => compileCatalogSnapshot([])).toThrow('empty')
    expect(() => catalogSnapshotExecutor([], [])).toThrow('empty')
    for (const statement of ['UPDATE pg_roles SET rolsuper=true', 'SELECT 1; SELECT 2']) {
      expect(() => compileCatalogSnapshot([statement])).toThrow('single source-owned SELECT')
    }
  })
})
