/** Protocol/pure counterexamples only. No mock transport here is native proof,
 * no connection is opened and no permission or canonical binder is mocked. */
import pg from 'pg'
import { runtimeActorClassReportComplete } from './runtime-security'
import { describe, expect, it, vi } from 'vitest'
import type { AuthenticatedOrgBinding } from '../../../../packages/platform-auth/src/org-binding'
import {
  assertColumnActorFacts,
  assertCommittedColumnPair,
  assertLiveColumnBinding,
  COLUMN_ACTOR_CLASSES,
  qualifyRuntimeColumnSecurity,
  requireColumnPermissionDenial,
  requireColumnReadDenial,
  type ColumnActorClass,
  type ColumnActorFacts,
  type RuntimeColumnSecurityInput,
} from './runtime-column-security'

const org = '11111111-1111-4111-8111-111111111111'
const foreignOrg = '22222222-2222-4222-8222-222222222222'
const actualFacts = (actorClass: ColumnActorClass): ColumnActorFacts => ({
  user_id: 'synthetic-actor',
  organization_id: org,
  role: actorClass === 'MEMBER' ? 'member' : 'admin',
  member_active: true,
  user_active: true,
  lifecycle_state: 'active',
  is_system_admin: actorClass === 'PLATFORM_ADMIN',
})
const binding = (actorClass: ColumnActorClass = 'MEMBER'): AuthenticatedOrgBinding => ({
  userId: 'synthetic-actor',
  organizationId: org,
  role: actualFacts(actorClass).role,
  isSystemAdmin: actorClass === 'PLATFORM_ADMIN',
  sessionToken: 'synthetic-protocol-only-not-a-real-bearer',
  expiresAt: new Date(Date.now() + 600_000),
  authority: 'pg-session',
})

function unconnectedInput() {
  const queryPorts: ReturnType<typeof vi.fn>[] = []
  const client = (user: string) => {
    const value = new pg.Client({
      host: '127.0.0.1',
      port: 5432,
      database: 'ue_v2_column_protocol',
      user,
    })
    const query = vi.fn(async (text: string) => {
      if (text === 'SELECT pg_catalog.current_database() AS database')
        return {
          command: 'SELECT',
          rowCount: 1,
          fields: [],
          oid: 0,
          rows: [{ database: 'ue_v2_column_protocol' }],
        }
      if (text === 'SHOW server_version_num')
        return {
          command: 'SHOW',
          rowCount: 1,
          fields: [],
          oid: 0,
          rows: [{ server_version_num: '150014' }],
        }
      if (text.includes('FROM pg_attribute'))
        return { command: 'SELECT', rowCount: 0, fields: [], oid: 0, rows: [] }
      throw new Error('Unexpected unconnected transport operation')
    })
    Object.defineProperty(value, 'query', { value: query, configurable: true })
    queryPorts.push(query)
    return value
  }
  const neverBinding = vi.fn<() => void>()
  const withBinding = async <T>(
    _callback: (scope: AuthenticatedOrgBinding) => Promise<T>,
  ): Promise<T> => {
    neverBinding()
    throw new Error('Protocol fixture must refuse before canonical binding')
  }
  const fixture = {
    recipientUserId: 'synthetic-recipient',
    probeRecipientUserId: 'synthetic-probe-recipient',
    programId: org,
    awardTypeId: foreignOrg,
    withBinding,
  }
  const input: RuntimeColumnSecurityInput = {
    operatorClient: client('operator'),
    runtimeClient: client('runtime-login'),
    systemClient: client('system-login'),
    disposableDatabase: 'ue_v2_column_protocol',
    actors: COLUMN_ACTOR_CLASSES.map((actorClass) => ({ ...fixture, actorClass })),
    foreign: fixture,
  }
  return { input, neverBinding, queryPorts }
}

describe('column runtime matrix proof boundaries', () => {
  const deniedTransport = (
    result: 'empty' | 'row' | 'permission' | 'constraint' | 'application-code',
  ) => {
    const client = new pg.Client()
    const query = vi.fn(async () => {
      if (result === 'application-code')
        throw Object.assign(new Error('Application error is not PostgreSQL permission proof'), {
          code: '42501',
        })
      if (result === 'permission' || result === 'constraint') {
        const error = new pg.DatabaseError('Synthetic protocol-only database refusal', 0, 'error')
        error.code = result === 'permission' ? '42501' : '23514'
        throw error
      }
      return {
        command: 'SELECT',
        rowCount: result === 'row' ? 1 : 0,
        fields: [],
        oid: 0,
        rows: result === 'row' ? [{ id: 'foreign-persisted' }] : [],
      }
    })
    Object.defineProperty(client, 'query', { value: query })
    return { client, query }
  }
  it('accepts only an actual PostgreSQL permission error as broad unauthorized-operation proof', async () => {
    const { client, query } = deniedTransport('permission')
    await expect(requireColumnPermissionDenial(client, 'SYNTHETIC')).resolves.toBeUndefined()
    expect(query).toHaveBeenCalledOnce()
  })
  it.each(['empty', 'row', 'constraint', 'application-code'] as const)(
    'refuses %s as a substituted broad permission denial',
    async (outcome) => {
      await expect(
        requireColumnPermissionDenial(deniedTransport(outcome).client, 'SYNTHETIC'),
      ).rejects.toThrow()
    },
  )
  it.each(['empty', 'permission'] as const)(
    'accepts %s for a separately proven persisted foreign read denial',
    async (outcome) => {
      await expect(
        requireColumnReadDenial(deniedTransport(outcome).client, 'SYNTHETIC', []),
      ).resolves.toBeUndefined()
    },
  )
  it.each(['row', 'constraint', 'application-code'] as const)(
    'rejects %s when proving foreign or invalid-context read denial',
    async (outcome) => {
      await expect(
        requireColumnReadDenial(deniedTransport(outcome).client, 'SYNTHETIC', []),
      ).rejects.toThrow()
    },
  )
  it.each(COLUMN_ACTOR_CLASSES)(
    'accepts coherent %s facts in the pure validator, without claiming a real session',
    (actorClass) => {
      expect(() =>
        assertColumnActorFacts(actorClass, binding(actorClass), actualFacts(actorClass)),
      ).not.toThrow()
    },
  )

  it.each([
    ['inactive-user', { user_active: false }],
    ['inactive-membership', { member_active: false }],
    ['offboarded', { lifecycle_state: 'suspended' }],
    ['wrong-user', { user_id: 'foreign' }],
    ['wrong-org', { organization_id: foreignOrg }],
    ['false-admin-claim', { is_system_admin: true }],
    ['wrong-role', { role: 'admin' }],
  ] as const)('rejects %s in actual-fact comparison', (_name, override) => {
    expect(() =>
      assertColumnActorFacts('MEMBER', binding(), { ...actualFacts('MEMBER'), ...override }),
    ).toThrow()
  })

  it.each([
    ['expired', { expiresAt: new Date(0) }],
    ['invalid-time', { expiresAt: new Date('invalid') }],
    ['missing-bearer', { sessionToken: '' }],
    ['provider-only', { authority: 'verified-provider-bridge' as const }],
  ] as const)('rejects %s before claiming an opaque live session', (_name, override) => {
    expect(() => assertLiveColumnBinding({ ...binding(), ...override })).toThrow()
  })

  it('does not turn a platform flag or an org-admin role into the other actor classes', () => {
    expect(() =>
      assertColumnActorFacts('PLATFORM_ADMIN', binding('ORG_ADMIN'), actualFacts('ORG_ADMIN')),
    ).toThrow()
    expect(() =>
      assertColumnActorFacts('ORG_ADMIN', binding('PLATFORM_ADMIN'), actualFacts('PLATFORM_ADMIN')),
    ).toThrow()
    expect(() =>
      assertColumnActorFacts('MEMBER', binding('ORG_ADMIN'), actualFacts('ORG_ADMIN')),
    ).toThrow()
  })

  const own = { id: 'own-id', org, actor: 'own-issuer' }
  const foreign = { id: 'foreign-id', org: foreignOrg, actor: 'foreign-issuer' }
  const committed = [
    { id: own.id, org_id: own.org, issuer_user_id: own.actor, status: 'pending' },
    { id: foreign.id, org_id: foreign.org, issuer_user_id: foreign.actor, status: 'pending' },
  ] as const
  it('requires independently persisted own and foreign nominations before isolation can count', () => {
    expect(() => assertCommittedColumnPair(committed, own, foreign)).not.toThrow()
    expect(() => assertCommittedColumnPair([committed[0]], own, foreign)).toThrow(
      'COMMITTED_OWN_AND_FOREIGN_ROWS_REQUIRED',
    )
    expect(() => assertCommittedColumnPair([], own, foreign)).toThrow(
      'COMMITTED_OWN_AND_FOREIGN_ROWS_REQUIRED',
    )
  })
  it.each([
    ['wrong-foreign-org', { org_id: org }],
    ['forged-foreign-issuer', { issuer_user_id: own.actor }],
    ['already-issued', { status: 'issued' }],
  ] as const)('rejects %s as nonvacuous fixture evidence', (_name, change) => {
    expect(() =>
      assertCommittedColumnPair([committed[0], { ...committed[1], ...change }], own, foreign),
    ).toThrow()
  })
  it('refuses duplicate identities or duplicate supposed foreign rows', () => {
    expect(() => assertCommittedColumnPair(committed, own, { ...foreign, id: own.id })).toThrow(
      'INDEPENDENT_NOMINATION_IDS_REQUIRED',
    )
    expect(() => assertCommittedColumnPair(committed, own, { ...foreign, org })).toThrow(
      'INDEPENDENT_ORGANIZATIONS_REQUIRED',
    )
    expect(() => assertCommittedColumnPair([...committed, committed[1]], own, foreign)).toThrow(
      'COMMITTED_OWN_AND_FOREIGN_ROWS_REQUIRED',
    )
  })

  it.each([
    'duplicate-class',
    'missing-class',
    'unowned-name',
    'shared-principal',
    'remote-server',
    'different-port',
    'missing-source-columns',
  ] as const)(
    'refuses %s without issuing fake passed actor or rollback markers',
    async (mutation) => {
      const { input, neverBinding, queryPorts } = unconnectedInput()
      if (mutation === 'duplicate-class')
        input.actors = [input.actors[0], input.actors[0], input.actors[2]]
      if (mutation === 'missing-class') input.actors = input.actors.slice(1)
      if (mutation === 'unowned-name') input.disposableDatabase = 'production'
      if (mutation === 'shared-principal') input.systemClient = input.runtimeClient
      if (mutation === 'remote-server') input.runtimeClient.host = 'external.example.invalid'
      if (mutation === 'different-port') input.systemClient.port = 5433
      const report = await qualifyRuntimeColumnSecurity(input)
      expect(report.status).toBe('FAIL')
      expect(report.qualified).toBe(0)
      expect(report.reports).toHaveLength(3)
      expect(report.reports.every((row) => row.status === 'FAIL')).toBe(true)
      const expectedBoundary =
        mutation === 'duplicate-class' || mutation === 'missing-class'
          ? 'EXACT_ACTOR_CLASSES'
          : mutation === 'unowned-name'
            ? 'OWNED_DISPOSABLE_NAME'
            : mutation === 'shared-principal'
              ? 'DISTINCT_CLIENTS'
              : mutation === 'remote-server' || mutation === 'different-port'
                ? 'SAME_OWNED_SERVER'
                : 'SOURCE_PHYSICAL_COLUMNS'
      expect(report.reports.every((row) => row.failedProof === expectedBoundary)).toBe(true)
      if (
        ['duplicate-class', 'missing-class', 'unowned-name', 'shared-principal'].includes(mutation)
      )
        expect(queryPorts.flatMap((query) => query.mock.calls)).toEqual([])
      expect(report.nativeActorClassQualification.result).toBe('NOT_PROVEN')
      expect(report.rollbackProofs).toEqual([])
      expect(report.committedSyntheticNominationIds).toEqual([])
      expect(JSON.stringify(report)).not.toContain('FIXTURE_MUTATIONS_ROLLED_BACK')
      expect(neverBinding).not.toHaveBeenCalled()
      expect(
        queryPorts
          .flatMap((query) => query.mock.calls)
          .some((call) => String(call[0]).includes('INSERT INTO')),
      ).toBe(false)
    },
  )

  it('never reports database error messages or token-bearing text as failure evidence', async () => {
    const { input } = unconnectedInput()
    Object.defineProperty(input.operatorClient, 'query', {
      value: vi.fn(async () => {
        throw Object.assign(new Error('raw private bearer must not enter output'), {
          code: '42501',
        })
      }),
    })
    const result = await qualifyRuntimeColumnSecurity(input)
    expect(
      result.reports.every((report) => report.failure === 'COLUMN_PROOF_DATABASE_FAILURE_42501'),
    ).toBe(true)
    expect(JSON.stringify(result)).not.toContain('raw private bearer')
  })

  it('does not treat a PGlite/other-major transport response as native PG15/16 qualification', async () => {
    const { input, neverBinding } = unconnectedInput()
    Object.defineProperty(input.operatorClient, 'query', {
      value: vi.fn(async (text: string) => ({
        command: 'SELECT',
        rowCount: 1,
        fields: [],
        oid: 0,
        rows:
          text === 'SHOW server_version_num'
            ? [{ server_version_num: '180003' }]
            : [{ database: input.disposableDatabase }],
      })),
    })
    const result = await qualifyRuntimeColumnSecurity(input)
    expect(result.status).toBe('FAIL')
    expect(
      result.reports.every((report) => report.failedProof === 'SUPPORTED_NATIVE_POSTGRES'),
    ).toBe(true)
    expect(result.nativeActorClassQualification.result).toBe('NOT_PROVEN')
    expect(neverBinding).not.toHaveBeenCalled()
  })
})

describe('source-specific native summary dispatch (pure receipt counterexamples)', () => {
  it.each([
    'claims',
    'claim_updates',
    'claim_status_transitions',
    'case_authority_scopes',
    'case_respondents',
    'case_scope_proposals',
  ])('%s cannot qualify from fictitious generic raw-write rollback markers', (table) => {
    const cases = COLUMN_ACTOR_CLASSES.flatMap((actor) => [
      `${actor}:FIXTURE_MUTATIONS_ROLLED_BACK`,
      `${actor}:OWN_INSERT_ALLOWED_CONSTRAINT_VERIFIED_FOREIGN_AND_UNAUTHENTICATED_DENIED`,
    ])
    expect(
      runtimeActorClassReportComplete(
        { table, runtimePrivileges: ['SELECT', 'INSERT', 'UPDATE'] },
        { table, status: 'PASS', cases },
      ),
    ).toBe(false)
  })
  it('preserves the existing ordinary generic class denominator and does not borrow another table report', () => {
    const table = 'ordinary_fixture'
    const cases = COLUMN_ACTOR_CLASSES.map((actor) => `${actor}:FIXTURE_MUTATIONS_ROLLED_BACK`)
    expect(
      runtimeActorClassReportComplete(
        { table, runtimePrivileges: ['INSERT'] },
        { table, status: 'PASS', cases },
      ),
    ).toBe(true)
    expect(
      runtimeActorClassReportComplete(
        { table, runtimePrivileges: ['INSERT'] },
        { table, status: 'PASS', cases: cases.filter((name) => !name.startsWith('ORG_ADMIN:')) },
      ),
    ).toBe(false)
    expect(
      runtimeActorClassReportComplete(
        { table, runtimePrivileges: ['INSERT'] },
        { table: 'other', status: 'PASS', cases },
      ),
    ).toBe(false)
  })
})

/** Independent expected shape for the guarded native-summary consumer only;
 * synthetic strings do not prove that any workflow or identity was executed. */
const guardedTables = [
  'claims',
  'claim_updates',
  'claim_status_transitions',
  'case_authority_scopes',
  'case_respondents',
  'case_scope_proposals',
] as const
function observedGuardedShape(table: string) {
  const cases = [
    'OWN_SOURCE_OPERATION_ROWS_VERIFIED',
    'BIDIRECTIONAL_TENANT_READ_ISOLATION',
    'MISSING_AND_FOREIGN_CONTEXT_DENIED',
    'TITLE_ONLY_INSTITUTIONAL_POWER_DENIED',
    'FAILED_MUTATION_HISTORY_UNCHANGED',
    'ORIGINAL_HISTORY_BYTES_PRESERVED',
    'SOURCE_SYSTEM_BOUNDARY_VERIFIED',
  ].map((witness) => `${table}:${witness}`)
  const rollback = ['claims', 'claim_updates', 'claim_status_transitions'].includes(table)
    ? 'OWN_SOURCE_TRANSITION_AND_AUDIT_OUTBOX_ROLLBACK_VERIFIED'
    : 'OWN_APPROVED_AMENDMENT_UPDATE_AND_ROLLBACK_VERIFIED'
  cases.push(`${table}:${rollback}`, `${table}:${rollback}`)
  const audit =
    table === 'claims'
      ? 'MISSING_CREATE_AUDIT_ROLLS_BACK_CLAIM_AND_TRIGGERED_JOURNAL'
      : table === 'claim_updates'
        ? 'MISSING_HISTORY_AUDIT_ROLLS_BACK_OWN_ROW'
        : table === 'claim_status_transitions'
          ? 'MISSING_CREATE_AUDIT_ROLLS_BACK_TRIGGERED_ROW'
          : null
  if (audit) cases.push(`${table}:${audit}`)
  for (const actor of ['MEMBER', 'ORG_ADMIN', 'PLATFORM_ADMIN'])
    for (const party of ['ORG_A', 'ORG_B'])
      for (const witness of [
        'LIVE_SOURCE_CLASS_VERIFIED',
        'OWN_TENANT_READ_OBSERVED',
        'FOREIGN_TENANT_READ_DENIED',
        'MISSING_USER_READ_DENIED',
        'MISSING_ORG_READ_DENIED',
        'MISSING_BEARER_READ_DENIED',
        'FOREIGN_ORG_CONTEXT_READ_DENIED',
        'RAW_PROTECTED_WRITE_DENIED_42501',
        'DENIED_WRITE_HISTORY_UNCHANGED',
      ])
        cases.push(`${table}:${actor}:${party}:${witness}`)
  return { table, status: 'PASS' as const, cases }
}
describe('guarded native summary needs all real proof families (pure only)', () => {
  it.each(guardedTables)(
    '%s accepts complete workflow and per-class evidence without invented raw successes',
    (table) => {
      expect(
        runtimeActorClassReportComplete(
          { table, runtimePrivileges: ['SELECT', 'INSERT', 'UPDATE'] },
          observedGuardedShape(table),
        ),
      ).toBe(true)
    },
  )
  it.each(
    guardedTables.flatMap((table) =>
      ['MEMBER', 'ORG_ADMIN', 'PLATFORM_ADMIN'].flatMap((actor) =>
        ['ORG_A', 'ORG_B'].map((party) => ({ table, actor, party })),
      ),
    ),
  )(
    '$table cannot omit $actor in $party even with every workflow positive',
    ({ table, actor, party }) => {
      const report = observedGuardedShape(table)
      report.cases = report.cases.filter((name) => !name.startsWith(`${table}:${actor}:${party}:`))
      expect(
        runtimeActorClassReportComplete(
          { table, runtimePrivileges: ['SELECT', 'INSERT', 'UPDATE'] },
          report,
        ),
      ).toBe(false)
    },
  )
  it.each(guardedTables)(
    '%s cannot qualify only read/deny evidence without its genuine workflow rollback',
    (table) => {
      const report = observedGuardedShape(table)
      report.cases = report.cases.filter((name) => !name.endsWith('ROLLBACK_VERIFIED'))
      expect(
        runtimeActorClassReportComplete(
          { table, runtimePrivileges: ['SELECT', 'INSERT', 'UPDATE'] },
          report,
        ),
      ).toBe(false)
    },
  )
  it.each(['claims', 'claim_updates', 'claim_status_transitions'])(
    '%s still requires its missing-audit rollback control',
    (table) => {
      const report = observedGuardedShape(table)
      report.cases = report.cases.filter(
        (name) => !name.includes(':MISSING_') || !name.includes('AUDIT'),
      )
      expect(
        runtimeActorClassReportComplete(
          { table, runtimePrivileges: ['SELECT', 'INSERT', 'UPDATE'] },
          report,
        ),
      ).toBe(false)
    },
  )
  it.each(guardedTables)(
    '%s rejects recorded failure or copied table evidence despite PASS status',
    (table) => {
      const report = observedGuardedShape(table),
        rule = { table, runtimePrivileges: ['SELECT'] }
      expect(
        runtimeActorClassReportComplete(rule, { ...report, failure: 'Actual prior failure' }),
      ).toBe(false)
      expect(
        runtimeActorClassReportComplete(rule, { ...report, failedProof: 'Unfinished actor' }),
      ).toBe(false)
      expect(
        runtimeActorClassReportComplete(rule, {
          ...report,
          cases: report.cases.map((name) => name.replace(`${table}:`, 'foreign_table:')),
        }),
      ).toBe(false)
    },
  )
})
