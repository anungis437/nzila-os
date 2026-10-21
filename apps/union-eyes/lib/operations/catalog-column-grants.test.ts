import { describe, expect, it } from 'vitest'
import contract from './catalog-authority-contract.json'
import { assessCatalogAdmission } from './catalog-admission-core.mjs'
import { AUTHORITY_READER_COLUMN_GRANTS } from '../../../../tooling/scripts/lib/union-eyes-catalog-authority.mjs'
import {
  FRAMEWORK_IDENTITY_UPDATE_COLUMNS,
  FRAMEWORK_READER_COLUMNS,
  FRAMEWORK_ROLES,
} from '../../scripts/bootstrap-v2/framework-contract'

const identity = FRAMEWORK_ROLES.identity
const reader = 'ue_framework_authority_reader'

const unprivileged = {
  rolsuper: false,
  rolbypassrls: false,
  rolcreatedb: false,
  rolcreaterole: false,
}

function snapshots(columnGrants: Record<string, unknown>[], relations: Record<string, unknown>[] = []) {
  return {
    roles: [
      { rolname: 'union_eyes_runtime', ...unprivileged },
      { rolname: 'union_eyes_system', ...unprivileged },
    ],
    relations,
    columnGrants,
  }
}

const authUser = {
  schema_name: 'public',
  table_name: 'auth_user',
  relkind: 'r',
  relrowsecurity: true,
  relforcerowsecurity: true,
  runtime: [],
  system: [],
}

function approvedRows() {
  const rows: Record<string, unknown>[] = []
  for (const grant of contract.payload.approvedColumnGrants) {
    for (const column of grant.columns) {
      rows.push({
        schema_name: grant.schema,
        table_name: grant.table,
        column_name: column,
        role_name: grant.role,
        privilege_type: grant.privilege,
      })
    }
  }
  return rows
}

function columnViolations(rows: Record<string, unknown>[], relations: Record<string, unknown>[] = [authUser]) {
  return assessCatalogAdmission(contract, snapshots(rows, relations)).violations.filter((violation: string) =>
    /column/i.test(violation),
  )
}

describe('framework column grants', () => {
  it('declares exactly the source-approved identity and reader columns', () => {
    const byKey = new Map(
      contract.payload.approvedColumnGrants.map((grant) => [
        `${grant.schema}.${grant.table}|${grant.role}|${grant.privilege}`,
        [...grant.columns].sort(),
      ]),
    )
    expect(byKey.get(`public.auth_user|${identity}|UPDATE`)).toEqual([...FRAMEWORK_IDENTITY_UPDATE_COLUMNS].sort())
    expect(byKey.get(`user_management.users|${reader}|SELECT`)).toEqual([...FRAMEWORK_READER_COLUMNS.users].sort())
    expect(byKey.get(`user_management.user_sessions|${reader}|SELECT`)).toEqual(
      [...FRAMEWORK_READER_COLUMNS.user_sessions].sort(),
    )
    expect(byKey.size).toBe(3)
  })

  it('keeps the verifier constants equal to the framework contract', () => {
    const constants = new Map(AUTHORITY_READER_COLUMN_GRANTS.map((grant) => [grant.table, [...grant.columns].sort()]))
    expect(constants.get('users')).toEqual([...FRAMEWORK_READER_COLUMNS.users].sort())
    expect(constants.get('user_sessions')).toEqual([...FRAMEWORK_READER_COLUMNS.user_sessions].sort())
  })

  it('does not grant identity UPDATE at table level', () => {
    const grant = contract.payload.dedicatedRolePrivileges.find(
      (row) => row.table === 'auth_user' && row.role === identity,
    )
    expect(grant?.privileges).toEqual(['SELECT', 'INSERT'])
  })

  it('admits exactly the approved column grants', () => {
    expect(columnViolations(approvedRows())).toEqual([])
  })

  it('rejects a column the identity role may not update', () => {
    const rows = [
      ...approvedRows(),
      { schema_name: 'public', table_name: 'auth_user', column_name: 'password', role_name: identity, privilege_type: 'UPDATE' },
    ]
    expect(columnViolations(rows).join('\n')).toContain('columns are')
  })

  it('rejects a missing approved column', () => {
    const rows = approvedRows().filter(
      (row) => !(row.table_name === 'auth_user' && row.column_name === 'is_staff'),
    )
    expect(columnViolations(rows).join('\n')).toContain('auth_user')
  })

  it('rejects an approved table that has no column grant', () => {
    const rows = approvedRows().filter((row) => row.table_name !== 'auth_user')
    expect(columnViolations(rows).join('\n')).toContain('columns are []')
  })

  it('rejects a column ACL for any role the source does not approve', () => {
    for (const role_name of ['union_eyes_runtime', 'union_eyes_system', 'PUBLIC', 'ue_framework_admin']) {
      const rows = [
        ...approvedRows(),
        { schema_name: 'public', table_name: 'auth_user', column_name: 'email', role_name, privilege_type: 'SELECT' },
      ]
      expect(columnViolations(rows).join('\n'), role_name).toContain('unapproved column ACL')
    }
  })

  it('rejects an approved role holding an unapproved privilege kind', () => {
    const rows = [
      ...approvedRows(),
      { schema_name: 'user_management', table_name: 'users', column_name: 'user_id', role_name: reader, privilege_type: 'UPDATE' },
    ]
    expect(columnViolations(rows).join('\n')).toContain('unapproved column ACL')
  })

  it('rejects a column ACL on a table outside the approved set', () => {
    const rows = [
      ...approvedRows(),
      { schema_name: 'public', table_name: 'claims', column_name: 'id', role_name: identity, privilege_type: 'SELECT' },
    ]
    expect(columnViolations(rows).join('\n')).toContain('public.claims.id has an unapproved column ACL')
  })
})
