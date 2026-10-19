import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { storageAuthorityManifest } from '../../db/rls-storage-authority/index'
import {
  DEADLINE_ENGINE_RLS_TABLES,
  isFailClosed,
  isLegacyRestored,
  type DeadlineTableState,
} from '../apply-deadline-engine-rls-closure'

const MIGRATIONS = join(__dirname, '..', '..', 'db', 'migrations')
const apply = readFileSync(join(MIGRATIONS, '20261018_deadline_engine_rls_fail_closed_closure.sql'), 'utf8')
const rollback = readFileSync(join(MIGRATIONS, '20261018_deadline_engine_rls_fail_closed_closure_rollback.sql'), 'utf8')
const code = (sql: string) => sql.replace(/--.*$/gm, '')

const state = (over: Partial<DeadlineTableState> = {}): DeadlineTableState[] =>
  DEADLINE_ENGINE_RLS_TABLES.map((tbl) => ({
    tbl,
    rls: true,
    force: true,
    runtimePolicy: true,
    systemPolicy: true,
    publicPolicy: false,
    ...over,
  }))

describe('deadline-engine RLS fail-closed closure', () => {
  it('covers exactly the three deadline-engine queue/audit tables', () => {
    expect([...DEADLINE_ENGINE_RLS_TABLES].sort()).toEqual([
      'deadline_audit_events',
      'deadline_reminder_executions',
      'deadline_reminders',
    ])
  })

  it('every table is RLS-required in the storage-authority manifest', () => {
    for (const table of DEADLINE_ENGINE_RLS_TABLES) {
      const entry = (storageAuthorityManifest as ReadonlyArray<{ table: string; classification: string }>).find(
        (e) => e.table === table,
      )
      expect(entry, table).toBeDefined()
      expect(entry!.classification, table).toMatch(/RLS_REQUIRED$/)
    }
  })

  it('removes every legacy fail-open policy and re-creates none of them', () => {
    for (const policy of [
      'deadline_reminders_tenant_isolation',
      'deadline_audit_events_tenant_isolation',
      'deadline_reminder_executions_read',
    ]) {
      expect(code(apply), policy).toContain(`DROP POLICY IF EXISTS ${policy}`)
      expect(code(apply), policy).not.toContain(`CREATE POLICY ${policy}`)
    }
    expect(code(apply)).not.toMatch(/COALESCE\s*\(\s*NULLIF/i)
  })

  it('reuses the existing helpers and adds no grants, ad-hoc policies or bypass', () => {
    expect(code(apply)).not.toMatch(/\bGRANT\b|\bREVOKE\b|\bBYPASSRLS\b|DROP\s+TABLE/i)
    expect(code(apply)).not.toMatch(/CREATE\s+POLICY/i)
    expect(apply).toContain('ue_create_direct_org_rls_policy')
    expect(apply).toContain('ue_create_parent_owned_rls_policy_v2')
  })

  it('asserts RLS, FORCE, runtime+system policies and no PUBLIC policy, or aborts', () => {
    expect(apply).toContain('relrowsecurity')
    expect(apply).toContain('relforcerowsecurity')
    expect(apply).toContain("'union_eyes_runtime'::regrole")
    expect(apply).toContain("'union_eyes_system'::regrole")
    expect(apply).toContain('0::oid = ANY (p.polroles)')
    expect(apply).toContain('RAISE EXCEPTION')
  })

  it('rollback restores the three legacy policies and the executions NO FORCE state without grants', () => {
    for (const policy of [
      'deadline_reminders_tenant_isolation',
      'deadline_audit_events_tenant_isolation',
      'deadline_reminder_executions_read',
    ]) {
      expect(code(rollback), policy).toContain(`CREATE POLICY ${policy}`)
    }
    expect(rollback).toContain('NO FORCE ROW LEVEL SECURITY')
    expect(code(rollback)).not.toMatch(/\bGRANT\b|\bREVOKE\b/i)
  })

  it('state predicates distinguish fail-closed, legacy and partial states', () => {
    expect(isFailClosed(state())).toBe(true)
    expect(isFailClosed(state({ publicPolicy: true }))).toBe(false)
    expect(isFailClosed(state({ force: false }))).toBe(false)
    expect(isFailClosed(state().slice(1))).toBe(false)
    expect(isLegacyRestored(state({ publicPolicy: true }))).toBe(true)
    expect(isLegacyRestored(state())).toBe(false)
  })
})
