/**
 * The schema census and the mutation-scope baseline stay ratchets.
 * This checks the prepared batch program covers every remaining entry and does not add one.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildSchemaMutationBatches } from '../../scripts/lib/schema-mutation-batches'

const REGISTER = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/register')
const PROGRAM = path.join(REGISTER, 'ue-schema-mutation-batches.json')

describe('schema and mutation batch program', () => {
  const program = buildSchemaMutationBatches()
  const committed = JSON.parse(readFileSync(PROGRAM, 'utf8'))

  it('matches the committed program', () => {
    expect(program).toEqual(committed)
  })

  it('covers the census and the mutation baseline without adding a row', () => {
    const census = JSON.parse(readFileSync(path.join(REGISTER, 'ue-canonical-schema-census.json'), 'utf8')).entries as { table: string }[]
    const disposition = JSON.parse(readFileSync(path.join(REGISTER, 'ue-canonical-schema-disposition.json'), 'utf8')).entries as Record<string, { disposition: string }>
    const baseline = JSON.parse(readFileSync(path.join(REGISTER, 'ue-mutation-scope-baseline.json'), 'utf8')).entries as Record<string, number>
    expect(program.applyNow).toBe(false)
    expect(program.sourceMutationBaselineSum).toBe(13)
    expect(program.mutationLiveSum).toBeLessThanOrEqual(13)
    expect(program.censusCount).toBe(census.length)
    expect(program.schema.map((entry) => entry.table)).toEqual(census.map((entry) => entry.table).sort())
    expect(new Set(program.schema.map((entry) => entry.table)).size).toBe(census.length)
    for (const entry of program.schema) expect(entry.disposition).toBe(disposition[entry.table].disposition)
    expect(program.mutations.map((entry) => entry.key)).toEqual(Object.keys(baseline).sort())
    expect(program.mutationBaselineSum).toBe(Object.values(baseline).reduce((sum, count) => sum + count, 0))
    expect(program.mutations.reduce((sum, entry) => sum + entry.baselineCount, 0)).toBe(program.mutationBaselineSum)
    expect(program.mutationLiveSum).toBeLessThanOrEqual(program.mutationBaselineSum)
    for (const entry of program.mutations) expect(entry.liveCount).toBeLessThanOrEqual(entry.baselineCount)
  })

  it('keeps hold batches from shrinking a ratchet and keeps create-relation equal to the oracle exclusion', () => {
    const holds = new Set(program.batches.filter((batch) => batch.execution === 'hold').map((batch) => batch.id))
    for (const entry of program.schema) {
      if (!holds.has(entry.batchId)) continue
      const batch = program.batches.find((item) => item.id === entry.batchId)
      expect(batch?.shrink).toBe('none')
    }
    const excluded = [...(JSON.parse(readFileSync(path.resolve(__dirname, '../../../../tooling/db/canonical-schema/oracle-binding.json'), 'utf8')).dispositionExcluded as string[])].sort()
    expect(program.schema.filter((entry) => entry.batchId === 'schema-create-relation').map((entry) => entry.table).sort()).toEqual(excluded)
    expect(program.schema.some((entry) => entry.disposition === 'EVOLVE_NEXT_TRANCHE')).toBe(false)
    const finance = program.batches.find((batch) => batch.id === 'mutation-finance-latent')
    expect(finance?.action).toContain('Do not issue a financial mandate')
    expect(finance?.action).toContain('not an approval path')
    expect(finance?.statementCount).toBe(7)
    expect(finance?.liveStatementCount).toBe(0)
    expect(finance?.execution).toBe('implemented')
    expect(finance?.applyNow).toBe(true)
    expect(program.schema.filter((entry) => entry.table === 'grievance_communications').map((entry) => entry.batchId)).toEqual(['schema-django-defined'])
    const clc = program.batches.find((batch) => batch.id === 'mutation-clc-sync-log')
    expect(clc?.action).toContain('Do not drop the relation')
    expect(clc?.statementCount).toBe(1)
    expect(clc?.liveStatementCount).toBe(0)
    expect(clc?.execution).toBe('implemented')
    expect(clc?.applyNow).toBe(true)
    const pilot = program.batches.find((batch) => batch.id === 'mutation-pilot-rebind')
    expect(pilot?.action).toContain('cannot supply an organization token')
    expect(pilot?.statementCount).toBe(1)
    expect(pilot?.liveStatementCount).toBe(0)
    expect(pilot?.execution).toBe('implemented')
    expect(pilot?.applyNow).toBe(true)
    const workbook = program.batches.find((batch) => batch.id === 'mutation-workbook-unclaimed')
    expect(workbook?.action).toContain('READY_FOR_VS_EXECUTION')
    expect(workbook?.statementCount).toBe(2)
    expect(workbook?.liveStatementCount).toBe(0)
    expect(workbook?.execution).toBe('implemented')
    expect(workbook?.applyNow).toBe(true)
    const retention = program.batches.find((batch) => batch.id === 'mutation-location-retention')
    expect(retention?.action).toContain('READY_FOR_VS_EXECUTION')
    expect(retention?.statementCount).toBe(2)
    expect(retention?.liveStatementCount).toBe(0)
    expect(retention?.execution).toBe('implemented')
    expect(retention?.applyNow).toBe(true)
    const retire = program.batches.find((batch) => batch.id === 'schema-retire-declaration')
    expect(retire?.entryCount).toBe(3)
    expect(retire?.sourceRetired).toBe(true)
    expect(retire?.applyNow).toBe(false)
    expect(retire?.execution).toBe('cursor-then-vs')
    expect(retire?.action).toContain('READY_FOR_VS_EXECUTION')
    expect(retire?.action).toContain('Do not DROP')
    expect(retire?.action).not.toContain('totalStorage = 0')
    const unreferenced = program.batches.find((batch) => batch.id === 'schema-live-unreferenced')
    expect(unreferenced?.entryCount).toBe(5)
    expect(unreferenced?.sourceRetired).toBe(true)
    expect(unreferenced?.applyNow).toBe(false)
    expect(unreferenced?.action).toContain('READY_FOR_VS_EXECUTION')
    expect(unreferenced?.action).toContain('Do not DROP')
    const removed = ['bank_accounts', 'bank_reconciliations', 'clc_remittance_mapping', 'erp_invoices', 'grievance_timeline']
    const retained = ['budget_pool', 'dues_rates', 'gl_account_mappings', 'grievance_settlements', 'integration_webhooks', 'payment_cycles', 'payment_disputes', 'safety_training_records']
    for (const table of removed) {
      const row = program.schema.find((entry) => entry.table === table)
      expect(row?.batchId).toBe('schema-live-unreferenced')
      expect(row?.declarationRemoved).toBe(true)
    }
    for (const table of retained) {
      const row = program.schema.find((entry) => entry.table === table)
      expect(row?.batchId).toBe('schema-live-unreferenced-blocked')
      expect(row?.declarationRemoved).toBeUndefined()
      expect(row?.holdReason).toBeTruthy()
    }
    expect(program.censusCount).toBe(231)
    const evolve = program.batches.find((batch) => batch.id === 'schema-evolve-reachable')
    expect(evolve?.entryCount).toBe(5)
    expect(evolve?.applyNow).toBe(false)
    expect(evolve?.action).toContain('0031_reachable_stub_shape')
    expect(evolve?.action).toContain('0039_committee_memberships_shape')
    expect(program.schema.find((entry) => entry.table === 'committee_memberships')?.batchId).toBe('schema-evolve-reachable')
    expect(evolve?.action).toContain('READY_FOR_VS_EXECUTION')
    expect(evolve?.action).toContain('no DROP')
    const history = program.schema.find((entry) => entry.table === 'notification_history')
    expect(history?.declarationRemoved).toBe(true)
    expect(history?.batchId).toBe('schema-verify-dead-module')
    for (const table of ['user_sessions', 'member_documents', 'grievance_stages', 'grievance_workflows']) {
      const row = program.schema.find((entry) => entry.table === table)
      expect(row?.batchId).toBe('schema-verify-dead-required')
      expect(row?.declarationRemoved).toBeUndefined()
      expect(row?.holdReason).toBeTruthy()
    }
    const serviceRetained = [
      'accessibility_audits',
      'accessibility_issues',
      'financial_audit_log',
      'gss_applications',
      'indigenous_member_data',
      'member_addresses',
    ]
    const dependencyHeld = [
      'clc_webhook_log',
      'event_reminders',
      'grievance_approvals',
      'grievance_assignments',
      'grievance_stages',
      'grievance_workflows',
      'member_documents',
      'notification_log',
      'organization_contacts',
      'organization_sharing_settings',
      'role_tenure_history',
      'room_bookings',
      'segment_executions',
      'segment_exports',
      'user_sessions',
    ]
    const required = program.batches.find((batch) => batch.id === 'schema-verify-dead-required')
    expect(required?.execution).toBe('hold')
    expect(required?.shrink).toBe('none')
    expect(required?.action).toContain('Do not DROP')
    expect(program.schema.find((entry) => entry.table === 'financial_audit_log')?.holdReason).toContain('Do not invent a finance officer')
    for (const table of [...serviceRetained, ...dependencyHeld]) {
      const row = program.schema.find((entry) => entry.table === table)
      expect(row?.batchId).toBe('schema-verify-dead-required')
      expect(row?.declarationRemoved).toBeUndefined()
      expect(row?.holdReason).toBeTruthy()
    }
    expect(program.schema.filter((entry) => entry.batchId === 'schema-verify-dead-module').map((entry) => entry.table))
      .not.toEqual(expect.arrayContaining(serviceRetained))
  })
})
