import { is } from 'drizzle-orm'
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core'
import * as authSchema from '../schema/auth'
import { AUTH_SYSTEM_COLUMN_PRIVILEGE_EXPECTATIONS } from './privilege-expectations'

export type AuthColumnExpectation = '*' | readonly string[] | undefined

// Authority comes from the current shared declaration, never the live catalog.
// Retained historical columns remain data, without gaining execution authority.
const sourceColumns = new Map<string, readonly string[]>()
for (const table of Object.values(authSchema)) {
  if (!is(table, PgTable)) continue
  const config = getTableConfig(table)
  if (config.schema !== 'user_management') continue
  if (sourceColumns.has(config.name)) throw new Error(`DUPLICATE_AUTH_SOURCE_TABLE:${config.name}`)
  sourceColumns.set(config.name, Object.freeze(config.columns.map(column => column.name)))
}

export function canonicalAuthColumnNames(table: string): readonly string[] {
  const columns = sourceColumns.get(table)
  if (!columns?.length) throw new Error(`UNKNOWN_AUTH_SOURCE_TABLE:${table}`)
  return columns
}

export function authPrivilegeColumns(table: string, expected: AuthColumnExpectation): readonly string[] {
  const current = canonicalAuthColumnNames(table)
  if (expected === '*') return current
  if (!expected) return []
  if (!expected.length || new Set(expected).size !== expected.length ||
    expected.some(column => !current.includes(column)))
    throw new Error(`INVALID_AUTH_SOURCE_COLUMNS:${table}`)
  return expected
}

export function authColumnPrivilegeAllowed(table: string, column: string, expected: AuthColumnExpectation): boolean {
  if (!sourceColumns.has(table)) return false
  return authPrivilegeColumns(table, expected).includes(column)
}

export function authSystemColumnPrivilegeAllowed(role: string, table: string, column: string, privilege: string): boolean {
  return Boolean(AUTH_SYSTEM_COLUMN_PRIVILEGE_EXPECTATIONS[role]?.[table]?.[privilege]?.includes(column))
}

/** Column-capable powers must never become table-wide, including for '*'. */
export function authTablePrivilegeAllowed(privilege: string, expected: AuthColumnExpectation): boolean {
  return privilege === 'DELETE' && expected === '*'
}

/** Compile the deliberately small, source-authored privilege grammar. */
export function compileAuthColumnPrivileges(table: string, privileges: string): string {
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`
  const parts = privileges.split(/,(?![^()]*\))/)
  return parts.map(part => {
    const match = /^\s*(SELECT|INSERT|UPDATE|REFERENCES|DELETE)\s*(?:\(([^()]*)\))?\s*$/.exec(part)
    if (!match) throw new Error(`INVALID_AUTH_PRIVILEGE:${table}`)
    const [, privilege, explicit] = match
    if (privilege === 'DELETE') {
      if (explicit !== undefined) throw new Error(`INVALID_AUTH_PRIVILEGE:${table}`)
      canonicalAuthColumnNames(table)
      return privilege
    }
    const columns = authPrivilegeColumns(table, explicit === undefined ? '*' : explicit.split(',').map(column => column.trim()))
    return `${privilege} (${columns.map(quote).join(', ')})`
  }).join(', ')
}
