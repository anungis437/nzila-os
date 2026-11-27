import { describe, expect, it, vi } from 'vitest'
import pg from 'pg'
import {
  assertModuleAdmissionCommittedPair,
  assertModuleAdmissionSelectors,
  MODULE_ADMISSION_RUNTIME_SELECTORS,
  qualifyModuleAdmissionRuntimeSecurity,
} from './module-admission-runtime-security'
import { COLUMN_ACTOR_CLASSES } from './runtime-column-security'
import { requireSameOwnedRuntimeClients } from './runtime-session-proof'
const pair = [
  { contract_id: 'a', organization_id: 'org-a' },
  { contract_id: 'b', organization_id: 'org-b' },
] as const
describe('read-only admission column proof protocol (not native qualification)', () => {
  it('uses only unique source-declared published selectors, including covered-org composite key', () => {
    expect(() => assertModuleAdmissionSelectors()).not.toThrow()
    expect(MODULE_ADMISSION_RUNTIME_SELECTORS.contract_covered_orgs).toEqual([
      'contract_id',
      'organization_id',
    ])
    expect(MODULE_ADMISSION_RUNTIME_SELECTORS.contract_covered_orgs).not.toContain('id')
  })
  it('requires both independently committed source rows', () => {
    expect(() =>
      assertModuleAdmissionCommittedPair([...pair], pair, ['contract_id', 'organization_id']),
    ).not.toThrow()
  })
  it.each([
    { name: 'empty', rows: [] },
    { name: 'missing foreign', rows: [pair[0]] },
    { name: 'missing own', rows: [pair[1]] },
    { name: 'duplicate own', rows: [pair[0], pair[0]] },
    { name: 'duplicate foreign', rows: [...pair, pair[1]] },
  ])('rejects $name committed rows at the intended nonvacuous boundary', ({ rows }) => {
    expect(() =>
      assertModuleAdmissionCommittedPair(rows, pair, ['contract_id', 'organization_id']),
    ).toThrow('BOTH_COMMITTED_MODULE_ROWS_REQUIRED')
  })
  it('refuses a vacuous same-row own/foreign fixture', () => {
    expect(() =>
      assertModuleAdmissionCommittedPair(
        [pair[0]],
        [pair[0], pair[0]],
        ['contract_id', 'organization_id'],
      ),
    ).toThrow('INDEPENDENT_MODULE_ROWS_REQUIRED')
  })
  it('refuses an unknown key rather than testing undefined identity values', () => {
    expect(() => assertModuleAdmissionCommittedPair([...pair], pair, ['id'])).toThrow(
      'NONNULL_SOURCE_SELECTOR_REQUIRED',
    )
  })
  it('never upgrades preflight refusal to a passed column/history/rollback witness', async () => {
    const client = (user: string) =>
      new pg.Client({ host: '127.0.0.1', port: 5432, database: 'ue_v2_protocol', user })
    const binding = vi.fn(async () => {
      throw new Error('unconnected protocol fixture must refuse before binder')
    })
    const fixture = {
      withBinding: binding,
      recipientUserId: 'recipient',
      probeRecipientUserId: 'probe',
      programId: 'program',
      awardTypeId: 'type',
    }
    const result = await qualifyModuleAdmissionRuntimeSecurity({
      operatorClient: client('operator'),
      runtimeClient: client('runtime'),
      systemClient: client('system'),
      disposableDatabase: 'production',
      actors: COLUMN_ACTOR_CLASSES.map((actorClass) => ({ ...fixture, actorClass })),
      foreign: fixture,
      rows: {},
    })
    expect(result.status).toBe('FAIL')
    expect(result.reports).toHaveLength(4)
    expect(
      result.reports.every((report) => report.status === 'FAIL' && report.cases.length === 0),
    ).toBe(true)
    expect(result.historyProofs).toEqual([])
    expect(binding).not.toHaveBeenCalled()
    expect(result.wholeSecurityQualification).toBe('NOT_PROVEN')
  })
  it('rejects shared or remote SQL clients before any query', () => {
    const operator = new pg.Client({ host: '127.0.0.1', port: 5432, database: 'ue_v2_protocol' })
    expect(() => requireSameOwnedRuntimeClients(operator, [operator], 'ue_v2_protocol')).toThrow(
      'DISTINCT_CLIENTS_REQUIRED',
    )
    const remote = new pg.Client({
      host: 'staging.example.invalid',
      port: 5432,
      database: 'ue_v2_protocol',
    })
    expect(() => requireSameOwnedRuntimeClients(operator, [remote], 'ue_v2_protocol')).toThrow(
      'OWNED_LOOPBACK_CLIENT_REQUIRED',
    )
  })
})
