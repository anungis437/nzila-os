import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { storageAuthorityManifest } from '../../db/rls-storage-authority/index'
import {
  isFullyEnforced,
  isUnenforced,
  RLS_CLOSURE_TABLES,
  type TableState,
} from '../apply-prod-rls-closure-twelve-tables'

const MIGRATIONS = join(__dirname, '..', '..', 'db', 'migrations')
const apply = readFileSync(join(MIGRATIONS, '20261005_prod_rls_closure_twelve_tables.sql'), 'utf8')
const rollback = readFileSync(join(MIGRATIONS, '20261005_prod_rls_closure_twelve_tables_rollback.sql'), 'utf8')
const code = (sql: string) => sql.replace(/--.*$/gm, '')

const state = (over: Partial<TableState> = {}): TableState[] =>
  RLS_CLOSURE_TABLES.map((tbl) => ({
    tbl,
    rls: true,
    force: true,
    policies: 5,
    runtimePolicy: true,
    systemPolicy: true,
    ...over,
  }))

describe('CHG-2026-0110 RLS closure (12 tables)', () => {
  it('covers exactly 12 distinct tables', () => {
    expect(RLS_CLOSURE_TABLES).toHaveLength(12)
    expect(new Set(RLS_CLOSURE_TABLES).size).toBe(12)
  })

  it('every table is RLS-required in the storage-authority manifest', () => {
    for (const table of RLS_CLOSURE_TABLES) {
      const entry = (storageAuthorityManifest as ReadonlyArray<{ table: string; classification: string }>).find(
        (e) => e.table === table,
      )
      expect(entry, table).toBeDefined()
      expect(entry!.classification, table).toMatch(/RLS_REQUIRED$/)
    }
  })

  it('migration and rollback name every table', () => {
    for (const table of RLS_CLOSURE_TABLES) {
      expect(apply, table).toContain(`'${table}'`)
      expect(rollback, table).toContain(`'${table}'`)
    }
  })

  it('migration only reuses existing helpers and adds no grants, permissive policies or bypass', () => {
    expect(code(apply)).not.toMatch(/\bGRANT\b/i)
    expect(code(apply)).not.toMatch(/\bBYPASSRLS\b/i)
    expect(code(apply)).not.toMatch(/CREATE\s+POLICY/i)
    expect(code(apply)).not.toMatch(/DROP\s+TABLE/i)
    expect(apply).toContain('ue_create_user_rls_policy')
    expect(apply).toContain('ue_create_parent_owned_via_user_rls_policy_v2')
    expect(apply).toContain('ue_create_direct_org_rls_policy')
  })

  it('migration asserts RLS, FORCE and runtime+system policies for all tables or aborts', () => {
    expect(apply).toContain('relrowsecurity')
    expect(apply).toContain('relforcerowsecurity')
    expect(apply).toContain("'union_eyes_runtime'::regrole")
    expect(apply).toContain('RAISE EXCEPTION')
  })

  it('rollback restores the pre-change state without touching grants', () => {
    expect(rollback).toContain('NO FORCE ROW LEVEL SECURITY')
    expect(rollback).toContain('DISABLE ROW LEVEL SECURITY')
    expect(code(rollback)).not.toMatch(/\bGRANT\b|\bREVOKE\b/i)
  })

  it('state predicates distinguish enforced, unenforced and partial states', () => {
    expect(isFullyEnforced(state())).toBe(true)
    expect(isFullyEnforced(state({ force: false }))).toBe(false)
    expect(isFullyEnforced(state().slice(1))).toBe(false)
    expect(isUnenforced(state({ rls: false, force: false, policies: 0, runtimePolicy: false, systemPolicy: false }))).toBe(true)
    expect(isUnenforced(state())).toBe(false)
  })
})
