/** Structural proof validation only. The workflows and their guards are exercised by the owned
 * native matrix (runtime-security-native.test.ts), never simulated by these objects. */
import { describe, expect, it } from 'vitest'
import {
  WORKFLOW_RAW_BYPASS_REFUSALS,
  WORKFLOW_RUNTIME_TABLES,
  databaseRefusal,
  workflowReportComplete,
} from './runtime-workflow-fixtures'
import type { ColumnTableReport } from './runtime-column-security'

// Independent oracle: a producer export cannot define its own test obligations.
const tableCases = [
  'OWN_WORKFLOW_OPERATION_ROWS_VERIFIED',
  'BIDIRECTIONAL_TENANT_READ_ISOLATION',
  'MISSING_AND_FOREIGN_CONTEXT_DENIED',
  'WORKFLOW_BYPASS_DENIED_FOR_EVERY_ACTOR_CLASS',
  'FAILED_MUTATION_HISTORY_UNCHANGED',
  'ORIGINAL_WORKFLOW_ROWS_PRESERVED',
  'SOURCE_SYSTEM_BOUNDARY_VERIFIED',
]
const actorCases = (['MEMBER', 'ORG_ADMIN', 'PLATFORM_ADMIN'] as const).flatMap((actor) =>
  (['ORG_A', 'ORG_B'] as const).flatMap((party) =>
    [
      'LIVE_SOURCE_CLASS_VERIFIED',
      'OWN_TENANT_READ_OBSERVED',
      'FOREIGN_TENANT_READ_DENIED',
      'MISSING_USER_READ_DENIED',
      'MISSING_ORG_READ_DENIED',
      'MISSING_BEARER_READ_DENIED',
      'FOREIGN_ORG_CONTEXT_READ_DENIED',
      'RAW_WORKFLOW_BYPASS_REFUSED',
      'DENIED_WRITE_HISTORY_UNCHANGED',
    ].map((witness) => `${actor}:${party}:${witness}`),
  ),
)
const complete = (table: (typeof WORKFLOW_RUNTIME_TABLES)[number]): ColumnTableReport => ({
  table,
  status: 'PASS',
  cases: [
    ...tableCases,
    `RAW_BYPASS_REFUSAL:${WORKFLOW_RAW_BYPASS_REFUSALS[table]}`,
    ...actorCases,
  ].map((name) => `${table}:${name}`),
})

describe('workflow fixture evidence must belong to every actual table', () => {
  it('names the workflow-only tables, not the counsel-verified ones that have no base workflow', () => {
    expect(WORKFLOW_RUNTIME_TABLES).toHaveLength(19)
    expect(WORKFLOW_RUNTIME_TABLES).not.toContain('ue_authority_counsel_nonces')
    expect(WORKFLOW_RUNTIME_TABLES).not.toContain('ue_authority_workaid_counsel_access')
    expect(Object.keys(WORKFLOW_RAW_BYPASS_REFUSALS).sort()).toEqual(
      [...WORKFLOW_RUNTIME_TABLES].sort(),
    )
  })
  it.each(WORKFLOW_RUNTIME_TABLES)('%s requires every witness exactly once', (table) => {
    const report = complete(table)
    expect(workflowReportComplete(report)).toBe(true)
    for (const name of report.cases) {
      expect(
        workflowReportComplete({ ...report, cases: report.cases.filter((c) => c !== name) }),
        name,
      ).toBe(false)
      expect(workflowReportComplete({ ...report, cases: [...report.cases, name] }), name).toBe(
        false,
      )
    }
  })
  it.each(WORKFLOW_RUNTIME_TABLES)(
    '%s refuses failures, foreign tables, other refusals and raw positives',
    (table) => {
      const report = complete(table)
      for (const field of ['failure', 'failedProof'] as const)
        expect(workflowReportComplete({ ...report, [field]: undefined })).toBe(false)
      expect(workflowReportComplete({ ...report, status: 'FAIL' })).toBe(false)
      expect(workflowReportComplete({ ...report, table: 'claims' })).toBe(false)
      const refusal = `${table}:RAW_BYPASS_REFUSAL:${WORKFLOW_RAW_BYPASS_REFUSALS[table]}`
      expect(
        workflowReportComplete({
          ...report,
          cases: report.cases.map((name) =>
            name === refusal ? `${table}:RAW_BYPASS_REFUSAL:42501:OTHER` : name,
          ),
        }),
      ).toBe(false)
      for (const extra of [
        'MEMBER:OWN_INSERT_ALLOWED_CONSTRAINT_VERIFIED_FOREIGN_AND_UNAUTHENTICATED_DENIED',
        'ORG_ADMIN:FIXTURE_MUTATIONS_ROLLED_BACK',
      ])
        expect(
          workflowReportComplete({ ...report, cases: [...report.cases, `${table}:${extra}`] }),
        ).toBe(false)
    },
  )
  it('reads the SQLSTATE and guard of a wrapped database refusal, never its free text', () => {
    const wrapped = (code: string, message: string) => ({
      name: 'DrizzleQueryError',
      message: 'Failed query',
      cause: { code, message },
    })
    expect(
      databaseRefusal(
        wrapped('23514', 'AUDIT_LINK_MISSING: authority event 1 has no canonical audit record'),
      ),
    ).toBe('23514:AUDIT_LINK_MISSING')
    expect(
      databaseRefusal(
        wrapped(
          '42501',
          'ue_authority_events can only be written by the authority recording trigger',
        ),
      ),
    ).toBe('42501:EVENT_RECORDING_TRIGGER_ONLY')
    expect(databaseRefusal(wrapped('42501', 'some other refusal text'))).toBe('42501:UNMARKED')
    expect(databaseRefusal(new Error('no code'))).toBe('NOCODE:UNMARKED')
  })
})
