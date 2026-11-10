import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

export const MANAGED_PG16_LOGIN_TARGETS = Object.freeze({
  ue_staging_runtime: 'union_eyes_runtime',
  ue_staging_system: 'union_eyes_system',
  ue_staging_auth: 'nzila_auth_gateway',
})
const operatorName = 'uev2admin'
const verifiedProofs = new WeakSet()
const stable = (value) => JSON.stringify(sortKeys(value))
function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortKeys(value[key])]),
    )
  return value
}
const digest = (value) => createHash('sha256').update(stable(value)).digest('hex')
const ordered = (rows) => rows.map(stable).sort()
const edge = (role, member, grantor, admin, inherit, set) => ({
  role,
  member,
  grantor,
  admin,
  inherit,
  set,
})
const catalogEdge = (definition) => ({
  kind: 'role_membership',
  id: `${definition.role}:${definition.member}`,
  definition,
})
function uniqueObjects(objects) {
  const result = new Map()
  for (const object of objects) {
    const id = `${object.kind}:${object.id}`
    assert(!result.has(id), `DUPLICATE_MANAGED_OBJECT_ID:${id}`)
    result.set(id, object)
  }
  return result
}

/**
 * Read-only comparison of canonically normalized catalogs. The reference must
 * come from the hash-checked local export; actual rows must come from native
 * catalog queries. No object class, ACL, owner or body is ignored.
 *
 * PG16 records role-creator ADMIN grants from its bootstrap superuser. Azure
 * reserves azuresu for the provider; these grants cannot be customer-revoked.
 * This profile declares each exact edge, its grantor and all three options.
 */
export function qualifyManagedPg16Catalog({
  reference,
  actual,
  operator,
  bootstrap,
  loginRoles,
  loginMemberships,
  phase,
}) {
  assert(['RESTORE_OPEN', 'FINAL'].includes(phase), 'MANAGED_PROFILE_PHASE_REQUIRED')
  assert.equal(operator.name, operatorName, 'MANAGED_OPERATOR_NAME_MISMATCH')
  assert.equal(operator.superuser, false, 'MANAGED_OPERATOR_MUST_NOT_BE_SUPERUSER')
  for (const flag of ['login', 'createdb', 'createrole'])
    assert.equal(operator[flag], true, `MANAGED_OPERATOR_ATTRIBUTE:${flag}`)
  assert.equal(bootstrap.name, 'azuresu', 'UNRECOGNIZED_BOOTSTRAP_GRANTOR')
  assert.equal(bootstrap.superuser, true, 'BOOTSTRAP_GRANTOR_NOT_SUPERUSER')

  const roles = reference.filter((o) => o.kind === 'role').map((o) => o.id)
  assert(
    roles.includes('ue_v2_owner') &&
      Object.values(MANAGED_PG16_LOGIN_TARGETS).every((r) => roles.includes(r)),
    'CANONICAL_ROLE_REFERENCE_INCOMPLETE',
  )
  assert.equal(new Set(roles).size, roles.length, 'DUPLICATE_CANONICAL_ROLE')
  const referenceMemberships = reference.filter((o) => o.kind === 'role_membership')
  assert(
    referenceMemberships.every((o) => o.definition.grantor === 'postgres'),
    'UNRECOGNIZED_REFERENCE_GRANTOR',
  )
  const expectedMemberships = referenceMemberships.map((o) =>
    catalogEdge({ ...o.definition, grantor: operatorName }),
  )
  expectedMemberships.push(
    ...roles.map((role) =>
      catalogEdge(edge(role, operatorName, bootstrap.name, true, false, false)),
    ),
  )
  expectedMemberships.push(
    ...Object.entries(MANAGED_PG16_LOGIN_TARGETS).map(([login, role]) =>
      catalogEdge(edge(role, login, operatorName, false, false, true)),
    ),
  )
  if (phase === 'RESTORE_OPEN')
    expectedMemberships.push(
      catalogEdge(edge('ue_v2_owner', operatorName, operatorName, false, false, true)),
    )
  // Compare arrays, not a map keyed by role/member: PG16 permits different
  // grantors on the same pair, and dropping one would hide an escalation.
  assert.deepEqual(
    ordered(actual.filter((o) => o.kind === 'role_membership')),
    ordered(expectedMemberships),
    'MANAGED_ROLE_MEMBERSHIP_DRIFT',
  )

  const expectedLogins = Object.keys(MANAGED_PG16_LOGIN_TARGETS).sort()
  assert.deepEqual(loginRoles.map((r) => r.name).sort(), expectedLogins, 'MANAGED_LOGIN_SET_DRIFT')
  for (const role of loginRoles) {
    assert.equal(role.login, true, `MANAGED_LOGIN_DISABLED:${role.name}`)
    for (const flag of [
      'superuser',
      'bypassrls',
      'createdb',
      'createrole',
      'replication',
      'inherit',
    ])
      assert.equal(role[flag], false, `MANAGED_LOGIN_ESCALATION:${role.name}:${flag}`)
  }
  const expectedLoginMemberships = Object.entries(MANAGED_PG16_LOGIN_TARGETS).flatMap(
    ([login, role]) => [
      edge(role, login, operatorName, false, false, true),
      edge(login, operatorName, bootstrap.name, true, false, false),
    ],
  )
  assert.deepEqual(
    ordered(loginMemberships),
    ordered(expectedLoginMemberships),
    'MANAGED_LOGIN_MEMBERSHIP_DRIFT',
  )

  const referenceOther = uniqueObjects(reference.filter((o) => o.kind !== 'role_membership'))
  const actualOther = uniqueObjects(actual.filter((o) => o.kind !== 'role_membership'))
  assert.deepEqual(
    [...actualOther.keys()].sort(),
    [...referenceOther.keys()].sort(),
    'MANAGED_CATALOG_OBJECT_SET_DRIFT',
  )
  for (const [id, expected] of referenceOther)
    assert.equal(
      stable(actualOther.get(id)),
      stable(expected),
      `MANAGED_CATALOG_DEFINITION_DRIFT:${id}`,
    )
  const projection = reference.map((o) =>
    o.kind === 'role_membership' ? o : actualOther.get(`${o.kind}:${o.id}`),
  )
  const proof = Object.freeze({
    status: 'PASS_CANONICAL_CATALOG_AND_DECLARED_MANAGED_ROLE_GRAPH',
    profile: 'UE_STAGING_MANAGED_PG16_V1',
    phase,
    canonicalObjects: reference.length,
    actualObjects: actual.length,
    canonicalRoles: roles.length,
    managedMemberships: expectedMemberships.length,
    referenceSemanticDigest: digest(reference),
    projectedSemanticDigest: digest(projection),
    actualSemanticDigest: digest(actual),
    projection,
  })
  verifiedProofs.add(proof)
  return proof
}

/** Retain the unmodified native probe result; only its fixture-specific graph
 * comparison is superseded by the fully enumerated managed graph above. */
export function assertManagedPg16PrivilegeProbe(probe, catalogProof) {
  assert(verifiedProofs.has(catalogProof), 'FRESH_NATIVE_CATALOG_PROOF_REQUIRED')
  assert.equal(catalogProof.status, 'PASS_CANONICAL_CATALOG_AND_DECLARED_MANAGED_ROLE_GRAPH')
  assert.equal(catalogProof.projectedSemanticDigest, catalogProof.referenceSemanticDigest)
  assert(Array.isArray(probe.mismatches), 'NATIVE_PRIVILEGE_PROBE_REQUIRED')
  assert(
    probe.mismatches.length <= 1 &&
      probe.mismatches.every((m) => m === 'INSTALLER_FUNCTION_OWNER_DELEGATION_DRIFT'),
    'MANAGED_NATIVE_EFFECTIVE_PRIVILEGE_DRIFT',
  )
  assert.equal(
    probe.status,
    probe.mismatches.length ? 'FAIL' : 'PASS_PUBLIC_AND_AUTH_NATIVE_PRIVILEGES',
    'NATIVE_PRIVILEGE_PROBE_STATUS_MISMATCH',
  )
  return {
    status: 'PASS_NATIVE_EFFECTIVE_PRIVILEGES_WITH_DECLARED_MANAGED_GRAPH',
    fixtureProbeStatus: probe.status,
    fixtureGraphDifference: [...probe.mismatches],
  }
}
