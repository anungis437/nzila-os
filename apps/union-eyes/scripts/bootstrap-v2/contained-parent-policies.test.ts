import { describe, expect, it } from 'vitest'
import {
  assessCatalogAdmission, catalogContractDigest, containedParentPolicyViolations,
  type CatalogRow, type ContainedParentPolicy,
} from '../../lib/operations/catalog-admission-core.mjs'
import historical from '../../lib/operations/catalog-authority-contract.json'
import {
  compileContainedParentPolicy, containedParentPolicyInstallViolations,
  planContainedParentPolicyInstall,
} from './contained-parent-policies'

const spec: ContainedParentPolicy = {
  schema: 'public', table: 'child', name: 'ue_v2_contained_parent_update', command: 'UPDATE',
  permissive: false, roles: ['union_eyes_runtime', 'union_eyes_system'], using: 'true',
  predicate: '("parent_id" IS NULL) AND ("other_parent_id" IS NULL)',
}
const row: CatalogRow = {
  table_name: 'child', owner_name: 'ue_v2_owner', relrowsecurity: true, relforcerowsecurity: true,
  polname: spec.name, polcmd: 'w', polpermissive: false, public_role: false,
  roles: spec.roles, qual: 'true', with_check: spec.predicate,
}
const finalOptions = { expectedOwner: 'ue_v2_owner', requireForcedRls: true }

describe('exact contained-parent policy admission', () => {
  it('admits deparsed NULL conjunctions and unordered role sets without broad expression equivalence', () => {
    expect(containedParentPolicyViolations([spec], [{ ...row, roles: [...spec.roles].reverse(),
      qual: '((TRUE))', with_check: '((other_parent_id IS NULL) AND ((parent_id IS NULL)))' }])).toEqual([])
    const mandatory = { ...spec, predicate: 'false' }
    expect(containedParentPolicyViolations([mandatory], [{ ...row, with_check: '((false))' }])).toEqual([])
    const insert: ContainedParentPolicy = { ...spec, command: 'INSERT', name: 'ue_v2_contained_parent_insert', using: null }
    expect(containedParentPolicyViolations([insert], [{ ...row, polname: insert.name, polcmd: 'a', qual: null }])).toEqual([])
  })

  it.each([
    { polcmd: '*' }, { polcmd: 'a' }, { polpermissive: true }, { public_role: true },
    { public_role: undefined }, { roles: ['union_eyes_runtime'] },
    { roles: [...spec.roles, 'PUBLIC'] }, { roles: [...spec.roles, 'union_eyes_system'] },
    { qual: null }, { qual: 'false' }, { qual: 'true OR false' },
    { with_check: 'true' }, { with_check: null },
    { with_check: 'parent_id IS NULL OR other_parent_id IS NULL' },
    { with_check: 'parent_id IS NULL AND unrelated IS NULL' },
    { with_check: 'parent_id IS NULL' },
    { with_check: 'parent_id IS NULL AND parent_id IS NULL AND other_parent_id IS NULL' },
    { with_check: '(parent_id::text IS NULL) AND other_parent_id IS NULL' },
    { with_check: 'public.override() AND parent_id IS NULL AND other_parent_id IS NULL' },
    { with_check: 'parent_id IS NULL AND other_parent_id IS NULL -- ignored' },
    { with_check: '((parent_id IS NULL) AND other_parent_id IS NULL' },
    { with_check: 'parent_id IS NULL AND other_parent_id IS NULL); SELECT true' },
  ])('rejects policy authority or expression drift: %j', change => {
    expect(containedParentPolicyViolations([spec], [{ ...row, ...change }])).toEqual([
      'public.child contained-parent policy is missing or changed: ue_v2_contained_parent_update',
    ])
  })

  it('requires the source declaration and rejects missing, repeated and undeclared guards', () => {
    expect(containedParentPolicyViolations(undefined, [])).toEqual(['contained-parent policy source contract is missing'])
    expect(containedParentPolicyViolations([], [])).toEqual([])
    for (const actual of [[], [row, row], [{ ...row, table_name: 'unrelated' }]])
      expect(containedParentPolicyViolations([spec], actual).length).toBeGreaterThan(0)
    expect(containedParentPolicyViolations([], [row])).toEqual([
      'public.child has an undeclared contained-parent policy: ue_v2_contained_parent_update',
    ])
    for (const change of [{ command: 'ALL' }, { schema: 'private' }, { permissive: true },
      { roles: [] }, { roles: ['PUBLIC'] }, { predicate: 'true' }, { using: null }, { name: 'unreserved' }])
      expect(containedParentPolicyViolations([{ ...spec, ...change }], [row]).some(failure => failure.includes('source contract is invalid'))).toBe(true)
    expect(containedParentPolicyViolations([spec, spec], [row]).some(failure => failure.includes('source contract is invalid'))).toBe(true)
    expect(() => compileContainedParentPolicy({ ...spec, predicate: 'true OR false' })).toThrow('Invalid contained-parent source policy')
  })

  it('fails the actual catalog assessor when the mandatory source field or declared guard is absent', () => {
    const payload = { ...structuredClone(historical.payload), currentFunctions: [], requiredContainedParentPolicies: [spec], requiredPhysicalTriggers: [] }
    payload.entries.push({ table: 'child', classification: 'TENANT_RLS_REQUIRED', runtime: [], system: [] })
    const snapshots = {
      roles: ['union_eyes_runtime', 'union_eyes_system'].map(rolname => ({ rolname, rolsuper: false, rolbypassrls: false, rolcreatedb: false, rolcreaterole: false })),
      schemaUsage: [...payload.runtimeSchemaUsage.map(nspname => ({ rolname: 'union_eyes_runtime', nspname })),
        ...payload.systemSchemaUsage.map(nspname => ({ rolname: 'union_eyes_system', nspname }))],
      policies: [row],
      relations: [{ schema_name: 'public', table_name: 'child', relkind: 'r', relrowsecurity: true,
        relforcerowsecurity: true, runtime: [], system: [] }],
    }
    const contract = { payload, digest: catalogContractDigest(payload) }
    expect(assessCatalogAdmission(contract, snapshots).ok).toBe(true)
    expect(assessCatalogAdmission(contract, { ...snapshots, policies: [] }).ok).toBe(false)
    for (const relations of [[], [{ ...snapshots.relations[0], relforcerowsecurity: false }]])
      expect(assessCatalogAdmission(contract, { ...snapshots, relations }).violations).toContain('public.child contained-parent policy relation lacks FORCE RLS')
    const missingPayload = { ...payload, requiredContainedParentPolicies: undefined }
    expect(assessCatalogAdmission({ payload: missingPayload, digest: catalogContractDigest(missingPayload) }, snapshots).violations)
      .toContain('contained-parent policy source contract is missing')
  })

  it('does not mistake a restrictive guard for an independent runtime access grant', () => {
    const payload = { ...structuredClone(historical.payload), currentFunctions: [], requiredContainedParentPolicies: [spec], requiredPhysicalTriggers: [] }
    payload.entries.push({ table: 'child', classification: 'TENANT_RLS_REQUIRED', runtime: ['UPDATE'], system: [] })
    const result = assessCatalogAdmission({ payload, digest: catalogContractDigest(payload) }, {
      roles: ['union_eyes_runtime', 'union_eyes_system'].map(rolname => ({ rolname, rolsuper: false, rolbypassrls: false, rolcreatedb: false, rolcreaterole: false })),
      schemaUsage: [...payload.runtimeSchemaUsage.map(nspname => ({ rolname: 'union_eyes_runtime', nspname })),
        ...payload.systemSchemaUsage.map(nspname => ({ rolname: 'union_eyes_system', nspname }))],
      policies: [row], relations: [{ schema_name: 'public', table_name: 'child', relkind: 'r',
        relrowsecurity: true, relforcerowsecurity: true, runtime: ['UPDATE'], system: [] }],
    })
    expect(result.violations).toContain('public.child has no runtime UPDATE policy')
  })
})

describe('add-only contained-parent policy installation', () => {
  it('adds exactly absent current source policies without replaying existing resource policies', () => {
    const missing = { ...row, polname: null }
    const plan = planContainedParentPolicyInstall([spec], [missing], finalOptions)
    expect(plan.targets).toEqual(['public.child.ue_v2_contained_parent_update'])
    expect(plan.statements).toEqual([compileContainedParentPolicy(spec)])
    expect(plan.statements[0]).toContain('AS RESTRICTIVE FOR UPDATE TO union_eyes_runtime, union_eyes_system USING (true) WITH CHECK')
    expect(planContainedParentPolicyInstall([spec], [row], finalOptions)).toEqual({ statements: [], targets: [] })
    expect(containedParentPolicyInstallViolations([spec], [row], finalOptions)).toEqual([])
  })

  it('accepts only explicit historical owner preflight before source-owned forced RLS', () => {
    const old = { ...row, owner_name: 'uev2admin', relrowsecurity: false, relforcerowsecurity: false, polname: null }
    expect(planContainedParentPolicyInstall([spec], [old], { expectedOwner: 'uev2admin', requireForcedRls: false }).statements).toHaveLength(1)
    expect(() => planContainedParentPolicyInstall([spec], [old], finalOptions)).toThrow('owner/forced RLS')
    expect(containedParentPolicyInstallViolations([spec], [{ ...row, relforcerowsecurity: false }], finalOptions)).toContain('public.child: contained-parent relation owner/forced RLS is missing or changed')
  })

  it.each([
    [], [{ ...row, owner_name: 'attacker' }], [{ ...row, relforcerowsecurity: false }],
    [{ ...row, polpermissive: true }], [row, row],
    [row, { ...row, table_name: 'other' }],
  ].map(actual => ({ actual })))('refuses partial or conflicting preimages before emitting any repair: $actual', ({ actual }) => {
    expect(() => planContainedParentPolicyInstall([spec], actual, finalOptions)).toThrow('preimage refused')
  })
})
