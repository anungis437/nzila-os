/**
 * The schema census and the mutation-scope baseline stay ratchets.
 * This checks the prepared batch program covers every remaining entry and does not add one.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { is } from 'drizzle-orm'
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core'
import * as declarations from '../schema'
import { buildSchemaMutationBatches } from '../../scripts/lib/schema-mutation-batches'

const REGISTER = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/register')
const PROGRAM = path.join(REGISTER, 'ue-schema-mutation-batches.json')

describe('schema and mutation batch program', () => {
  const program = buildSchemaMutationBatches()
  const committed = JSON.parse(readFileSync(PROGRAM, 'utf8'))

  it('matches the committed program', () => {
    expect(program).toEqual(committed)
  })

  // The census was regenerated against a database built by Django migrate plus the approved bootstrap (231 -> 202).
  // A table may only leave a ratchet by being evolved or by having its declaration retired, so each exit is tied to its source.
  it('explains every table that left the census: its declaration is retired or a registered migration evolved it', () => {
    const census = new Set((JSON.parse(readFileSync(path.join(REGISTER, 'ue-canonical-schema-census.json'), 'utf8')).entries as { table: string }[]).map((entry) => entry.table))
    const declared = new Set(
      Object.values(declarations as Record<string, unknown>)
        .filter((value) => is(value, PgTable))
        .map((value) => getTableConfig(value as PgTable).name),
    )
    const retiredDeclarations = [
      'bank_accounts', 'bank_reconciliations', 'clc_remittance_mapping', 'erp_invoices', 'grievance_timeline',
      'notification_history', 'org_usage', 'signature_templates', 'signature_webhooks_log',
    ]
    for (const table of retiredDeclarations) {
      expect(declared.has(table), `${table} is still declared`).toBe(false)
      expect(census.has(table), `${table} is still in the census`).toBe(false)
    }
    const evolvedBy: Record<string, string[]> = {
      'db/migrations-platform/0031_reachable_stub_shape.sql': ['data_anonymization_log', 'employment_history', 'job_classifications', 'member_leaves'],
      'db/migrations-platform/0039_committee_memberships_shape.sql': ['committee_memberships'],
      'db/migrations-platform/0041_room_bookings_shape.sql': ['room_bookings'],
      'db/migrations-cache/0031_feature_flags_attribution_columns.sql': ['feature_flags'],
      'db/migrations-platform/0060_reachable_stub_shape_2.sql': [
        'alert_rules', 'arbitration_decisions', 'automation_rules', 'case_studies', 'clc_organization_sync_log', 'cost_of_living_data',
        'external_data_sync_log', 'provincial_privacy_config', 'reserved_matter_votes', 'support_tickets', 'union_density',
        'wage_benchmarks', 'webhook_receipts',
      ],
    }
    const appRoot = path.resolve(__dirname, '../..')
    for (const [file, tables] of Object.entries(evolvedBy)) {
      const sql = readFileSync(path.join(appRoot, file), 'utf8')
      for (const table of tables) {
        expect(census.has(table), `${table} is still in the census`).toBe(false)
        const alters = new RegExp(`ALTER\\s+TABLE\\s+(?:IF\\s+EXISTS\\s+)?(?:ONLY\\s+)?(?:public\\.)?"?${table}"?[\\s(;]`, 'i')
        expect(alters.test(sql), `${file} does not alter ${table}`).toBe(true)
      }
    }
    const explained = [...retiredDeclarations, ...Object.values(evolvedBy).flat()]
    expect(new Set(explained).size, 'a table is explained twice').toBe(explained.length)
    const originalCensusSize = 231
    expect(explained.length, 'a table left the census without an explanation').toBe(originalCensusSize - census.size)
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
    // These four batches emptied when the census was regenerated against the real schema: every entry left it, and the
    // 'explains every table that left the census' test says why each was allowed to.
    for (const id of ['schema-retire-declaration', 'schema-live-unreferenced', 'schema-verify-dead-module', 'schema-evolve-reachable']) {
      expect(program.batches.some((batch) => batch.id === id), id).toBe(false)
    }
    const retained = ['budget_pool', 'dues_rates', 'gl_account_mappings', 'grievance_settlements', 'integration_webhooks', 'payment_cycles', 'payment_disputes', 'safety_training_records']
    for (const table of retained) {
      const row = program.schema.find((entry) => entry.table === table)
      expect(row?.batchId).toBe('schema-live-unreferenced-blocked')
      expect(row?.declarationRemoved).toBeUndefined()
      expect(row?.holdReason).toBeTruthy()
    }
    expect(program.censusCount).toBe(202)
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
