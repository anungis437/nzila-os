/**
 * 0031 evolves four reachable Django stubs. It does not drop a relation,
 * add a key, or apply NOT NULL to a populated table.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const SQL = readFileSync(
  path.resolve(__dirname, '../migrations-platform/0031_reachable_stub_shape.sql'),
  'utf8',
)
const TABLES = ['data_anonymization_log', 'employment_history', 'job_classifications', 'member_leaves'] as const

describe('0031 reachable stub shape', () => {
  it('evolves only the four reachable relations and fails closed when one is absent', () => {
    for (const table of TABLES) {
      expect(SQL).toContain(`public.${table}`)
      expect(SQL).toContain(`public."${table}"`)
      expect(SQL).toContain(`platform stub evolution fail-closed: public.${table} does not exist.`)
    }
    expect(SQL).not.toMatch(/DROP\s+(TABLE|CONSTRAINT|COLUMN|INDEX|TYPE)/i)
    expect(SQL).not.toMatch(/ADD CONSTRAINT/i)
    expect(SQL).not.toMatch(/ENABLE ROW LEVEL SECURITY/i)
    expect(SQL).toContain('IF NOT EXISTS (SELECT 1 FROM public."employment_history")')
    expect(SQL).toContain('IF NOT EXISTS (SELECT 1 FROM public."data_anonymization_log")')
    expect(SQL).toContain('IF NOT EXISTS (SELECT 1 FROM public."job_classifications")')
  })
})