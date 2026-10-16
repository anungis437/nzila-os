import { describe, expect, it } from 'vitest'
import {
  compileMinimumRoleProvisioningSql,
  INSTALLER_FUNCTION_OWNER_ROLES,
} from './minimum-installer'
import { CANONICAL_BOOTSTRAP_ROLES } from './execution-roles'
import { AUTH_EXECUTION_ROLES } from './auth-sql'
import { FRAMEWORK_ROLES } from './framework-contract'
import { inspectInstallerDelegations } from './manifest-security'

describe('bounded minimum installer prerequisites', () => {
  it('independently rejects missing, extra, duplicate, administrative and execution-principal delegations', () => {
    const declaration = {
      prerequisiteSource: 'apps/union-eyes/scripts/bootstrap-v2/minimum-installer.ts',
      functionOwnerRoles: [...INSTALLER_FUNCTION_OWNER_ROLES],
    }
    const exact = INSTALLER_FUNCTION_OWNER_ROLES.map((role) => ({
      role,
      member: 'ue_v2_owner',
      admin_option: false,
      inherit_option: true,
      set_option: true,
    }))
    expect(inspectInstallerDelegations(exact, declaration)).toEqual([])
    expect(inspectInstallerDelegations([], undefined)).toEqual([])
    expect(inspectInstallerDelegations(exact, undefined)).toEqual([
      'UNDECLARED_CLUSTER_ROLE_MEMBERSHIP',
    ])
    expect(
      inspectInstallerDelegations(exact, {
        ...declaration,
        functionOwnerRoles: [...declaration.functionOwnerRoles, 'union_eyes_runtime'],
      }),
    ).toEqual(['INSTALLER_DELEGATION_SOURCE_CONTRACT_DRIFT'])
    for (const invalid of [
      exact.slice(1),
      [...exact, exact[0]],
      exact.map((entry) => ({ ...entry, role: exact[0].role })),
      exact.map((entry) => ({ ...entry, admin_option: true })),
      exact.map((entry) => ({ ...entry, inherit_option: false })),
      exact.map((entry) => ({ ...entry, set_option: false })),
      exact.map((entry) => ({ ...entry, member: 'union_eyes_runtime' })),
      exact.map((entry) => ({ ...entry, member: 'union_eyes_system' })),
    ])
      expect(inspectInstallerDelegations(invalid, declaration)).toEqual([
        'INSTALLER_FUNCTION_OWNER_DELEGATION_DRIFT',
      ])
  })
  it('preprovisions each canonical role once, without privileged role attributes or credentials', () => {
    const sql = compileMinimumRoleProvisioningSql()
    expect(sql.match(/CREATE ROLE /g)).toHaveLength(CANONICAL_BOOTSTRAP_ROLES.length)
    for (const role of CANONICAL_BOOTSTRAP_ROLES)
      expect(sql).toContain(`CREATE ROLE "${role}" NOLOGIN`)
    for (const role of [...Object.values(AUTH_EXECUTION_ROLES), ...Object.values(FRAMEWORK_ROLES)])
      expect(sql).toContain(
        `CREATE ROLE "${role}" NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`,
      )
    expect(sql).not.toMatch(
      /\bPASSWORD\b|\bLOGIN\b|\bSUPERUSER\b|\bBYPASSRLS\b|\bCREATEDB\b|\bCREATEROLE\b/,
    )
    expect(sql).not.toContain('WITH ADMIN TRUE')
  })
  it('limits installation-owner delegation to the four exact non-login function owners', () => {
    expect(INSTALLER_FUNCTION_OWNER_ROLES).toEqual([
      AUTH_EXECUTION_ROLES.riskReader,
      AUTH_EXECUTION_ROLES.providerReader,
      AUTH_EXECUTION_ROLES.orgAuthorityReader,
      FRAMEWORK_ROLES.reader,
    ])
    const sql = compileMinimumRoleProvisioningSql()
    const inherited = sql
      .split('\n')
      .filter((line) => line.includes('WITH ADMIN FALSE, INHERIT TRUE'))
    expect(inherited).toHaveLength(1)
    expect(inherited[0]).toBe(
      `GRANT ${INSTALLER_FUNCTION_OWNER_ROLES.map((role) => `"${role}"`).join(',')} TO ue_v2_owner WITH ADMIN FALSE, INHERIT TRUE, SET TRUE;`,
    )
    expect(sql).not.toContain('TO union_eyes_runtime')
    expect(sql).not.toContain('TO union_eyes_system')
  })
})
