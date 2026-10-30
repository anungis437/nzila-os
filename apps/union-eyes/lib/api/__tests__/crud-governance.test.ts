import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getTableName } from 'drizzle-orm'
import * as schema from '@/db/schema'
import { CRUD_GOVERNED_TABLES, assertCrudRead, assertCrudWrite, crudGovernanceFor, supportsGenericArchive } from '../crud-governance'
import { lowRoleModeFor, ownRowsScope } from '../crud-low-role-guard'

const ROOT = join(__dirname, '..', '..', '..')
const API = join(ROOT, 'app', 'api')

function routeFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) routeFiles(path, out)
    else if (entry.name === 'route.ts') out.push(path)
  }
  return out
}

function tablesBehindGenericRoutes(): Map<string, string[]> {
  const found = new Map<string, string[]>()
  for (const file of routeFiles(API)) {
    const source = readFileSync(file, 'utf8')
    if (!/crudRoutes\(/.test(source)) continue
    const identifier = source.match(/table:\s*(\w+)/)?.[1]
    if (!identifier) continue
    found.set(identifier, [...(found.get(identifier) ?? []), file])
  }
  return found
}

describe('generic CRUD governance (UE-CONV-K-007)', () => {
  const tables = tablesBehindGenericRoutes()

  it('classifies every table that has a generic route; nothing is left to the fail-closed default', () => {
    const unclassified: string[] = []
    for (const identifier of tables.keys()) {
      const table = (schema as unknown as Record<string, never>)[identifier]
      expect(table, `${identifier} must be exported from the schema`).toBeTruthy()
      if (!CRUD_GOVERNED_TABLES.has(getTableName(table))) unclassified.push(`${identifier} (${getTableName(table)})`)
    }
    expect(unclassified).toEqual([])
  })

  it('does not classify a table that no generic route uses', () => {
    const used = new Set([...tables.keys()].map((identifier) => getTableName((schema as unknown as Record<string, never>)[identifier])))
    expect([...CRUD_GOVERNED_TABLES.keys()].filter((name) => !used.has(name))).toEqual([])
  })

  it.each([
    ['claims', 'OWN_ROWS_READ'], ['grievances', 'OWN_ROWS_READ'], ['documents', 'DENIED'], ['data_subject_access_requests', 'SUBJECT_OWNED'], ['user_consents', 'SUBJECT_OWNED'],
    ['organization_members', 'READ_ONLY'], ['organizations', 'READ_ONLY'], ['dues_transactions', 'READ_ONLY'], ['per_capita_remittances', 'DENIED'],
    ['integration_api_keys', 'DENIED'], ['poll_votes', 'DENIED'], ['security_events', 'DENIED'],
  ])('keeps %s as %s', (name, expected) => {
    expect(CRUD_GOVERNED_TABLES.get(name)).toBe(expected)
  })

  // DEF-0B12-CRUD-TAX-PATHS-SERVE-THE-PER-CAPITA-REMITTANCE-LEDGER-TO-ANY-MEMBER (and the arrears and health-and-welfare
  // collections over the same table): the ledger has no owner column, so a member-level read returned the whole ledger.
  it('refuses every generic read and write over the per-capita remittance ledger', () => {
    const gate = crudGovernanceFor(schema.perCapitaRemittances)
    expect(gate.class).toBe('DENIED')
    expect(() => assertCrudRead(gate)).toThrow()
    expect(() => assertCrudWrite(gate)).toThrow()
  })

  it('denies invented archived enum values rather than raising 500 or deleting institutional bargaining history', () => {
    expect(schema.proposalStatusEnum.enumValues).not.toContain('archived')
    expect(supportsGenericArchive(schema.bargainingProposals.status)).toBe(false)
    expect(supportsGenericArchive(schema.negotiations.status)).toBe(false)
    expect(supportsGenericArchive({ enumValues: ['draft', 'archived'] })).toBe(true)
    expect(supportsGenericArchive({ enumValues: ['draft', 'withdrawn'] })).toBe(false)
    expect(supportsGenericArchive({})).toBe(true) // unbounded text status supports archived
    expect(supportsGenericArchive(undefined)).toBe(false) // separate hard-delete branch
    const factory = readFileSync(join(ROOT, 'lib', 'api', 'crud-factory.ts'), 'utf8')
    expect(factory).toMatch(/statusCol && !supportsGenericArchive\\(statusCol\\)/)
    expect(factory).toMatch(/throw ApiError\.forbidden\(`Generic deletion is unavailable/)
  })

  it('leaves dedicated confidential notes and OAuth connections denied by default generic CRUD', () => {
    expect(crudGovernanceFor(schema.bargainingNotes).class).toBe('DENIED')
    expect(crudGovernanceFor(schema.externalCalendarConnections).class).toBe('DENIED')
  })

  it('refuses generic writes for every class except OPERATIONAL, and generic reads only for DENIED', () => {
    expect(() => assertCrudWrite({ class: 'OPERATIONAL' })).not.toThrow()
    for (const cls of ['DENIED', 'OWN_ROWS_READ', 'READ_ONLY'] as const) expect(() => assertCrudWrite({ class: cls })).toThrow()
    expect(() => assertCrudRead({ class: 'DENIED' })).toThrow()
    for (const cls of ['OWN_ROWS_READ', 'READ_ONLY', 'OPERATIONAL'] as const) expect(() => assertCrudRead({ class: cls })).not.toThrow()
  })

  it('lets a subject-owned table be used only through an owner-scoped route', () => {
    expect(() => assertCrudRead({ class: 'SUBJECT_OWNED' })).toThrow()
    expect(() => assertCrudWrite({ class: 'SUBJECT_OWNED' })).toThrow()
    expect(() => assertCrudRead({ class: 'SUBJECT_OWNED', hasOwnerColumn: true })).not.toThrow()
    expect(() => assertCrudWrite({ class: 'SUBJECT_OWNED', hasOwnerColumn: true })).not.toThrow()
  })

  it('treats a table with no entry as DENIED', () => {
    expect(crudGovernanceFor({} as never).class).toBe('DENIED')
  })

  it('limits an own-rows table to the caller at every role, including staff', () => {
    const mode = lowRoleModeFor((schema as unknown as Record<string, never>).claims, false)
    expect(mode.kind).toBe('own')
    expect(ownRowsScope(mode, 'user_member_1').condition).toBeDefined()
    expect(() => ownRowsScope(mode, null)).toThrow()
    expect(() => ownRowsScope({ kind: 'open' }, 'user_member_1')).toThrow()
    expect(() => ownRowsScope({ kind: 'deny' }, 'user_member_1')).toThrow()
  })

  it('wires the gate into every generic handler', () => {
    const factory = readFileSync(join(ROOT, 'lib', 'api', 'crud-factory.ts'), 'utf8')
    expect((factory.match(/assertCrudWrite\(governance\)/g) ?? []).length).toBe(3)
    expect((factory.match(/await readScope\(userId, organizationId\)/g) ?? []).length).toBe(2)
  })

  it('performs every generic write inside the audited transaction, never directly on the shared connection', () => {
    const factory = readFileSync(join(ROOT, 'lib', 'api', 'crud-factory.ts'), 'utf8')
    expect(factory).not.toMatch(/\bdb\s*\.\s*(insert|update|delete)\(/)
    // R-52 added a separate audited locked DELETE path alongside the original
    // soft/hard-delete fallbacks; each generic write still uses audited(...).
    expect((factory.match(/await audited\(/g) ?? []).length).toBe(6)
  })
})
