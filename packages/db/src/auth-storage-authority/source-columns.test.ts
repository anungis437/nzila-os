import { describe, expect, it } from 'vitest'
import { authStorageAuthorityEntries } from './entries'
import { AUTH_PRIVILEGE_EXPECTATIONS } from './privilege-expectations'
import { authColumnPrivilegeAllowed, authPrivilegeColumns, authSystemColumnPrivilegeAllowed, authTablePrivilegeAllowed, canonicalAuthColumnNames, compileAuthColumnPrivileges } from './source-columns'

describe('canonical auth source column authority', () => {
  it('resolves every declared privilege against the actual current source', () => {
    for (const entry of authStorageAuthorityEntries)
      expect(canonicalAuthColumnNames(entry.table.split('.')[1]!)).not.toHaveLength(0)
    for (const tables of Object.values(AUTH_PRIVILEGE_EXPECTATIONS))
      for (const [table, privileges] of Object.entries(tables))
        for (const [privilege, columns] of Object.entries(privileges))
          if (privilege !== 'DELETE') expect(authPrivilegeColumns(table, columns).length).toBeGreaterThan(0)
  })

  it('gives wildcard no power over retained or future physical columns', () => {
    expect(authColumnPrivilegeAllowed('users', 'password_hash', '*')).toBe(true)
    expect(authColumnPrivilegeAllowed('users', 'encrypted_sin', '*')).toBe(false)
    expect(authColumnPrivilegeAllowed('users', 'future_physical_column', '*')).toBe(false)
    expect(authColumnPrivilegeAllowed('unknown', 'user_id', '*')).toBe(false)
    expect(authColumnPrivilegeAllowed('users', 'password_hash', undefined)).toBe(false)
    expect(authColumnPrivilegeAllowed('users', 'xmin', '*')).toBe(false)
    expect(authSystemColumnPrivilegeAllowed('nzila_auth_issuance', 'users', 'xmin', 'SELECT')).toBe(true)
    expect(authSystemColumnPrivilegeAllowed('nzila_auth_identity', 'users', 'xmin', 'SELECT')).toBe(false)
    expect(authSystemColumnPrivilegeAllowed('nzila_auth_issuance', 'users', 'xmin', 'UPDATE')).toBe(false)
    expect(authSystemColumnPrivilegeAllowed('nzila_auth_issuance', 'user_sessions', 'xmin', 'SELECT')).toBe(false)
  })

  it('refuses invalid source tables, explicit fields and privilege syntax', () => {
    expect(() => canonicalAuthColumnNames('unknown')).toThrow('UNKNOWN_AUTH_SOURCE_TABLE')
    for (const columns of [['encrypted_sin'], [], ['user_id', 'user_id']])
      expect(() => authPrivilegeColumns('users', columns)).toThrow('INVALID_AUTH_SOURCE_COLUMNS')
    for (const privilege of ['ALL', 'SELECT; DELETE', 'SELECT ()', 'UPDATE (encrypted_sin)', 'DELETE (user_id)', 'SELECT,'])
      expect(() => compileAuthColumnPrivileges('users', privilege)).toThrow()
  })

  it('expands column-capable powers and preserves deliberate table DELETE only', () => {
    const columns = canonicalAuthColumnNames('user_sessions').map(column => `"${column}"`).join(', ')
    expect(compileAuthColumnPrivileges('user_sessions', 'SELECT, INSERT, UPDATE (is_active,last_used_at), REFERENCES, DELETE'))
      .toBe(`SELECT (${columns}), INSERT (${columns}), UPDATE ("is_active", "last_used_at"), REFERENCES (${columns}), DELETE`)
    for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'REFERENCES', 'TRUNCATE', 'TRIGGER'])
      expect(authTablePrivilegeAllowed(privilege, '*')).toBe(false)
    expect(authTablePrivilegeAllowed('DELETE', '*')).toBe(true)
    expect(authTablePrivilegeAllowed('DELETE', undefined)).toBe(false)
  })
})
