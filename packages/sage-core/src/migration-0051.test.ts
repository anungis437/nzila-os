// Structural assertions for migration 0051 — institutional capacity / recusal.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const SQL = readFileSync(
  join(__dirname, '..', '..', '..', 'migrations', '0051_sage_institutional_capacity_recusal.sql'),
  'utf-8',
)

describe('migration 0051 — institutional capacity / recusal', () => {
  it('creates office holding and conflict attestation tables', () => {
    expect(SQL).toMatch(/CREATE TABLE IF NOT EXISTS sage_institutional_office_holding/i)
    expect(SQL).toMatch(/CREATE TABLE IF NOT EXISTS sage_institutional_conflict_attestation/i)
  })

  it('requires instrument provenance on both tables', () => {
    expect(SQL).toMatch(/instrument_ref\s+text NOT NULL/i)
    expect(SQL).toMatch(/instrument_version\s+text NOT NULL/i)
  })

  it('treats conflicted as an explicit boolean (no default clear)', () => {
    expect(SQL).toMatch(/conflicted\s+boolean NOT NULL/i)
  })

  it('enables tenant RLS on both tables', () => {
    expect(SQL).toMatch(/ENABLE ROW LEVEL SECURITY/i)
    expect(SQL).toMatch(/org_id = current_setting\('app\.tenant_id'\)/i)
  })
})
