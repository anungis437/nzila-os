import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  qualifyManagedPg16Catalog as qualify,
  assertManagedPg16PrivilegeProbe as privileges,
  MANAGED_PG16_LOGIN_TARGETS as targets,
} from './ue-managed-pg16-catalog.mjs'
const edge = (role, member, grantor, admin = false, inherit = false, set = true) => ({
  role,
  member,
  grantor,
  admin,
  inherit,
  set,
})
const object = (definition) => ({
  kind: 'role_membership',
  id: definition.role + ':' + definition.member,
  definition,
})
function fixture(phase = 'FINAL') {
  const roles = [
    'ue_v2_owner',
    'union_eyes_runtime',
    'union_eyes_system',
    'nzila_auth_gateway',
    'reader',
  ]
  const reference = [
    ...roles.map((id) => ({ kind: 'role', id, definition: { login: false, bypassrls: false } })),
    object(edge('reader', 'ue_v2_owner', 'postgres', false, true, true)),
    {
      kind: 'relation',
      id: 'public.claims',
      definition: { rls: true, force: true, owner: 'ue_v2_owner', acl: 'runtime=r/owner' },
    },
  ]
  const actual = structuredClone(reference)
  actual.find((o) => o.kind === 'role_membership').definition.grantor = 'uev2admin'
  actual.push(...roles.map((r) => object(edge(r, 'uev2admin', 'azuresu', true, false, false))))
  actual.push(...Object.entries(targets).map(([l, r]) => object(edge(r, l, 'uev2admin'))))
  if (phase === 'RESTORE_OPEN') actual.push(object(edge('ue_v2_owner', 'uev2admin', 'uev2admin')))
  return {
    reference,
    actual,
    phase,
    operator: {
      name: 'uev2admin',
      superuser: false,
      login: true,
      createdb: true,
      createrole: true,
    },
    bootstrap: { name: 'azuresu', superuser: true },
    loginRoles: Object.keys(targets).map((name) => ({
      name,
      login: true,
      superuser: false,
      bypassrls: false,
      createdb: false,
      createrole: false,
      replication: false,
      inherit: false,
    })),
    loginMemberships: Object.entries(targets).flatMap(([l, r]) => [
      edge(r, l, 'uev2admin'),
      edge(l, 'uev2admin', 'azuresu', true, false, false),
    ]),
  }
}
test('declares managed role creators and login bindings without changing canonical objects', () => {
  const f = fixture()
  const p = qualify(f)
  assert.equal(p.referenceSemanticDigest, p.projectedSemanticDigest)
  assert.notEqual(p.referenceSemanticDigest, p.actualSemanticDigest)
  assert.deepEqual(p.projection, f.reference)
  assert.equal(
    privileges({ status: 'FAIL', mismatches: ['INSTALLER_FUNCTION_OWNER_DELEGATION_DRIFT'] }, p)
      .status,
    'PASS_NATIVE_EFFECTIVE_PRIVILEGES_WITH_DECLARED_MANAGED_GRAPH',
  )
})
test('temporary operator SET delegation is restricted to the open restore phase and exact grantor', () => {
  const f = fixture('RESTORE_OPEN')
  qualify(f)
  f.phase = 'FINAL'
  assert.throws(() => qualify(f), /MANAGED_ROLE_MEMBERSHIP_DRIFT/)
})
for (const flag of ['superuser', 'bypassrls', 'createdb', 'createrole', 'replication', 'inherit'])
  test(`rejects application login ${flag}`, () => {
    const f = fixture()
    f.loginRoles[0][flag] = true
    assert.throws(() => qualify(f), /MANAGED_LOGIN_ESCALATION/)
  })
for (const flag of ['admin', 'inherit', 'set'])
  test(`rejects role-creator ${flag} drift`, () => {
    const f = fixture()
    const d = f.actual.find(
      (o) => o.kind === 'role_membership' && o.definition.member === 'uev2admin',
    ).definition
    d[flag] = !d[flag]
    assert.throws(() => qualify(f), /MANAGED_ROLE_MEMBERSHIP_DRIFT/)
  })
test('preserves multiple grantors on the same role/member pair', () => {
  const f = fixture('RESTORE_OPEN')
  const index = f.actual.findIndex(
    (o) =>
      o.kind === 'role_membership' &&
      o.definition.member === 'uev2admin' &&
      o.definition.role === 'ue_v2_owner' &&
      o.definition.grantor === 'azuresu',
  )
  f.actual.splice(index, 1)
  assert.throws(() => qualify(f), /MANAGED_ROLE_MEMBERSHIP_DRIFT/)
})
test('rejects an extra administrator, gateway, owner or undeclared login membership', () => {
  for (const target of ['ue_v2_owner', 'nzila_auth_gateway', 'azure_pg_admin']) {
    const f = fixture()
    f.loginMemberships.push(edge(target, 'ue_staging_runtime', 'uev2admin'))
    assert.throws(() => qualify(f), /MANAGED_LOGIN_MEMBERSHIP_DRIFT/)
  }
})
test('rejects a rogue member of any canonical role', () => {
  const f = fixture()
  f.actual.push(object(edge('reader', 'rogue_login', 'uev2admin')))
  assert.throws(() => qualify(f), /MANAGED_ROLE_MEMBERSHIP_DRIFT/)
})
for (const field of ['acl', 'rls', 'force', 'owner'])
  test(`retains canonical ${field} comparison`, () => {
    const f = fixture()
    f.actual.find((o) => o.kind === 'relation').definition[field] = 'changed'
    assert.throws(() => qualify(f), /MANAGED_CATALOG_DEFINITION_DRIFT/)
  })
test('rejects unexpected objects and duplicate non-membership identities', () => {
  for (const entry of [
    { kind: 'function', id: 'unknown()', definition: {} },
    fixture().actual.find((o) => o.kind === 'relation'),
  ]) {
    const f = fixture()
    f.actual.push(entry)
    assert.throws(() => qualify(f), /MANAGED_CATALOG_OBJECT_SET_DRIFT|DUPLICATE_MANAGED_OBJECT_ID/)
  }
})
test('cannot discard another native privilege failure', () => {
  const p = qualify(fixture())
  for (const mismatches of [
    ['PUBLIC_SELECT:claims'],
    ['INSTALLER_FUNCTION_OWNER_DELEGATION_DRIFT', 'AUTH_ROLE_ESCALATION'],
  ])
    assert.throws(
      () => privileges({ status: 'FAIL', mismatches }, p),
      /MANAGED_NATIVE_EFFECTIVE_PRIVILEGE_DRIFT/,
    )
})
test('cannot substitute a serialized or fabricated catalog proof', () => {
  const p = qualify(fixture())
  assert.throws(
    () =>
      privileges(
        { status: 'FAIL', mismatches: ['INSTALLER_FUNCTION_OWNER_DELEGATION_DRIFT'] },
        JSON.parse(JSON.stringify(p)),
      ),
    /FRESH_NATIVE_CATALOG_PROOF_REQUIRED/,
  )
})
test('does not accept another operator or a non-provider bootstrap grantor', () => {
  for (const change of [
    (f) => (f.operator.name = 'other_admin'),
    (f) => (f.bootstrap.name = 'other_superuser'),
    (f) => (f.bootstrap.superuser = false),
  ]) {
    const f = fixture()
    change(f)
    assert.throws(() => qualify(f))
  }
})
