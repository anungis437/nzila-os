/** Structural proof validation only. The workflows and their guards are exercised by the owned
 * native matrix (runtime-security-native.test.ts), never simulated by these objects. */
import { createHash, generateKeyPairSync, sign } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { COUNSEL_AUDIENCE, type CounselAssertion } from '../../lib/authority/counsel-boundary'
import {
  WORKFLOW_RAW_BYPASS_REFUSALS,
  WORKFLOW_RUNTIME_TABLES,
  databaseRefusal,
  ed25519CounselAssertionVerifier,
  workflowReportComplete,
  type WorkflowTableReport,
} from './runtime-workflow-fixtures'

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
const counselTables = ['ue_authority_counsel_nonces', 'ue_authority_workaid_counsel_access']
const counselCases = [
  'COUNSEL_SIGNATURE_FIXTURE_KEY_VERIFIED',
  'TAMPERED_ASSERTION_SIGNATURE_REFUSED',
  'NONCE_SINGLE_USE_REPLAY_REFUSED',
]
const complete = (table: (typeof WORKFLOW_RUNTIME_TABLES)[number]): WorkflowTableReport => ({
  table,
  status: 'PASS',
  cases: [
    ...tableCases,
    `RAW_BYPASS_REFUSAL:${WORKFLOW_RAW_BYPASS_REFUSALS[table]}`,
    ...(counselTables.includes(table) ? counselCases : []),
    ...actorCases,
  ].map((name) => `${table}:${name}`),
  ...(counselTables.includes(table)
    ? { counselCapability: 'NOT_PROVEN_NO_PRODUCTION_VERIFIER' as const }
    : {}),
})

describe('workflow fixture evidence must belong to every actual table', () => {
  it('names every workflow-only table, including the counsel-pipeline ones', () => {
    expect(WORKFLOW_RUNTIME_TABLES).toHaveLength(21)
    for (const table of counselTables) expect(WORKFLOW_RUNTIME_TABLES).toContain(table)
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
  it.each(counselTables)(
    '%s must record that the product counsel capability stays unproven',
    (table) => {
      const report = complete(table as (typeof WORKFLOW_RUNTIME_TABLES)[number])
      expect(workflowReportComplete(report)).toBe(true)
      const { counselCapability: _capability, ...withoutCapability } = report
      expect(workflowReportComplete(withoutCapability)).toBe(false)
      expect(
        workflowReportComplete({
          ...report,
          counselCapability: 'PROVEN' as unknown as 'NOT_PROVEN_NO_PRODUCTION_VERIFIER',
        }),
      ).toBe(false)
    },
  )
  it('refuses a counsel capability field on a non-counsel table', () => {
    expect(
      workflowReportComplete({
        ...complete('ue_authority_recusals'),
        counselCapability: 'NOT_PROVEN_NO_PRODUCTION_VERIFIER',
      }),
    ).toBe(false)
  })
  it('verifies the Ed25519 signature port genuinely: exact bytes, exact key, never a stub', async () => {
    const keys = generateKeyPairSync('ed25519')
    const assertion: CounselAssertion = {
      issuer: 'qualification-counsel-gateway',
      audience: COUNSEL_AUDIENCE,
      subject: '33333333-3333-4333-8333-333333333333',
      organizationId: '11111111-1111-4111-8111-111111111111',
      matterId: '22222222-2222-4222-8222-222222222222',
      nonce: 'qualification-nonce-0001',
      issuedAt: new Date('2026-01-01T00:00:00.000Z'),
      expiresAt: new Date('2026-01-01T00:02:00.000Z'),
    }
    const bytes = Buffer.from(
      JSON.stringify([
        assertion.issuer,
        assertion.audience,
        assertion.subject,
        assertion.organizationId,
        assertion.matterId,
        assertion.nonce,
        assertion.issuedAt.toISOString(),
        assertion.expiresAt.toISOString(),
      ]),
      'utf8',
    )
    const signature = sign(null, bytes, keys.privateKey)
    const port = ed25519CounselAssertionVerifier(keys.publicKey, signature)
    expect(await port.verifySignature(assertion)).toBe(true)
    for (const tampered of [
      { ...assertion, issuer: 'other-gateway' },
      { ...assertion, subject: '44444444-4444-4444-8444-444444444444' },
      { ...assertion, nonce: 'qualification-nonce-0002' },
      { ...assertion, matterId: '55555555-5555-4555-8555-555555555555' },
      { ...assertion, expiresAt: new Date('2026-01-01T00:02:00.001Z') },
    ])
      expect(await port.verifySignature(tampered)).toBe(false)
    const flipped = Buffer.from(signature)
    flipped[0] ^= 1
    expect(
      await ed25519CounselAssertionVerifier(keys.publicKey, flipped).verifySignature(assertion),
    ).toBe(false)
    const other = generateKeyPairSync('ed25519')
    expect(
      await ed25519CounselAssertionVerifier(other.publicKey, signature).verifySignature(assertion),
    ).toBe(false)
    expect(
      await ed25519CounselAssertionVerifier(
        keys.publicKey,
        createHash('sha256').update('x').digest(),
      ).verifySignature(assertion),
    ).toBe(false)
    expect(() => ed25519CounselAssertionVerifier(keys.privateKey, signature)).toThrow()
    expect(() =>
      ed25519CounselAssertionVerifier(generateKeyPairSync('x25519').publicKey, signature),
    ).toThrow()
  })
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
