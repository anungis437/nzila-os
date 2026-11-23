import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const SQL = readFileSync(
  join(__dirname, '..', '..', '..', 'migrations', '0052_sage_accountability_adoption.sql'),
  'utf-8',
)

describe('migration 0052 — accountability adoption ledger', () => {
  it('creates an append-only adoption table with RLS', () => {
    expect(SQL).toMatch(/CREATE TABLE IF NOT EXISTS sage_accountability_adoption/i)
    expect(SQL).toMatch(/sage_forbid_accountability_adoption_mutation/i)
    expect(SQL).toMatch(/ENABLE ROW LEVEL SECURITY/i)
    expect(SQL).toMatch(/preserves_draft_facts\s+boolean NOT NULL DEFAULT true/i)
    expect(SQL).toMatch(/draft_status_preserved.*= 'DRAFT_REQUIRES_HUMAN_ADOPTION'/i)
  })
})
