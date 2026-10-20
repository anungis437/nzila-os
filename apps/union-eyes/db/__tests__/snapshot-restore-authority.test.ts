import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { assertDisposableRestoreTarget } from '../../../../tooling/scripts/restore-union-eyes-snapshot.mjs'
import {
  FRAMEWORK_LEDGER_OWNERS,
  FRAMEWORK_MODEL_OWNERS,
} from '../../scripts/bootstrap-v2/framework-contract'

const repoRoot = resolve(__dirname, '../../../..')
const restoreSource = readFileSync(resolve(repoRoot, 'tooling/scripts/restore-union-eyes-snapshot.mjs'), 'utf8')
const reconciliation = readFileSync(
  resolve(repoRoot, 'apps/union-eyes/db/migrations-cache/0017_snapshot_authority_reconciliation.sql'),
  'utf8',
)

describe('snapshot restore authority', () => {
  it('does not grant the public schema to PostgreSQL PUBLIC', () => {
    expect(restoreSource).not.toContain('GRANT ALL ON SCHEMA public TO public')
    expect(restoreSource).toContain('REVOKE ALL ON SCHEMA public FROM PUBLIC')
    expect(reconciliation).toContain('REVOKE ALL ON SCHEMA public FROM PUBLIC')
    expect(reconciliation).not.toContain('GRANT ALL ON SCHEMA public TO public')
  })

  it('refuses the destructive pre-clean against a serving database', () => {
    expect(() => assertDisposableRestoreTarget('union_eyes', { QA_TEST_ENV: 'true' })).toThrow(/Refusing/)
    expect(() => assertDisposableRestoreTarget('ci_e2e', { UE_ENVIRONMENT: 'production', QA_TEST_ENV: 'true' })).toThrow(
      /production/,
    )
    expect(() => assertDisposableRestoreTarget('ci_e2e', {})).toThrow(/Refusing/)
    expect(() => assertDisposableRestoreTarget('ci_e2e', { QA_TEST_ENV: 'true' })).not.toThrow()
    expect(() => assertDisposableRestoreTarget('ue_auth_restore', { UE_DISPOSABLE_DATABASE: '1' })).not.toThrow()
  })

  it('names every dedicated framework relation in the reconciliation', () => {
    for (const table of [...Object.keys(FRAMEWORK_MODEL_OWNERS), ...Object.keys(FRAMEWORK_LEDGER_OWNERS)]) {
      expect(reconciliation, table).toContain(`'${table}'`)
    }
    for (const table of [
      'clc_organization_sync_log',
      'council_elections',
      'golden_shares',
      'governance_events',
      'mission_audits',
      'organization_billing_config',
      'organization_relationships',
      'remittance_approvals',
      'reserved_matter_votes',
      'support_tickets',
      'union_density',
      'webhook_receipts',
      'failed_login_attempts',
      'rate_limit_events',
    ]) {
      expect(reconciliation, table).toContain(`'${table}'`)
    }
  })
})
