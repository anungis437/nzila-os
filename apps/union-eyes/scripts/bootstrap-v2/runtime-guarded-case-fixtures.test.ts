/** Structural proof validation only. Actual canonical workflows and their guards
 * are exercised by the owned PG15/16 matrix, never simulated by these objects. */
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  GUARDED_CASE_RUNTIME_TABLES,
  guardedCaseReportComplete,
  assertGuardedCaseSeedRows,
  guardedCaseFixtureDependency,
  type GuardedCaseRuntimeResult,
} from './runtime-guarded-case-fixtures'
import type { V2Plan } from './source'

const organizations = [randomUUID(), randomUUID()] as const
const ordinaryCases = [
  'OWN_SOURCE_OPERATION_ROWS_VERIFIED',
  'BIDIRECTIONAL_TENANT_READ_ISOLATION',
  'MISSING_AND_FOREIGN_CONTEXT_DENIED',
  'TITLE_ONLY_INSTITUTIONAL_POWER_DENIED',
  'FAILED_MUTATION_HISTORY_UNCHANGED',
  'ORIGINAL_HISTORY_BYTES_PRESERVED',
  'SOURCE_SYSTEM_BOUNDARY_VERIFIED',
]
// Independent oracle: a producer export cannot define its own test obligations.
const actorClasses = ['MEMBER', 'ORG_ADMIN', 'PLATFORM_ADMIN'] as const
const parties = ['ORG_A', 'ORG_B'] as const
const actorWitnesses = [
  'LIVE_SOURCE_CLASS_VERIFIED',
  'OWN_TENANT_READ_OBSERVED',
  'FOREIGN_TENANT_READ_DENIED',
  'MISSING_USER_READ_DENIED',
  'MISSING_ORG_READ_DENIED',
  'MISSING_BEARER_READ_DENIED',
  'FOREIGN_ORG_CONTEXT_READ_DENIED',
  'RAW_PROTECTED_WRITE_DENIED_42501',
  'DENIED_WRITE_HISTORY_UNCHANGED',
] as const
const actorCases = actorClasses.flatMap((actor) =>
  parties.flatMap((party) => actorWitnesses.map((witness) => `${actor}:${party}:${witness}`)),
)
function complete(): GuardedCaseRuntimeResult {
  const result: GuardedCaseRuntimeResult = { reports: [], seedRows: {} }
  for (const table of GUARDED_CASE_RUNTIME_TABLES) {
    const claimFamily = ['claims', 'claim_updates', 'claim_status_transitions'].includes(table)
    const operation = claimFamily
      ? 'OWN_SOURCE_TRANSITION_AND_AUDIT_OUTBOX_ROLLBACK_VERIFIED'
      : 'OWN_APPROVED_AMENDMENT_UPDATE_AND_ROLLBACK_VERIFIED'
    const audit =
      table === 'claims'
        ? 'MISSING_CREATE_AUDIT_ROLLS_BACK_CLAIM_AND_TRIGGERED_JOURNAL'
        : table === 'claim_updates'
          ? 'MISSING_HISTORY_AUDIT_ROLLS_BACK_OWN_ROW'
          : table === 'claim_status_transitions'
            ? 'MISSING_CREATE_AUDIT_ROLLS_BACK_TRIGGERED_ROW'
            : null
    result.reports.push({
      table,
      status: 'PASS',
      cases: [...ordinaryCases, operation, operation, ...(audit ? [audit] : []), ...actorCases].map(
        (name) => `${table}:${name}`,
      ),
    })
    const row = (party: number): Record<string, unknown> => ({
      id: randomUUID(),
      organization_id: organizations[party],
      ue_v2_ctid: `(0,${party + 1})`,
    })
    result.seedRows[table] = [row(0), row(1)]
  }
  for (const party of [0, 1]) {
    const claim = result.seedRows.claims![party],
      journal = result.seedRows.claim_status_transitions![party]
    const update = result.seedRows.claim_updates![party],
      scope = result.seedRows.case_authority_scopes![party]
    claim.claim_id = randomUUID()
    claim.status = 'under_review'
    journal.claim_id = claim.id
    journal.changed_by = randomUUID()
    journal.to_status = claim.status
    update.claim_id = claim.id
    update.transition_id = journal.id
    update.created_by = journal.changed_by
    scope.claim_id = claim.claim_id
    scope.case_id = claim.claim_id
    result.seedRows.case_scope_proposals![party].scope_id = scope.id
    result.seedRows.case_respondents![party].scope_id = scope.id
    result.seedRows.case_respondents![party].proposal_id =
      result.seedRows.case_scope_proposals![party].id
  }
  return result
}

describe('guarded fixture evidence must belong to every actual table', () => {
  it('requires coherent two-organization parent keys and each table observation', () => {
    const result = complete()
    expect(() => assertGuardedCaseSeedRows(result, organizations)).not.toThrow()
    expect(result.reports.every(guardedCaseReportComplete)).toBe(true)
  })
  it.each(GUARDED_CASE_RUNTIME_TABLES)(
    '%s requires every class, party and independent denial witness exactly once',
    (table) => {
      const report = complete().reports.find((entry) => entry.table === table)!
      for (const witness of actorCases) {
        const marker = `${table}:${witness}`
        expect(
          guardedCaseReportComplete({
            ...report,
            cases: report.cases.filter((name) => name !== marker),
          }),
          marker,
        ).toBe(false)
        expect(
          guardedCaseReportComplete({ ...report, cases: [...report.cases, marker] }),
          marker,
        ).toBe(false)
      }
      for (const actor of actorClasses)
        for (const party of parties)
          expect(
            guardedCaseReportComplete({
              ...report,
              cases: report.cases.filter((name) => !name.startsWith(`${table}:${actor}:${party}:`)),
            }),
          ).toBe(false)
    },
  )
  it.each(GUARDED_CASE_RUNTIME_TABLES)(
    '%s refuses adverse fields, unknown observations and invented title-based raw positives',
    (table) => {
      const report = complete().reports.find((entry) => entry.table === table)!
      for (const field of ['failure', 'failedProof'] as const)
        for (const value of ['ACTUAL_FAILURE', '', undefined])
          expect(guardedCaseReportComplete({ ...report, [field]: value })).toBe(false)
      for (const name of [
        'MEMBER:OWN_INSERT_A',
        'ORG_ADMIN:FIXTURE_MUTATIONS_SUCCEEDED',
        'PLATFORM_ADMIN:ORG_A:UNREVIEWED_POSITIVE',
        'UNKNOWN:ORG_B:LIVE_SOURCE_CLASS_VERIFIED',
      ])
        expect(
          guardedCaseReportComplete({ ...report, cases: [...report.cases, `${table}:${name}`] }),
        ).toBe(false)
    },
  )
  it.each(GUARDED_CASE_RUNTIME_TABLES)(
    '%s cannot reuse another table report or omit its own rollback',
    (table) => {
      const result = complete(),
        report = result.reports.find((entry) => entry.table === table)!
      expect(
        guardedCaseReportComplete({
          ...report,
          table: table === 'claims' ? 'claim_updates' : 'claims',
        }),
      ).toBe(false)
      expect(guardedCaseReportComplete({ ...report, cases: [] })).toBe(false)
      expect(guardedCaseReportComplete({ ...report, status: 'FAIL' })).toBe(false)
      expect(
        guardedCaseReportComplete({
          ...report,
          cases: report.cases.filter((name) => !name.includes('ROLLBACK_VERIFIED')),
        }),
      ).toBe(false)
      expect(
        guardedCaseReportComplete({ ...report, cases: [...report.cases, report.cases[0]] }),
      ).toBe(false)
    },
  )
  it.each(GUARDED_CASE_RUNTIME_TABLES)(
    '%s needs unique reports and two real-shaped row witnesses',
    (table) => {
      for (const mutate of [
        (result: GuardedCaseRuntimeResult) => {
          delete result.seedRows[table]
        },
        (result: GuardedCaseRuntimeResult) => {
          result.seedRows[table]![1].id = result.seedRows[table]![0].id
        },
        (result: GuardedCaseRuntimeResult) => {
          result.seedRows[table]![0].ue_v2_ctid = 'invented'
        },
        (result: GuardedCaseRuntimeResult) => {
          result.reports.push(result.reports.find((report) => report.table === table)!)
        },
      ]) {
        const result = complete()
        mutate(result)
        expect(() => assertGuardedCaseSeedRows(result, organizations)).toThrow()
      }
    },
  )
  it.each([
    ['claim_updates', 'claim_id'],
    ['claim_updates', 'transition_id'],
    ['claim_updates', 'created_by'],
    ['claim_status_transitions', 'claim_id'],
    ['claims', 'status'],
    ['case_authority_scopes', 'case_id'],
    ['case_authority_scopes', 'claim_id'],
    ['case_respondents', 'scope_id'],
    ['case_respondents', 'proposal_id'],
    ['case_scope_proposals', 'scope_id'],
  ] as const)(
    'refuses substituted %s.%s rather than seeding a contradictory parent',
    (table, column) => {
      const result = complete()
      result.seedRows[table]![0][column] = randomUUID()
      expect(() => assertGuardedCaseSeedRows(result, organizations)).toThrow()
    },
  )
  it('refuses a foreign organization witness', () => {
    const result = complete()
    result.seedRows.claim_status_transitions![0].organization_id = organizations[1]
    expect(() => assertGuardedCaseSeedRows(result, organizations)).toThrow(
      'GUARDED_CASE_ROW_ORGANIZATION_REQUIRED',
    )
  })
})

describe('guarded parent preparation precedes generic FK transactions', () => {
  const plan = JSON.parse(
    readFileSync(
      path.resolve(
        import.meta.dirname,
        '../../../../docs/union-eyes/bootstrap-v2/UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json',
      ),
      'utf8',
    ),
  ) as V2Plan
  it.each(GUARDED_CASE_RUNTIME_TABLES)('intercepts the exact %s current source table', (table) => {
    expect(guardedCaseFixtureDependency(plan, table)).toBe(true)
  })
  it('finds transitive protected parents while terminating ordinary cycles', () => {
    const base = plan.tables.find((table) => table.name === 'claims')!
    const tables = [
      {
        ...base,
        name: 'ordinary_child',
        foreignKeys: [{ column: 'parent', table: 'ordinary_parent', referencedColumn: 'id' }],
      },
      {
        ...base,
        name: 'ordinary_parent',
        foreignKeys: [{ column: 'claim', table: 'claims', referencedColumn: 'id' }],
      },
      {
        ...base,
        name: 'cycle_a',
        foreignKeys: [{ column: 'parent', table: 'cycle_b', referencedColumn: 'id' }],
      },
      {
        ...base,
        name: 'cycle_b',
        foreignKeys: [{ column: 'parent', table: 'cycle_a', referencedColumn: 'id' }],
      },
    ]
    expect(guardedCaseFixtureDependency({ tables }, 'ordinary_child')).toBe(true)
    expect(guardedCaseFixtureDependency({ tables }, 'cycle_a')).toBe(false)
    expect(guardedCaseFixtureDependency({ tables }, 'unreviewed_guarded_table')).toBe(false)
    expect(guardedCaseFixtureDependency(plan, 'organizations')).toBe(false)
  })
})
