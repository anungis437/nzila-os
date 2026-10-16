import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import {
  buildPlan,
  executePlan,
  extensionDisposition,
  quoteIdentifier,
  rejectSecretFields,
  roleDisposition,
  safeFailure,
  specifications,
  validateBindings,
  verifySnapshot,
  membershipVerificationModel,
  type BindingPacket,
  type BootstrapContract,
  type ProvisioningPlan,
  type RoleDescriptor,
  type Snapshot,
  type TargetContract,
} from './governed-provisioning'
import { main } from '../provision-runtime-db-roles'

const artifactFolder = new URL('../../../../docs/union-eyes/reality-remediation/', import.meta.url)
const canonical: BootstrapContract = JSON.parse(
  readFileSync(
    new URL('UE_CANONICAL_RUNTIME_SCHEMA_BOOTSTRAP_CONTRACT.json', artifactFolder),
    'utf8',
  ),
)
const target: TargetContract = JSON.parse(
  readFileSync(
    new URL('UE_DATABASE_TARGET_SCHEMA_SEARCH_PATH_CONTRACT.json', artifactFolder),
    'utf8',
  ),
)

export function fixtureBindings(): BindingPacket {
  return {
    targets: (['UE_OPERATIONAL', 'FINANCIAL_SERVICE'] as const).map((scope) => {
      const actor = target.databaseActors.find(
        (a) =>
          a.ACTOR_PURPOSE ===
          (scope === 'UE_OPERATIONAL' ? 'PROVISIONING' : 'FINANCIAL_PROVISIONING'),
      )
      if (!actor) throw new Error('Fixture actor missing')
      return {
        TARGET_ID: actor.TARGET_ID,
        DATABASE_SCOPE_ID: scope,
        DATABASE_ACTOR_ID: actor.DATABASE_ACTOR_ID,
        ROLE_CLASS: actor.ROLE_CLASS,
        SEARCH_PATH_CONTRACT_ID: actor.SEARCH_PATH_CONTRACT_ID,
        HOST_BINDING: actor.HOST_BINDING,
        PORT_BINDING: actor.PORT_BINDING,
        DATABASE_NAME_BINDING: actor.DATABASE_NAME_BINDING,
        ENVIRONMENT_ID: 'offline_fixture',
        HOST: 'offline.example.invalid',
        PORT: 5432,
        DATABASE_NAME: scope === 'UE_OPERATIONAL' ? 'fixture_operational' : 'fixture_financial',
        SEARCH_PATH: ['pg_catalog'],
      }
    }),
    principals: {
      MIGRATION_ADMIN: 'fixture_migration',
      APPLICATION_RUNTIME: 'union_eyes_runtime',
      SYSTEM_OR_INTERNAL_RUNTIME: 'union_eyes_system',
      FINANCIAL_MIGRATION: 'fixture_financial_migration',
      FINANCIAL_RUNTIME: 'fixture_financial_runtime',
    },
    executorPrincipal: 'fixture_operator',
    loginPrincipals: {
      MIGRATION_ADMIN: 'fixture_migration_login',
      APPLICATION_RUNTIME: 'fixture_application_login',
      SYSTEM_OR_INTERNAL_RUNTIME: 'fixture_system_login',
      FINANCIAL_MIGRATION: 'fixture_financial_migration_login',
      FINANCIAL_RUNTIME: 'fixture_financial_runtime_login',
    },
  }
}
function role(name: string): RoleDescriptor {
  return {
    name,
    login: false,
    superuser: false,
    bypassRls: false,
    createDb: false,
    createRole: false,
    replication: false,
    inherit: false,
    memberships: [],
    memberRoles: [],
    ownedObjects: [],
  }
}
function matching(plan: ProvisioningPlan): Snapshot {
  const bindings = plan.DELEGATION_BINDINGS.filter(
    (b) => b.DATABASE_SCOPE_ID === plan.DATABASE_SCOPE_ID,
  )
  const result: Snapshot = {
    target: plan.TARGET,
    currentUser: plan.EXECUTOR_PRINCIPAL,
    currentRole: plan.EXECUTOR_PRINCIPAL,
    temporaryNamespacePresent: false,
    roles: [
      ...plan.ROLE_SPECS.map((r) => role(plan.PRINCIPALS[r.ROLE_CLASS]!)),
      ...bindings.map((b) => ({ ...role(b.LOGIN_PRINCIPAL), login: true })),
    ],
    membershipEdges: bindings.map((b) => ({
      grantedRole: b.AUTHORIZATION_ROLE,
      memberRole: b.LOGIN_PRINCIPAL,
      adminOption: false,
      setOption: true,
    })),
    extensions: plan.EXTENSION_SPECS.map((e) => ({
      name: e.EXTENSION,
      available: true,
      platformVersion: 'fixture-version',
      supportsPublicPlacement: true,
      installed: { schema: 'public', version: 'fixture-version' },
    })),
    privileges: plan.ROLE_SPECS.map((r) => ({
      principal: plan.PRINCIPALS[r.ROLE_CLASS]!,
      connect: true,
      temp: false,
      databaseCreate: false,
      schemaUsage: true,
      schemaCreate: r.SCHEMA_CREATE_EXPECTATION === 'public CREATE',
      grantOptions: false,
      ownsDatabase: false,
      ownsPublicSchema: false,
    })),
    publicPrivileges: {
      connect: false,
      temp: false,
      databaseCreate: false,
      schemaUsage: false,
      schemaCreate: false,
      functionExecuteDefaults: false,
    },
    defaultPrivileges: plan.ROLE_SPECS.filter(
      (r) => r.SCHEMA_CREATE_EXPECTATION === 'public CREATE',
    ).map((r) => ({
      creator: plan.PRINCIPALS[r.ROLE_CLASS]!,
      publicFunctionExecute: false,
      unauthorizedRecipients: [],
    })),
  }
  projectMemberships(result)
  return result
}
function projectMemberships(snapshot: Snapshot) {
  for (const role of snapshot.roles) {
    role.memberships = snapshot.membershipEdges
      .filter((e) => e.memberRole === role.name)
      .map((e) => e.grantedRole)
    role.memberRoles = snapshot.membershipEdges
      .filter((e) => e.grantedRole === role.name)
      .map((e) => e.memberRole)
  }
}
const boundPlan = () => buildPlan('UE_OPERATIONAL', fixtureBindings(), canonical, target)
function executionFixture() {
  const approved = structuredClone(canonical)
  for (const decision of approved.governanceDecisionObligations) {
    if (
      ['UE-1B3CA1G-DECISION-4e0fdb9b7d80bdb5', 'UE-1B3CA1G-DECISION-7e108c57ea428e21'].includes(
        decision.DECISION_ID,
      )
    )
      decision.STATUS = 'APPROVED_AND_IMPLEMENTED_IN_W3_CONTRACT'
  }
  return buildPlan('UE_OPERATIONAL', fixtureBindings(), approved, target)
}

describe('governed provisioning: offline only', () => {
  it('preserves exact five classes/four mandatory extensions and governed decision boundaries', () => {
    const specs = specifications(canonical, target)
    expect(specs.roles).toHaveLength(5)
    expect(specs.extensions.map((e) => e.EXTENSION)).toEqual([
      'uuid-ossp',
      'pgcrypto',
      'pg_trgm',
      'btree_gin',
    ])
    expect(specs.VECTOR_EXTENSION_DISPOSITION).toBe(
      specs.blockers.includes('UE-1B3CA1G-DECISION-7e108c57ea428e21')
        ? 'GOVERNANCE_DECISION_REQUIRED'
        : 'OPTIONAL_GUARDED_NOT_BASELINE_REQUIRED',
    )
    expect(
      specs.roles.every((r) => r.TEMP_EXPECTATION === 'DENIED' && r.BYPASSRLS_EXPECTATION === 'NO'),
    ).toBe(true)
  })
  it('produces deterministic plans and independently scoped financial plan with no ungoverned extensions', () => {
    expect(boundPlan()).toEqual(boundPlan())
    const financial = buildPlan('FINANCIAL_SERVICE', fixtureBindings(), canonical, target)
    expect(financial.ROLE_SPECS.map((r) => r.ROLE_CLASS)).toEqual([
      'FINANCIAL_MIGRATION',
      'FINANCIAL_RUNTIME',
    ])
    expect(financial.EXTENSION_SPECS).toEqual([])
    expect(
      financial.OPERATIONS.every(
        (o) =>
          !o.SQL.includes('ALL PRIVILEGES') &&
          !o.SQL.includes('PASSWORD') &&
          !o.SQL.includes('ALTER ROLE'),
      ),
    ).toBe(true)
    expect(financial.VERIFY_SQL.every((o) => /^\s*SELECT /.test(o.SQL))).toBe(true)
  })
  const invalidBindings: [string, (packet: BindingPacket) => void][] = [
    [
      'missing target',
      (p) => {
        p.targets.pop()
      },
    ],
    [
      'wrong scope',
      (p) => {
        p.targets[0].DATABASE_SCOPE_ID = 'FINANCIAL_SERVICE'
      },
    ],
    [
      'wrong target',
      (p) => {
        p.targets[0].TARGET_ID = 'wrong'
      },
    ],
    [
      'wrong actor',
      (p) => {
        p.targets[0].DATABASE_ACTOR_ID = 'UE-W2-ACTOR-DJANGO_MIGRATION'
      },
    ],
    [
      'wrong role class',
      (p) => {
        p.targets[0].ROLE_CLASS = 'APPLICATION_RUNTIME'
      },
    ],
    [
      'ambient database',
      (p) => {
        p.targets[0].DATABASE_NAME = ''
      },
    ],
    [
      'ambient host',
      (p) => {
        p.targets[0].HOST = ''
      },
    ],
    [
      'malformed host',
      (p) => {
        p.targets[0].HOST = '.'
      },
    ],
    [
      'ambient port',
      (p) => {
        p.targets[0].PORT = 0
      },
    ],
    [
      'wrong path',
      (p) => {
        p.targets[0].SEARCH_PATH = ['public', 'pg_catalog']
      },
    ],
    [
      'wrong path identity',
      (p) => {
        p.targets[0].SEARCH_PATH_CONTRACT_ID = 'wrong'
      },
    ],
    [
      'wrong host binding',
      (p) => {
        p.targets[0].HOST_BINDING = 'PGHOST'
      },
    ],
    [
      'cross-scope target',
      (p) => {
        p.targets[1].DATABASE_NAME = p.targets[0].DATABASE_NAME
      },
    ],
    [
      'cross-environment',
      (p) => {
        p.targets[1].ENVIRONMENT_ID = 'other'
      },
    ],
    [
      'principal missing',
      (p) => {
        p.principals.MIGRATION_ADMIN = ''
      },
    ],
    [
      'principal injection',
      (p) => {
        p.principals.MIGRATION_ADMIN = 'x"; SELECT 1;--'
      },
    ],
    [
      'frozen principal mismatch',
      (p) => {
        p.principals.APPLICATION_RUNTIME = 'fictional_runtime'
      },
    ],
    [
      'cross-role membership alias',
      (p) => {
        p.principals.FINANCIAL_RUNTIME = p.principals.MIGRATION_ADMIN
      },
    ],
    [
      'operator equals runtime',
      (p) => {
        p.executorPrincipal = p.principals.APPLICATION_RUNTIME
      },
    ],
  ]
  it.each(invalidBindings)('rejects %s before SQL', (_label, mutate) => {
    const p = fixtureBindings()
    mutate(p)
    expect(() => validateBindings(p, target, specifications(canonical, target).roles)).toThrow()
  })
  it.each(['bad name', 'x;DROP ROLE y', 'pg_fake', 'public', 'x'.repeat(64), 'x\u0000y'])(
    'rejects unsafe identifier %s',
    (name) => expect(() => quoteIdentifier(name)).toThrow(),
  )
  it('quotes the hyphenated extension identifier and never includes secrets in failures', () => {
    expect(quoteIdentifier('uuid-ossp')).toBe('"uuid-ossp"')
    expect(safeFailure(new Error('postgres://user:fixture-secret@host/database'))).not.toContain(
      'fixture-secret',
    )
    expect(() => rejectSecretFields({ password: 'synthetic-not-a-secret' })).toThrow()
    expect(() =>
      rejectSecretFields({ databaseUrl: 'postgres://fixture:dummy@invalid/db' }),
    ).toThrow()
    expect(() => rejectSecretFields({ note: 'postgresql://fixture:dummy@invalid/db' })).toThrow()
    expect(() => rejectSecretFields({ token: 'synthetic' })).toThrow()
    expect(() => rejectSecretFields(fixtureBindings())).not.toThrow()
  })
  it('rejects conflicting URL/PG overrides even when nominal targets are present', () => {
    const p = { ...fixtureBindings(), PGHOST: 'wrong_host' }
    expect(() => validateBindings(p, target, specifications(canonical, target).roles)).toThrow(
      'UNEXPECTED_BINDING_FIELDS',
    )
    const targetOverride = { ...fixtureBindings().targets[0], PGDATABASE: 'wrong_db' }
    const conflicting = fixtureBindings()
    conflicting.targets[0] = targetOverride
    expect(() =>
      validateBindings(conflicting, target, specifications(canonical, target).roles),
    ).toThrow('CONFLICTING_OR_UNEXPECTED_TARGET')
  })
  it('makes no-argument/implicit apply fail explicitly and plan imports no DB client', () => {
    expect(() => main([])).toThrow('EXPLICIT_PLAN_OR_VERIFY_MODE_REQUIRED')
    expect(() => main(['--apply'])).toThrow('APPLY_REQUIRES_APPROVED_GOVERNANCE')
    expect(() => main(['--verify'])).toThrow('EXPLICIT_BINDINGS_AND_SCOPE_REQUIRED')
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    try {
      main(['--plan'])
      expect(JSON.parse(log.mock.calls[0][0]).MODE).toBe('UNBOUND_OFFLINE_PLAN')
    } finally {
      log.mockRestore()
    }
  })
  it('accepts absent/matching roles but rejects drift rather than changing attributes', () => {
    expect(roleDisposition(undefined, 'fixture_role')).toBe('CREATE')
    expect(roleDisposition(role('fixture_role'), 'fixture_role')).toBe('ACCEPT')
    for (const key of [
      'login',
      'superuser',
      'bypassRls',
      'createDb',
      'createRole',
      'replication',
      'inherit',
    ] as const) {
      const drift = role('fixture_role')
      drift[key] = true
      expect(() => roleDisposition(drift, 'fixture_role')).toThrow()
    }
    const plan = boundPlan()
    const snapshot = matching(plan)
    snapshot.membershipEdges.push({
      grantedRole: 'admin',
      memberRole: snapshot.roles[0].name,
      adminOption: false,
      setOption: true,
    })
    projectMemberships(snapshot)
    expect(() => verifySnapshot(plan, snapshot)).toThrow('UNEXPECTED_NESTED_MEMBERSHIP')
  })
  it('distinguishes absent/available, unavailable, installed matching and schema/version drift extensions', () => {
    const extension = {
      name: 'pgcrypto',
      available: true,
      platformVersion: 'fixture',
      supportsPublicPlacement: true,
      installed: null,
    }
    expect(extensionDisposition(extension)).toBe('INSTALL')
    expect(() => extensionDisposition(undefined)).toThrow()
    expect(() => extensionDisposition({ ...extension, available: false })).toThrow()
    expect(() => extensionDisposition({ ...extension, supportsPublicPlacement: false })).toThrow()
    expect(
      extensionDisposition({ ...extension, installed: { schema: 'public', version: 'fixture' } }),
    ).toBe('ACCEPT')
    expect(() =>
      extensionDisposition({ ...extension, installed: { schema: 'wrong', version: 'fixture' } }),
    ).toThrow()
    expect(() =>
      extensionDisposition({ ...extension, installed: { schema: 'public', version: 'different' } }),
    ).toThrow()
  })
  it('verifies full privileges and rejects PUBLIC/TEMP/CREATE/ownership/default ACL drift', () => {
    const p = boundPlan()
    expect(() => verifySnapshot(p, matching(p))).not.toThrow()
    const changes: ((s: Snapshot) => void)[] = [
      (s) => {
        s.publicPrivileges.temp = true
      },
      (s) => {
        s.publicPrivileges.connect = true
      },
      (s) => {
        s.publicPrivileges.schemaCreate = true
      },
      (s) => {
        s.publicPrivileges.functionExecuteDefaults = true
      },
      (s) => {
        s.privileges[1].temp = true
      },
      (s) => {
        s.privileges[1].schemaCreate = true
      },
      (s) => {
        s.privileges[1].grantOptions = true
      },
      (s) => {
        s.privileges[1].ownsPublicSchema = true
      },
      (s) => {
        s.roles[1].ownedObjects = ['protected_table']
      },
      (s) => {
        s.defaultPrivileges[0].publicFunctionExecute = true
      },
      (s) => {
        s.defaultPrivileges[0].unauthorizedRecipients = ['other']
      },
      (s) => {
        s.temporaryNamespacePresent = true
      },
      (s) => {
        s.currentRole = 'wrong'
      },
      (s) => {
        s.target = { ...s.target, DATABASE_NAME: 'wrong' }
      },
      (s) => {
        s.extensions[0].installed = null
      },
      (s) => {
        s.roles.pop()
      },
    ]
    for (const change of changes) {
      const snapshot = matching(p)
      change(snapshot)
      expect(() => verifySnapshot(p, snapshot)).toThrow()
    }
  })
  it('fails closed on incomplete or duplicate catalog descriptors', () => {
    const p = boundPlan()
    const snapshot = matching(p)
    Reflect.deleteProperty(snapshot.publicPrivileges, 'temp')
    expect(() => verifySnapshot(p, snapshot)).toThrow('INCOMPLETE_PRIVILEGE_DESCRIPTOR')
    const attrs = matching(p)
    Reflect.deleteProperty(attrs.roles[0], 'superuser')
    expect(() => verifySnapshot(p, attrs)).toThrow('INCOMPLETE_ROLE_DESCRIPTOR')
    const dup = matching(p)
    dup.roles.push(dup.roles[0])
    expect(() => verifySnapshot(p, dup)).toThrow('DUPLICATE_ROLE_DESCRIPTOR')
  })
  it('blocks unresolved governance before even invoking the injected adapter', async () => {
    const pending = structuredClone(canonical)
    for (const decision of pending.governanceDecisionObligations)
      decision.STATUS = 'HUMAN_DECISION_REQUIRED'
    const transaction = vi.fn()
    await expect(
      executePlan(
        buildPlan('UE_OPERATIONAL', fixtureBindings(), pending, target),
        { transaction },
        'apply',
      ),
    ).rejects.toThrow('GOVERNANCE_DECISIONS_PENDING')
    expect(transaction).not.toHaveBeenCalled()
  })
  it('future verify is read-only and matching existing principals/extensions skip CREATE', async () => {
    const p = executionFixture()
    const execute = vi.fn()
    const snapshot = vi.fn(async () => matching(p))
    const adapter = {
      transaction: async <T>(
        work: (c: { snapshot: typeof snapshot; execute: typeof execute }) => Promise<T>,
      ) => work({ snapshot, execute }),
    }
    await executePlan(p, adapter, 'verify')
    expect(execute).not.toHaveBeenCalled()
    await executePlan(p, adapter, 'apply')
    expect(execute.mock.calls.every(([sql]) => !String(sql).startsWith('CREATE '))).toBe(true)
    expect(
      execute.mock.calls.every(
        ([sql]) =>
          !p.OPERATIONS.some((o) => o.KIND === 'GRANT_MEMBERSHIP_IF_ABSENT' && o.SQL === sql),
      ),
    ).toBe(true)
  })
  it('rejects role or extension drift before any mutation and propagates installation failure', async () => {
    const p = executionFixture()
    const before = matching(p)
    before.roles[0].superuser = true
    const execute = vi.fn()
    const adapter = {
      transaction: async <T>(
        work: (c: { snapshot: () => Promise<Snapshot>; execute: typeof execute }) => Promise<T>,
      ) => work({ snapshot: async () => before, execute }),
    }
    await expect(executePlan(p, adapter, 'apply')).rejects.toThrow()
    expect(execute).not.toHaveBeenCalled()
    before.roles[0].superuser = false
    before.extensions[0].installed = null
    execute.mockRejectedValue(new Error('synthetic installation failure'))
    await expect(executePlan(p, adapter, 'apply')).rejects.toThrow('synthetic installation failure')
    expect(execute).toHaveBeenCalledTimes(1)
  })
  it('accepts exactly the directed login edge without admin option and emits its exact GRANT', () => {
    const plan = boundPlan()
    const model = membershipVerificationModel(plan, matching(plan))
    expect(
      model
        .filter((b) => b.DATABASE_SCOPE_ID === plan.DATABASE_SCOPE_ID)
        .every(
          (b) =>
            b.STATES.join(',') === 'EXPECTED_MEMBERSHIP_PRESENT' &&
            b.EXPECTED_LOGIN_IS_MEMBER === 'YES' &&
            b.ADMIN_OPTION === 'NO' &&
            !b.EXTRA_MEMBERS.length &&
            !b.REVERSE_OR_NESTED_EDGES.length &&
            !b.CROSS_SCOPE_EDGES.length,
        ),
    ).toBe(true)
    for (const op of plan.OPERATIONS.filter((o) => o.KIND === 'GRANT_MEMBERSHIP_IF_ABSENT')) {
      const b = plan.DELEGATION_BINDINGS.find((b) => b.ROLE_CLASS === op.ROLE_CLASS)!
      expect(op.SQL).toBe(`GRANT "${b.AUTHORIZATION_ROLE}" TO "${b.LOGIN_PRINCIPAL}";`)
      expect(op.SQL).not.toMatch(/PASSWORD|ADMIN OPTION|CASCADE/)
    }
    expect(plan.ROLE_SPECS.every((r) => r.LOGIN_EXPECTATION === 'NOLOGIN')).toBe(true)
  })
  const delegationDrifts: [string, (s: Snapshot, p: ProvisioningPlan) => void, string][] = [
    [
      'missing expected',
      (s) => {
        s.membershipEdges.shift()
      },
      'EXPECTED_MEMBERSHIP_MISSING',
    ],
    [
      'extra login',
      (s) => {
        s.membershipEdges.push({ ...s.membershipEdges[0], memberRole: 'unrelated_login' })
      },
      'UNEXPECTED_EXTRA_MEMBER',
    ],
    [
      'reverse',
      (s) => {
        const e = s.membershipEdges[0]
        s.membershipEdges.push({ ...e, grantedRole: e.memberRole, memberRole: e.grantedRole })
      },
      'UNEXPECTED_REVERSE_MEMBERSHIP',
    ],
    [
      'nested authorization',
      (s) => {
        s.membershipEdges.push({
          ...s.membershipEdges[0],
          memberRole: s.membershipEdges[1].grantedRole,
        })
      },
      'UNEXPECTED_NESTED_MEMBERSHIP',
    ],
    [
      'cross scope',
      (s, p) => {
        const b = p.DELEGATION_BINDINGS.find((b) => b.DATABASE_SCOPE_ID !== p.DATABASE_SCOPE_ID)!
        s.membershipEdges.push({ ...s.membershipEdges[0], memberRole: b.LOGIN_PRINCIPAL })
      },
      'UNEXPECTED_CROSS_SCOPE_MEMBERSHIP',
    ],
    [
      'runtime to migration',
      (s) => {
        s.membershipEdges.push({
          ...s.membershipEdges[0],
          memberRole: s.membershipEdges[1].memberRole,
        })
      },
      'UNEXPECTED_RUNTIME_TO_MIGRATION_MEMBERSHIP',
    ],
    [
      'admin option',
      (s) => {
        s.membershipEdges[0].adminOption = true
      },
      'ADMIN_OPTION_DRIFT',
    ],
    [
      'cannot SET ROLE',
      (s) => {
        s.membershipEdges[0].setOption = false
      },
      'SET_OPTION_DRIFT',
    ],
    [
      'login unrelated membership',
      (s) => {
        s.membershipEdges.push({ ...s.membershipEdges[0], grantedRole: 'unrelated_role' })
      },
      'UNEXPECTED_EXTRA_MEMBER',
    ],
    [
      'duplicate edge',
      (s) => {
        s.membershipEdges.push(s.membershipEdges[0])
      },
      'DUPLICATE_MEMBERSHIP_EDGE',
    ],
  ]
  it.each(delegationDrifts)(
    'rejects delegation %s without hiding graph edges',
    (_name, mutate, code) => {
      const plan = boundPlan()
      const snapshot = matching(plan)
      mutate(snapshot, plan)
      projectMemberships(snapshot)
      expect(() => verifySnapshot(plan, snapshot)).toThrow(code)
      if (
        !['missing expected', 'admin option', 'cannot SET ROLE', 'duplicate edge'].includes(_name)
      )
        expect(
          membershipVerificationModel(plan, snapshot).some((r) => r.EXTRA_MEMBERS.length > 0),
        ).toBe(true)
    },
  )
  it('rejects hidden edges, incomplete memberships and missing/privileged external LOGIN', () => {
    const plan = boundPlan()
    const snapshot = matching(plan)
    snapshot.roles[0].memberRoles = []
    expect(() => verifySnapshot(plan, snapshot)).toThrow('MEMBERSHIP_CATALOG_PROJECTION_DRIFT')
    const incomplete = matching(plan)
    Reflect.deleteProperty(incomplete.membershipEdges[0], 'adminOption')
    expect(() => verifySnapshot(plan, incomplete)).toThrow('INCOMPLETE_MEMBERSHIP_DESCRIPTOR')
    const missingLogin = matching(plan)
    missingLogin.roles = missingLogin.roles.filter((r) => !r.login)
    expect(() => verifySnapshot(plan, missingLogin)).toThrow('EXTERNAL_LOGIN_PRINCIPAL_ABSENT')
    const privileged = matching(plan)
    privileged.roles.find((r) => r.login)!.createRole = true
    expect(() => verifySnapshot(plan, privileged)).toThrow('EXTERNAL_LOGIN_ATTRIBUTE_DRIFT')
  })
  it('rejects every noncanonical directed edge among all ten bound identities in both scopes', () => {
    for (const scope of ['UE_OPERATIONAL', 'FINANCIAL_SERVICE'] as const) {
      const plan = buildPlan(scope, fixtureBindings(), canonical, target)
      const names = plan.DELEGATION_BINDINGS.flatMap((b) => [
        b.AUTHORIZATION_ROLE,
        b.LOGIN_PRINCIPAL,
      ])
      let rejected = 0
      for (const grantedRole of names)
        for (const memberRole of names) {
          if (
            plan.DELEGATION_BINDINGS.some(
              (b) => b.AUTHORIZATION_ROLE === grantedRole && b.LOGIN_PRINCIPAL === memberRole,
            )
          )
            continue
          const snapshot = matching(plan)
          snapshot.membershipEdges.push({
            grantedRole,
            memberRole,
            adminOption: false,
            setOption: true,
          })
          projectMemberships(snapshot)
          expect(() => verifySnapshot(plan, snapshot)).toThrow()
          rejected++
        }
      expect(rejected).toBe(95)
    }
  })
  it.each([
    'missing',
    'empty',
    'injected',
    'same authorization',
    'duplicate login',
    'operator login',
  ])('rejects %s external binding without defaults or inference', (variant) => {
    const bindings = fixtureBindings()
    switch (variant) {
      case 'missing':
        Reflect.deleteProperty(bindings, 'loginPrincipals')
        break
      case 'empty':
        bindings.loginPrincipals.MIGRATION_ADMIN = ''
        break
      case 'injected':
        bindings.loginPrincipals.MIGRATION_ADMIN = 'bad";SELECT 1'
        break
      case 'same authorization':
        bindings.loginPrincipals.MIGRATION_ADMIN = bindings.principals.MIGRATION_ADMIN
        break
      case 'duplicate login':
        bindings.loginPrincipals.MIGRATION_ADMIN = bindings.loginPrincipals.FINANCIAL_RUNTIME
        break
      case 'operator login':
        bindings.executorPrincipal = bindings.loginPrincipals.MIGRATION_ADMIN
        break
    }
    expect(() => buildPlan('UE_OPERATIONAL', bindings, canonical, target)).toThrow()
  })
  it('grants only absent expected membership and never repairs drift or creates a LOGIN', async () => {
    const plan = executionFixture()
    const before = matching(plan)
    const absent = before.membershipEdges.shift()!
    projectMemberships(before)
    const execute = vi.fn()
    let calls = 0
    const adapter = {
      transaction: async <T>(
        work: (c: { snapshot: () => Promise<Snapshot>; execute: typeof execute }) => Promise<T>,
      ) => work({ snapshot: async () => (++calls === 1 ? before : matching(plan)), execute }),
    }
    await executePlan(plan, adapter, 'apply')
    const grants = execute.mock.calls
      .map(([sql]) => String(sql))
      .filter((sql) =>
        plan.OPERATIONS.some((op) => op.KIND === 'GRANT_MEMBERSHIP_IF_ABSENT' && op.SQL === sql),
      )
    expect(grants).toEqual([`GRANT "${absent.grantedRole}" TO "${absent.memberRole}";`])
    expect(
      execute.mock.calls.every(
        ([sql]) => !/CREATE ROLE.* LOGIN |PASSWORD|REVOKE.*CASCADE/.test(String(sql)),
      ),
    ).toBe(true)
    for (const [_name, mutate] of delegationDrifts.slice(1)) {
      const drift = matching(plan)
      mutate(drift, plan)
      projectMemberships(drift)
      execute.mockClear()
      calls = 0
      before.membershipEdges = drift.membershipEdges
      before.roles = drift.roles
      await expect(executePlan(plan, adapter, 'apply')).rejects.toThrow()
      expect(execute).not.toHaveBeenCalled()
    }
  })
  it('rejects tampered plans before adapter access', async () => {
    const p = executionFixture()
    p.OPERATIONS[0].SQL = 'SELECT 1;'
    const transaction = vi.fn()
    await expect(executePlan(p, { transaction }, 'apply')).rejects.toThrow('PLAN_DIGEST_DRIFT')
    expect(transaction).not.toHaveBeenCalled()
  })
  it('creates only absent roles/extensions and post-verifies using the same injected transaction', async () => {
    const p = executionFixture()
    const before = matching(p)
    before.roles = before.roles.filter((r) => r.login)
    before.membershipEdges = []
    projectMemberships(before)
    before.privileges = []
    before.defaultPrivileges = []
    for (const extension of before.extensions) extension.installed = null
    const snapshot = vi.fn().mockResolvedValueOnce(before).mockResolvedValueOnce(matching(p))
    const execute = vi.fn().mockResolvedValue(undefined)
    const invoked = vi.fn()
    const transaction = async <T>(
      work: (c: { snapshot: typeof snapshot; execute: typeof execute }) => Promise<T>,
    ) => {
      invoked()
      return work({ snapshot, execute })
    }
    await executePlan(p, { transaction }, 'apply')
    expect(invoked).toHaveBeenCalledTimes(1)
    expect(snapshot).toHaveBeenCalledTimes(2)
    expect(execute).toHaveBeenCalledTimes(p.OPERATIONS.length)
    expect(
      execute.mock.calls.filter(([sql]) => String(sql).startsWith('CREATE ROLE')),
    ).toHaveLength(3)
    expect(
      execute.mock.calls.filter(([sql]) => String(sql).startsWith('CREATE EXTENSION')),
    ).toHaveLength(4)
  })
})
