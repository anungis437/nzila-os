// Structural assertions for migration 0050 — institutional mandate authority.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const SQL = readFileSync(
  join(__dirname, '..', '..', '..', 'migrations', '0050_sage_institutional_mandate_authority.sql'),
  'utf-8',
)

describe('migration 0050 — institutional mandate authority', () => {
  it('creates mandate, commitment ledger and append-only action tables', () => {
    expect(SQL).toMatch(/CREATE TABLE IF NOT EXISTS sage_institutional_mandate/i)
    expect(SQL).toMatch(/CREATE TABLE IF NOT EXISTS sage_resource_commitment/i)
    expect(SQL).toMatch(/CREATE TABLE IF NOT EXISTS sage_institutional_action/i)
  })

  it('stores verification status as a controlled enum defaulting to unverified', () => {
    expect(SQL).toMatch(/sage_mandate_verification/i)
    expect(SQL).toMatch(/sage_institutional_action_kind/i)
    expect(SQL).toMatch(/verification_status\s+sage_mandate_verification NOT NULL DEFAULT 'unverified'/i)
  })

  it('binds monetary ceiling and currency as a pair', () => {
    expect(SQL).toMatch(/sage_institutional_mandate_money_pair_chk/i)
    expect(SQL).toMatch(/monetary_limit_minor IS NOT NULL AND currency IS NOT NULL/i)
  })

  it('enforces unique idempotency for commitments and actions', () => {
    expect(SQL).toMatch(/sage_resource_commitment_idempotency_uq/i)
    expect(SQL).toMatch(/sage_institutional_action_idempotency_uq/i)
  })

  it('makes institutional actions append-only and enables tenant RLS', () => {
    expect(SQL).toMatch(/sage_forbid_institutional_action_mutation/i)
    expect(SQL).toMatch(/BEFORE UPDATE OR DELETE ON sage_institutional_action/i)
    expect(SQL).toMatch(/ENABLE ROW LEVEL SECURITY/i)
    expect(SQL).toMatch(/org_id = current_setting\('app\.tenant_id'\)/i)
  })
})
