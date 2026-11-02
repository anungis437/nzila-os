/**
 * UE-CONV-H-010 on real PostgreSQL: the enhanced RBAC (role_definitions, member_roles, permission_exceptions, rbac_audit_log).
 *
 * db/queries/enhanced-rbac-queries.ts and lib/enterprise-role-middleware.ts run unmodified, through the postgres.js driver the application uses (a raw `tx.execute`
 * returns the row list there, not a result object), as the real union_eyes_runtime and union_eyes_system roles under FORCE row-level security. What this holds:
 *   - the seed of platform 0076 is the code catalog (levels, permissions) and holds no platform-elevated role;
 *   - the runtime role can read the four relations and write none of them; the system role writes and deletes nothing;
 *   - an organization's session reads nothing of another organization's roles, exceptions or audit trail, even when the query names that organization;
 *   - a member of one organization cannot be given a role or an exception under another, a role must be an active role of the catalog, a live assignment is unique,
 *     a role that needs approval is not live until approved, and a term that has ended or has not begun is not live;
 *   - an exception cannot be used past its limit (not even by concurrent requests), and a revoked or expired one is not live;
 *   - the audit log is a per-organization SHA-256 chain that stays a line under concurrent writers, is append-only (for the owner too), takes one review once,
 *     and its verification finds an edited or a deleted entry, also across a page boundary;
 *   - the middleware over all of it: a one-use exception grants once, the use is counted, the next request is denied, and both decisions are on the trail.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database.
 */
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { sql } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { PermissionCheckEntry } from '@/db/queries/enhanced-rbac-queries'
import { serializeRawDates } from '@/db/driver-dates'

const URL = process.env.UE_AUTHORITY_COMBINED_URL
type Statement = ReturnType<typeof sql>
const state = vi.hoisted(() => ({
  run: null as null | ((role: string, organizationId: string, work: (tx: unknown) => Promise<unknown>) => Promise<unknown>),
  org: '',
  ctx: null as unknown,
}))

// The tenant read binds the session's organization (state.org); the system role runs with no organization, as withSystemContext does.
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: (work: (tx: unknown) => Promise<unknown>) => state.run!('union_eyes_runtime', state.org, work),
  withSystemRLSContext: (_reason: string, work: (tx: unknown) => Promise<unknown>) => state.run!('union_eyes_system', '', work),
}))
vi.mock('@/lib/organization-middleware', () => ({
  withOrganizationAuth: (handler: (request: unknown, context: unknown) => unknown) => async (request: unknown) => handler(request, state.ctx),
}))

const q = URL ? await import('@/db/queries/enhanced-rbac-queries') : null
const middleware = URL ? await import('@/lib/enterprise-role-middleware') : null
const catalog = URL ? await import('@/lib/auth/roles') : null

const DAY = 86_400_000
const SYSTEM_TABLES = ['role_definitions', 'member_roles', 'permission_exceptions', 'rbac_audit_log'] as const

// The SQLSTATE of a failed statement, through the wrappers drizzle puts around the driver's error.
function codeOf(error: unknown): string | undefined {
  let current = error as { code?: unknown; cause?: unknown } | undefined
  for (let depth = 0; current && depth < 5; depth += 1) {
    if (typeof current.code === 'string' && /^[0-9A-Z]{5}$/.test(current.code)) return current.code
    current = current.cause as typeof current
  }
  return undefined
}
const isCode = (code: string) => (error: unknown) => codeOf(error) === code
const codeOfRun = async (work: () => Promise<unknown>): Promise<string> => {
  try {
    await work()
    return 'no error'
  } catch (error) {
    return codeOf(error) ?? `unclassified: ${(error as Error).message}`
  }
}

describe.skipIf(!URL)('the enhanced RBAC on the combined schema, as the real runtime and system roles', () => {
  const sfx = randomUUID().slice(0, 8)
  const ORG_A = randomUUID()
  const ORG_B = randomUUID()
  let admin: pg.Client
  let client: ReturnType<typeof postgres>
  let memberB: string

  const exec = async (tx: unknown, query: Statement): Promise<Record<string, unknown>[]> =>
    Array.from(await (tx as { execute: (statement: unknown) => Promise<Iterable<Record<string, unknown>>> }).execute(query))
  const asRuntime = async <T>(org: string, work: (tx: unknown) => Promise<T>): Promise<T> => (await state.run!('union_eyes_runtime', org, work)) as T
  const asSystem = async <T>(work: (tx: unknown) => Promise<T>): Promise<T> => (await state.run!('union_eyes_system', '', work)) as T
  // A tenant call of the module: the session is bound to `org` for the call.
  const asTenant = <T>(org: string, call: () => Promise<T>): Promise<T> => {
    state.org = org
    return call()
  }
  const ids = (rows: Array<{ id?: unknown }>) => rows.map((row) => row.id)
  const level = (role: string) => catalog!.getRoleLevel(role as never)
  const permissionsOf = (role: string) => [...new Set<string>((catalog!.ROLE_PERMISSIONS as Record<string, string[]>)[role])]

  const newMember = async (org: string, label = 'm'): Promise<string> =>
    (
      await admin.query(
        `INSERT INTO organization_members (id, user_id, organization_id, name, email, role, status, is_primary, created_at, updated_at, metadata)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, 'member', 'active', false, now(), now(), '{}'::jsonb) RETURNING id::text id`,
        [`rbac-${label}-${randomUUID().slice(0, 8)}`, org, `Member ${label}`, `${label}-${randomUUID().slice(0, 8)}@example.test`],
      )
    ).rows[0].id as string

  // An audit entry written through the module, for an organization that needs no organizations row (the trail names the organization, it does not reference it).
  const entry = (organizationId: string, i: number, extra: Partial<PermissionCheckEntry> = {}): PermissionCheckEntry => ({
    actorId: 'chain-actor',
    action: 'check_permission',
    resourceType: 'claim',
    resourceId: `claim-${i}`,
    organizationId,
    granted: i % 2 === 0,
    requiredPermission: 'view_all_claims',
    ...(i % 2 === 0 ? {} : { denialReason: 'Missing permission: view_all_claims' }),
    ...extra,
  })
  // The cast is aliased apart from the column: ORDER BY would otherwise resolve to the text alias and sort 10 before 6.
  const chainOf = async (organizationId: string) =>
    (await admin.query(`SELECT id::text id, sequence_number::text AS seq, record_hash, previous_hash, granted FROM rbac_audit_log WHERE organization_id = $1 ORDER BY sequence_number`, [organizationId])).rows

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: URL })
    await admin.connect()
    client = postgres(URL!, { max: 12, onnotice: () => undefined })
    const db = drizzle(client)
    // as every production client does (db/driver-dates.ts)
    serializeRawDates(client)
    state.run = (role, organizationId, work) =>
      db.transaction(async (tx) => {
        await tx.execute(sql.raw(`SET LOCAL ROLE ${role}`))
        await tx.execute(sql`SELECT set_config('app.current_org_id', ${organizationId}, true), set_config('app.current_user_id', '', true)`)
        return work(tx)
      })
    for (const [org, slug] of [
      [ORG_A, `rb-a-${sfx}`],
      [ORG_B, `rb-b-${sfx}`],
    ]) {
      await admin.query(
        `INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
         VALUES ($1,$2,$3,'local','{}',0,'{}',false,0,0,'{}','{}','active',now(),now(),1)`,
        [org, slug, slug],
      )
    }
    memberB = await newMember(ORG_B, 'b1')
  }, 120_000)

  afterAll(async () => {
    await client?.end({ timeout: 5 }).catch(() => undefined)
    await admin?.end().catch(() => undefined)
  })

  // ── the schema the bootstrap built ─────────────────────────────────────────
  describe('the relations as bootstrapped', () => {
    it('seeds the organization roles of the code catalog, at the level and with the permissions the code gives them, and no other role', async () => {
      const rows = (await admin.query(`SELECT role_code, role_level, permissions, is_active FROM role_definitions WHERE is_system_role`)).rows
      expect(rows.map((row) => row.role_code).sort()).toEqual([...catalog!.TENANT_LOCAL_ROLES].sort())
      for (const row of rows) {
        expect(row.role_level, `${row.role_code} level`).toBe(level(row.role_code))
        expect([...row.permissions].sort(), `${row.role_code} permissions`).toEqual(permissionsOf(row.role_code).sort())
        expect(row.is_active).toBe(true)
      }
      const notOrganizationRoles = Object.values(catalog!.UserRole).filter((role) => !(catalog!.TENANT_LOCAL_ROLES as readonly string[]).includes(role))
      const seededButNotOrganizationRole = await admin.query(`SELECT role_code FROM role_definitions WHERE role_code = ANY($1)`, [notOrganizationRoles])
      expect(seededButNotOrganizationRole.rows).toEqual([])
    })

    it('grants the runtime role SELECT only and the system role SELECT, INSERT and UPDATE (no DELETE, no TRUNCATE), with row security forced on the tenant relations', async () => {
      const held = async (role: string, table: string) =>
        (
          await admin.query(
            `SELECT p FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE']) AS p WHERE has_table_privilege($1, $2, p) ORDER BY p`,
            [role, `public.${table}`],
          )
        ).rows.map((row) => row.p)
      for (const table of SYSTEM_TABLES) {
        expect(await held('union_eyes_runtime', table), `runtime on ${table}`).toEqual(['SELECT'])
        expect(await held('union_eyes_system', table), `system on ${table}`).toEqual(['INSERT', 'SELECT', 'UPDATE'])
      }
      const security = (await admin.query(`SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE oid = ANY($1::regclass[]) ORDER BY relname`, [SYSTEM_TABLES.map((t) => `public.${t}`)])).rows
      expect(security).toEqual([
        { relname: 'member_roles', relrowsecurity: true, relforcerowsecurity: true },
        { relname: 'permission_exceptions', relrowsecurity: true, relforcerowsecurity: true },
        { relname: 'rbac_audit_log', relrowsecurity: true, relforcerowsecurity: true },
        { relname: 'role_definitions', relrowsecurity: false, relforcerowsecurity: false },
      ])
    })

    it('refuses every write from the runtime role, under the organization it is bound to', async () => {
      const m = await newMember(ORG_A)
      const attempts: Array<[string, Statement]> = [
        ['insert member_roles', sql`INSERT INTO member_roles (member_id, organization_id, role_code, created_by) VALUES (${m}::uuid, ${ORG_A}::uuid, 'steward', 'x')`],
        ['update member_roles', sql`UPDATE member_roles SET status = 'suspended' WHERE organization_id = ${ORG_A}::uuid`],
        ['delete member_roles', sql`DELETE FROM member_roles WHERE organization_id = ${ORG_A}::uuid`],
        ['insert permission_exceptions', sql`INSERT INTO permission_exceptions (member_id, organization_id, permission, resource_type, reason, approved_by) VALUES (${m}::uuid, ${ORG_A}::uuid, 'x', 'claim', 'r', 'a')`],
        ['update permission_exceptions', sql`UPDATE permission_exceptions SET usage_count = 0 WHERE organization_id = ${ORG_A}::uuid`],
        ['insert rbac_audit_log', sql`INSERT INTO rbac_audit_log (actor_id, action, resource_type, organization_id, granted, record_hash) VALUES ('a', 'x', 'claim', ${ORG_A}::uuid, true, 'h')`],
        ['update rbac_audit_log', sql`UPDATE rbac_audit_log SET granted = true WHERE organization_id = ${ORG_A}::uuid`],
        ['insert role_definitions', sql`INSERT INTO role_definitions (role_code, role_name, role_level, permissions) VALUES ('rogue', 'Rogue', 999, '["*"]'::jsonb)`],
        ['update role_definitions', sql`UPDATE role_definitions SET role_level = 999 WHERE role_code = 'member'`],
      ]
      for (const [name, statement] of attempts) {
        expect(await codeOfRun(() => asRuntime(ORG_A, (tx) => exec(tx, statement))), name).toBe('42501')
      }
      for (const table of SYSTEM_TABLES) {
        expect(await codeOfRun(() => asSystem((tx) => exec(tx, sql.raw(`DELETE FROM ${table}`)))), `system DELETE on ${table}`).toBe('42501')
        expect(await codeOfRun(() => asSystem((tx) => exec(tx, sql.raw(`TRUNCATE ${table}`)))), `system TRUNCATE on ${table}`).toBe('42501')
      }
    })
  })

  // ── role definitions ───────────────────────────────────────────────────────
  describe('role definitions', () => {
    it('creates a custom role as a non-system role that cannot reuse a catalog code, and a member can hold it', async () => {
      const code = `rbac_custom_${sfx}`
      const custom = await q!.createRoleDefinition(code, 'Custom', 35, ['b_perm', 'a_perm', 'a_perm'], { createdBy: 'admin', description: 'for the native proof' })
      expect(custom).toMatchObject({ roleCode: code, roleName: 'Custom', roleLevel: 35, isSystemRole: false, isActive: true, permissions: ['a_perm', 'b_perm'], createdBy: 'admin' })
      await expect(q!.createRoleDefinition(code, 'Again', 10, [])).rejects.toSatisfy(isCode('23505'))
      await expect(q!.createRoleDefinition('steward', 'Steward again', 10, [])).rejects.toSatisfy(isCode('23505'))
      expect(await q!.getRoleDefinitionByCode(code)).toMatchObject({ roleCode: code })
      expect(await q!.getRoleDefinitionByCode(`no_such_${sfx}`)).toBeNull()
      expect((await q!.getRoleDefinitionsByLevel(100)).every((role) => role.roleLevel >= 100)).toBe(true)
      const all = await q!.getAllRoleDefinitions()
      expect(all.length).toBeGreaterThanOrEqual(12)
      expect(all.map((role) => role.roleLevel)).toEqual([...all.map((role) => role.roleLevel)].sort((a, b) => b - a))

      const m = await newMember(ORG_A)
      await q!.assignMemberRole(m, ORG_A, code, 'admin')
      expect(await asTenant(ORG_A, () => q!.getMemberEffectivePermissions(m, ORG_A))).toEqual(['a_perm', 'b_perm'])
      expect(await asTenant(ORG_A, () => q!.getMemberHighestRoleLevel(m, ORG_A))).toBe(35)
    })
  })

  // ── assigning and reading roles ────────────────────────────────────────────
  describe('member roles', () => {
    it('assigns as the system role and reads, as the tenant, the role with its names, level, permissions and term', async () => {
      const m = await newMember(ORG_A, 'reader')
      const assigned = await q!.assignMemberRole(m, ORG_A, 'steward', 'admin-user', { scopeType: 'department', scopeValue: 'Fabrication' })
      expect(assigned).toMatchObject({ memberId: m, organizationId: ORG_A, roleCode: 'steward', scopeType: 'department', scopeValue: 'Fabrication', status: 'active', assignmentType: 'appointed', createdBy: 'admin-user', isActingRole: false, requiresApproval: false })
      const [role] = await asTenant(ORG_A, () => q!.getMemberRoles(m, ORG_A))
      const definition = (await admin.query(`SELECT role_name FROM role_definitions WHERE role_code = 'steward'`)).rows[0]
      expect(role).toMatchObject({ id: assigned.id, roleCode: 'steward', roleName: definition.role_name, roleLevel: level('steward'), scopeType: 'department', scopeValue: 'Fabrication', memberName: 'Member reader', termStatus: 'indefinite', isElected: false })
      expect(role.memberEmail).toMatch(/^reader-.+@example\.test$/)
      expect(new Set(role.permissions)).toEqual(new Set(permissionsOf('steward')))
    })

    it('merges the permissions of every role a member holds, takes the highest level, and honors scope', async () => {
      const m = await newMember(ORG_A, 'multi')
      await q!.assignMemberRole(m, ORG_A, 'steward', 'u', { scopeType: 'department', scopeValue: 'HR' })
      await q!.assignMemberRole(m, ORG_A, 'chief_steward', 'u')
      expect(await asTenant(ORG_A, () => q!.getMemberHighestRoleLevel(m, ORG_A))).toBe(level('chief_steward'))
      const merged = await asTenant(ORG_A, () => q!.getMemberEffectivePermissions(m, ORG_A))
      expect(new Set(merged)).toEqual(new Set([...permissionsOf('steward'), ...permissionsOf('chief_steward')]))
      expect(merged.length).toBe(new Set(merged).size)
      const has = (code: string, scopeType?: string, scopeValue?: string) => asTenant(ORG_A, () => q!.memberHasRole(m, ORG_A, code, scopeType, scopeValue))
      const atLeast = (minimum: number, scopeType?: string, scopeValue?: string) => asTenant(ORG_A, () => q!.memberHasRoleLevel(m, ORG_A, minimum, scopeType, scopeValue))
      expect(await has('steward', 'department', 'HR')).toBe(true)
      expect(await has('steward', 'department', 'Finance')).toBe(false)
      expect(await has('steward')).toBe(true)
      expect(await has('president')).toBe(false)
      // the global chief_steward role covers every scope
      expect(await atLeast(level('steward'), 'department', 'Finance')).toBe(true)
      expect(await atLeast(level('president'))).toBe(false)
    })

    it('shows an organization nothing of another, even when the query names that organization', async () => {
      const m = await newMember(ORG_A, 'isolated')
      await q!.assignMemberRole(m, ORG_A, 'officer', 'u')
      await q!.assignMemberRole(memberB, ORG_B, 'member', 'u')
      expect(await asTenant(ORG_A, () => q!.getMemberRoles(m, ORG_A))).toHaveLength(1)
      expect(await asTenant(ORG_B, () => q!.getMemberRoles(m, ORG_A))).toEqual([])
      expect(await asTenant(ORG_B, () => q!.getMemberHighestRoleLevel(m, ORG_A))).toBe(0)
      expect(await asTenant(ORG_B, () => q!.getMemberEffectivePermissions(m, ORG_A))).toEqual([])
      expect(await asTenant(ORG_B, () => q!.memberHasRole(m, ORG_A, 'officer'))).toBe(false)
      expect(await asTenant(ORG_B, () => q!.memberHasRoleLevel(m, ORG_A, 1))).toBe(false)
      expect(ids(await asTenant(ORG_B, () => q!.getExpiringRoles(ORG_A, 365)))).toEqual([])
      // and what B does read is its own
      expect(await asTenant(ORG_B, () => q!.getMemberRoles(memberB, ORG_B))).toHaveLength(1)
      const seenByB = await asRuntime(ORG_B, (tx) => exec(tx, sql`SELECT DISTINCT organization_id::text AS organization_id FROM member_roles`))
      expect(seenByB).toEqual([{ organization_id: ORG_B }])
    })

    it('refuses a member of another organization, a role outside the catalog and an inactive role', async () => {
      const m = await newMember(ORG_A, 'guarded')
      // memberB belongs to organization B: naming organization A does not make them A's member
      await expect(q!.assignMemberRole(memberB, ORG_A, 'steward', 'u')).rejects.toSatisfy(isCode('23503'))
      await expect(q!.grantPermissionException(memberB, ORG_A, 'edit_all_claims', 'claim', 'why', 'u')).rejects.toSatisfy(isCode('23503'))
      await expect(q!.assignMemberRole(m, ORG_A, 'officer', 'u', { assignmentType: 'acting', isActingRole: true, actingForMemberId: memberB, actingReason: 'cover' })).rejects.toSatisfy(isCode('23503'))
      // a platform role is not in the catalog: a role row in tenant data cannot carry one
      await expect(q!.assignMemberRole(m, ORG_A, 'system_admin', 'u')).rejects.toSatisfy(isCode('23503'))
      await expect(q!.assignMemberRole(m, ORG_A, `no_such_role_${sfx}`, 'u')).rejects.toSatisfy(isCode('23503'))
      const inactive = await q!.createRoleDefinition(`rbac_inactive_${sfx}`, 'Inactive', 20, [])
      await admin.query(`UPDATE role_definitions SET is_active = false WHERE role_code = $1`, [inactive.roleCode])
      await expect(q!.assignMemberRole(m, ORG_A, inactive.roleCode, 'u')).rejects.toSatisfy(isCode('23503'))
      expect(await asTenant(ORG_A, () => q!.getMemberRoles(m, ORG_A))).toEqual([])
    })

    it('holds a role that needs approval out of force until it is approved, once, and refuses to activate it any other way', async () => {
      const m = await newMember(ORG_A, 'approval')
      const pending = await q!.assignMemberRole(m, ORG_A, 'president', 'u', { requiresApproval: true })
      expect(pending).toMatchObject({ status: 'pending_approval', requiresApproval: true, approvedBy: null })
      expect(await asTenant(ORG_A, () => q!.getMemberRoles(m, ORG_A))).toEqual([])
      expect(await asTenant(ORG_A, () => q!.getMemberHighestRoleLevel(m, ORG_A))).toBe(0)

      const other = await q!.assignMemberRole(m, ORG_A, 'secretary_treasurer', 'u', { requiresApproval: true })
      await expect(q!.updateMemberRole(other.id, ORG_A, 'u', { status: 'active' })).rejects.toSatisfy(isCode('23514'))

      expect(await q!.approveMemberRole(pending.id, ORG_B, 'board-chair')).toBeNull()
      const approved = await q!.approveMemberRole(pending.id, ORG_A, 'board-chair', 'minuted')
      expect(approved).toMatchObject({ status: 'active', approvedBy: 'board-chair', approvalNotes: 'minuted' })
      expect(approved!.approvalDate).toBeInstanceOf(Date)
      expect(await asTenant(ORG_A, () => q!.getMemberHighestRoleLevel(m, ORG_A))).toBe(level('president'))
      expect(await q!.approveMemberRole(pending.id, ORG_A, 'someone-else', 'again')).toBeNull()
    })

    it('counts a term only between its start and its end, and expires the ended ones', async () => {
      const m = await newMember(ORG_A, 'terms')
      const ended = await q!.assignMemberRole(m, ORG_A, 'officer', 'u', { startDate: new Date(Date.now() - 3 * DAY), endDate: new Date(Date.now() - DAY) })
      const notYet = await q!.assignMemberRole(m, ORG_A, 'steward', 'u', { startDate: new Date(Date.now() + 2 * DAY) })
      expect(await asTenant(ORG_A, () => q!.getMemberRoles(m, ORG_A))).toEqual([])
      expect(await asTenant(ORG_A, () => q!.getMemberHighestRoleLevel(m, ORG_A))).toBe(0)
      expect(await q!.expireOldTerms()).toBeGreaterThanOrEqual(1)
      const statuses = (await admin.query(`SELECT id::text id, status FROM member_roles WHERE id = ANY($1::uuid[])`, [[ended.id, notYet.id]])).rows
      expect(Object.fromEntries(statuses.map((row) => [row.id, row.status]))).toEqual({ [ended.id]: 'expired', [notYet.id]: 'active' })
      // a role that has not begun can be revoked: its term ends where it would have started, never before
      expect(await q!.revokeMemberRole(notYet.id, ORG_A, 'u', 'withdrawn')).toBe(true)
      const revoked = (await admin.query(`SELECT status, end_date = start_date AS ends_at_start FROM member_roles WHERE id = $1`, [notYet.id])).rows[0]
      expect(revoked).toEqual({ status: 'expired', ends_at_start: true })
    })

    it('keeps a live assignment unique, lets a revoked one be assigned again, and keeps the history', async () => {
      const m = await newMember(ORG_A, 'unique')
      const first = await q!.assignMemberRole(m, ORG_A, 'steward', 'u')
      await expect(q!.assignMemberRole(m, ORG_A, 'steward', 'u')).rejects.toSatisfy(isCode('23505'))
      await q!.assignMemberRole(m, ORG_A, 'steward', 'u', { scopeType: 'department', scopeValue: 'HR' })
      // two requests together: one wins
      const together = await Promise.allSettled([
        q!.assignMemberRole(m, ORG_A, 'officer', 'u'),
        q!.assignMemberRole(m, ORG_A, 'officer', 'u'),
      ])
      expect(together.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1)
      expect(codeOf((together.find((outcome) => outcome.status === 'rejected') as PromiseRejectedResult).reason)).toBe('23505')

      expect(await q!.revokeMemberRole(first.id, ORG_B, 'u')).toBe(false)
      expect(await q!.revokeMemberRole(first.id, ORG_A, 'u', 'term ended')).toBe(true)
      expect(await q!.revokeMemberRole(first.id, ORG_A, 'u')).toBe(false)
      await q!.assignMemberRole(m, ORG_A, 'steward', 'u')
      const history = (await admin.query(`SELECT status, suspension_reason, suspended_by, end_date IS NOT NULL AS ended FROM member_roles WHERE id = $1`, [first.id])).rows[0]
      expect(history).toEqual({ status: 'expired', suspension_reason: 'term ended', suspended_by: 'u', ended: true })

      const suspended = await q!.assignMemberRole(m, ORG_A, 'bargaining_committee', 'u')
      await q!.updateMemberRole(suspended.id, ORG_A, 'u', { status: 'suspended', suspensionReason: 'investigation', suspendedBy: 'president' })
      expect(ids(await asTenant(ORG_A, () => q!.getMemberRoles(m, ORG_A)))).not.toContain(suspended.id)
      // a suspended assignment still holds its place
      await expect(q!.assignMemberRole(m, ORG_A, 'bargaining_committee', 'u')).rejects.toSatisfy(isCode('23505'))
    })

    it('lists the terms ending and the elections coming inside a window, for the organization only', async () => {
      const m = await newMember(ORG_A, 'window')
      const role = await q!.assignMemberRole(m, ORG_A, 'health_safety_rep', 'u', {
        assignmentType: 'elected',
        termYears: 2,
        endDate: new Date(Date.now() + 10 * DAY),
        nextElectionDate: new Date(Date.now() + 30 * DAY),
        electionDate: new Date(Date.now() - 5 * DAY),
        voteCount: 55,
        totalVotes: 100,
      })
      expect(role.votePercentage).toBe(55)
      await expect(q!.assignMemberRole(await newMember(ORG_A, 'votes'), ORG_A, 'steward', 'u', { voteCount: 120, totalVotes: 100 })).rejects.toSatisfy(isCode('23514'))
      expect(ids(await asTenant(ORG_A, () => q!.getExpiringRoles(ORG_A, 30)))).toContain(role.id)
      expect(ids(await asTenant(ORG_A, () => q!.getExpiringRoles(ORG_A, 5)))).not.toContain(role.id)
      expect(ids(await asTenant(ORG_A, () => q!.getUpcomingElections(ORG_A, 60)))).toContain(role.id)
      expect(ids(await asTenant(ORG_A, () => q!.getUpcomingElections(ORG_A, 10)))).not.toContain(role.id)
      expect(ids(await asTenant(ORG_B, () => q!.getExpiringRoles(ORG_A, 365)))).toEqual([])
      expect(ids(await asTenant(ORG_B, () => q!.getUpcomingElections(ORG_A, 365)))).toEqual([])
      const [detail] = await asTenant(ORG_A, () => q!.getMemberRoles(m, ORG_A))
      expect(detail.termStatus).toBe('expiring_soon')
    })
  })

  // ── permission exceptions ──────────────────────────────────────────────────
  describe('permission exceptions', () => {
    it('is live for the resource it names (or any, when it names none) and for as many uses as its limit', async () => {
      const m = await newMember(ORG_A, 'exception')
      const exception = await q!.grantPermissionException(m, ORG_A, 'edit_all_claims', 'claim', 'urgent file', 'president', { usageLimit: 2, resourceId: 'claim-1' })
      expect(exception).toMatchObject({ memberId: m, organizationId: ORG_A, permission: 'edit_all_claims', resourceType: 'claim', resourceId: 'claim-1', usageCount: 0, usageLimit: 2, isActive: true, approvedBy: 'president' })
      const find = (resourceId?: string) => asTenant(ORG_A, () => q!.findLivePermissionException(m, ORG_A, 'edit_all_claims', 'claim', resourceId))
      expect(await find('claim-1')).toBe(exception.id)
      expect(await find('claim-2')).toBeNull()
      expect(await asTenant(ORG_A, () => q!.findLivePermissionException(m, ORG_A, 'edit_all_claims', 'grievance', 'claim-1'))).toBeNull()
      expect(ids(await asTenant(ORG_A, () => q!.getMemberPermissionExceptions(m, ORG_A)))).toEqual([exception.id])
      expect(await asTenant(ORG_B, () => q!.findLivePermissionException(m, ORG_A, 'edit_all_claims', 'claim', 'claim-1'))).toBeNull()

      expect(await q!.incrementExceptionUsage(exception.id, ORG_B)).toBe(false)
      expect(await q!.incrementExceptionUsage(exception.id, ORG_A)).toBe(true)
      expect(await q!.incrementExceptionUsage(exception.id, ORG_A)).toBe(true)
      expect(await q!.incrementExceptionUsage(exception.id, ORG_A)).toBe(false)
      expect(await find('claim-1')).toBeNull()
      expect(await asTenant(ORG_A, () => q!.memberHasPermissionException(m, ORG_A, 'edit_all_claims', 'claim', 'claim-1'))).toBe(false)
      const stored = (await admin.query(`SELECT usage_count, last_used_at IS NOT NULL AS used FROM permission_exceptions WHERE id = $1`, [exception.id])).rows[0]
      expect(stored).toEqual({ usage_count: 2, used: true })

      const general = await q!.grantPermissionException(m, ORG_A, 'edit_all_claims', 'claim', 'any claim', 'president')
      expect(await find('claim-2')).toBe(general.id)
      expect(await asTenant(ORG_A, () => q!.memberHasPermissionException(m, ORG_A, 'edit_all_claims'))).toBe(true)
    })

    it('never passes its limit, not even when requests use the last uses together', async () => {
      const m = await newMember(ORG_A, 'concurrent')
      const exception = await q!.grantPermissionException(m, ORG_A, 'approve_claim', 'claim', 'burst', 'president', { usageLimit: 3 })
      const outcomes = await Promise.all(Array.from({ length: 10 }, () => q!.incrementExceptionUsage(exception.id, ORG_A)))
      expect(outcomes.filter(Boolean)).toHaveLength(3)
      expect((await admin.query(`SELECT usage_count FROM permission_exceptions WHERE id = $1`, [exception.id])).rows[0].usage_count).toBe(3)
    })

    it('is not live once revoked, expired or not yet effective, and the database refuses an expiry before the start', async () => {
      const m = await newMember(ORG_A, 'lifecycle')
      const grant = (options: Parameters<NonNullable<typeof q>['grantPermissionException']>[6]) => q!.grantPermissionException(m, ORG_A, 'view_financial', 'report', 'review', 'president', options)
      const live = (id: string) => asTenant(ORG_A, async () => ids(await q!.getMemberPermissionExceptions(m, ORG_A)).includes(id))

      const revoked = await grant({})
      expect(await live(revoked.id)).toBe(true)
      expect(await q!.revokePermissionException(revoked.id, ORG_B, 'u')).toBe(false)
      expect(await q!.revokePermissionException(revoked.id, ORG_A, 'u', 'no longer needed')).toBe(true)
      expect(await q!.revokePermissionException(revoked.id, ORG_A, 'u')).toBe(false)
      expect(await live(revoked.id)).toBe(false)
      expect((await admin.query(`SELECT is_active, revoked_by, revocation_reason, revoked_at IS NOT NULL AS revoked FROM permission_exceptions WHERE id = $1`, [revoked.id])).rows[0]).toEqual({ is_active: false, revoked_by: 'u', revocation_reason: 'no longer needed', revoked: true })

      const expired = await grant({ effectiveDate: new Date(Date.now() - 3 * DAY), expiresAt: new Date(Date.now() - DAY) })
      expect(await live(expired.id)).toBe(false)
      expect(await q!.incrementExceptionUsage(expired.id, ORG_A)).toBe(false)
      const later = await grant({ effectiveDate: new Date(Date.now() + DAY) })
      expect(await live(later.id)).toBe(false)
      expect(await q!.incrementExceptionUsage(later.id, ORG_A)).toBe(false)

      await expect(grant({ expiresAt: new Date(Date.now() - 60_000) })).rejects.toSatisfy(isCode('23514'))
      // revoking by hand must say so: a revoked row that stays active is refused
      const active = await grant({})
      await expect(admin.query(`UPDATE permission_exceptions SET revoked_at = now() WHERE id = $1`, [active.id])).rejects.toMatchObject({ code: '23514' })
    })
  })

  // ── the audit trail ────────────────────────────────────────────────────────
  describe('the audit trail', () => {
    const CHAIN = randomUUID()
    const chainIds: string[] = []

    it('links every entry of an organization to the one before it, and starts each organization afresh', async () => {
      for (let i = 0; i < 4; i += 1) chainIds.push(await q!.recordPermissionCheck(entry(CHAIN, i)))
      const other = randomUUID()
      await q!.recordPermissionCheck(entry(other, 0))
      const rows = await chainOf(CHAIN)
      expect(rows.map((row) => row.id)).toEqual(chainIds)
      expect(rows[0].previous_hash).toBeNull()
      for (let i = 1; i < rows.length; i += 1) {
        expect(rows[i].previous_hash, `entry ${i}`).toBe(rows[i - 1].record_hash)
        expect(Number(rows[i].seq)).toBeGreaterThan(Number(rows[i - 1].seq))
      }
      expect((await chainOf(other))[0].previous_hash).toBeNull()
      expect(await q!.verifyAuditLogIntegrity(CHAIN)).toEqual({ valid: true, totalRecords: 4, invalidRecords: 0 })
      expect(await q!.verifyAuditLogIntegrity(randomUUID())).toEqual({ valid: true, totalRecords: 0, invalidRecords: 0 })
    })

    it('stays a line under concurrent writers: no two entries share a predecessor and verification holds', async () => {
      const busy = randomUUID()
      await Promise.all(Array.from({ length: 10 }, (_, i) => q!.recordPermissionCheck(entry(busy, i))))
      const rows = await chainOf(busy)
      const shape = rows.map((row) => `${row.seq}:${String(row.record_hash).slice(0, 6)}<-${row.previous_hash === null ? 'null' : String(row.previous_hash).slice(0, 6)}`).join(' ')
      expect(rows, shape).toHaveLength(10)
      expect(rows[0].previous_hash, shape).toBeNull()
      for (let i = 1; i < rows.length; i += 1) expect(rows[i].previous_hash, `entry ${i}: ${shape}`).toBe(rows[i - 1].record_hash)
      expect(new Set(rows.map((row) => row.previous_hash)).size, shape).toBe(10)
      expect(await q!.verifyAuditLogIntegrity(busy)).toEqual({ valid: true, totalRecords: 10, invalidRecords: 0 })
    })

    it('reads the trail of the organization the session is bound to, newest first, and nothing of another', async () => {
      const mine = await asTenant(CHAIN, () => q!.getMemberAuditLogs('chain-actor', CHAIN, { limit: 3 }))
      expect(mine).toHaveLength(3)
      expect(typeof mine[0].sequenceNumber).toBe('number')
      expect(mine.map((row) => row.sequenceNumber)).toEqual([...mine.map((row) => row.sequenceNumber)].sort((a, b) => b - a))
      expect(mine[0]).toMatchObject({ id: chainIds[3], actorId: 'chain-actor', organizationId: CHAIN, action: 'check_permission', resourceType: 'claim', granted: false, denialReason: 'Missing permission: view_all_claims' })
      const denied = await asTenant(CHAIN, () => q!.getDeniedAccessAttempts(CHAIN, 24))
      expect(denied).toHaveLength(2)
      expect(denied.every((row) => row.granted === false)).toBe(true)
      expect((await asTenant(CHAIN, () => q!.getMemberAuditLogs('chain-actor', CHAIN, { grantedOnly: true }))).every((row) => row.granted)).toBe(true)
      expect(ids(await asTenant(CHAIN, () => q!.getResourceAuditLogs('claim', 'claim-2', CHAIN)))).toEqual([chainIds[2]])
      for (const read of [
        () => q!.getMemberAuditLogs('chain-actor', CHAIN),
        () => q!.getDeniedAccessAttempts(CHAIN, 24),
        () => q!.getResourceAuditLogs('claim', 'claim-2', CHAIN),
        () => q!.getSensitiveActionsForReview(CHAIN),
      ]) {
        expect(await asTenant(ORG_B, read)).toEqual([])
      }
    })

    it('refuses to change or delete an entry, as the system role and as the owner, and to truncate the trail', async () => {
      const target = chainIds[1]
      const changes: Array<[string, Statement]> = [
        ['the decision', sql`UPDATE rbac_audit_log SET granted = NOT granted WHERE id = ${target}::uuid`],
        ['the hash', sql`UPDATE rbac_audit_log SET record_hash = 'x' WHERE id = ${target}::uuid`],
        ['the actor', sql`UPDATE rbac_audit_log SET actor_id = 'someone-else' WHERE id = ${target}::uuid`],
        ['the organization', sql`UPDATE rbac_audit_log SET organization_id = ${ORG_A}::uuid WHERE id = ${target}::uuid`],
      ]
      for (const [name, statement] of changes) expect(await codeOfRun(() => asSystem((tx) => exec(tx, statement))), `system changes ${name}`).toBe('23001')
      await expect(admin.query(`DELETE FROM rbac_audit_log WHERE id = $1`, [target])).rejects.toMatchObject({ code: '23001' })
      await expect(admin.query(`UPDATE rbac_audit_log SET granted = NOT granted WHERE id = $1`, [target])).rejects.toMatchObject({ code: '23001' })
      await expect(admin.query(`TRUNCATE rbac_audit_log`)).rejects.toMatchObject({ code: '23001' })
      expect(await q!.verifyAuditLogIntegrity(CHAIN)).toMatchObject({ valid: true, totalRecords: 4 })
    })

    it('queues a sensitive decision for review and takes one review, once, in the organization it was made in', async () => {
      const sensitive = await q!.recordPermissionCheck(entry(CHAIN, 1, { isSensitive: true, action: 'delete_claim' }))
      const pending = () => asTenant(CHAIN, async () => ids(await q!.getSensitiveActionsForReview(CHAIN)))
      expect(await pending()).toEqual([sensitive])
      expect(await q!.markAuditEntryReviewed(sensitive, ORG_A, 'auditor')).toBe(false)
      expect(await q!.markAuditEntryReviewed(chainIds[0], CHAIN, 'auditor')).toBe(false)
      expect(await q!.markAuditEntryReviewed(sensitive, CHAIN, 'auditor', 'reviewed against the minutes')).toBe(true)
      expect(await q!.markAuditEntryReviewed(sensitive, CHAIN, 'someone-else', 'again')).toBe(false)
      expect(await pending()).toEqual([])
      const stored = (await admin.query(`SELECT reviewed_by, review_notes, reviewed_at IS NOT NULL AS reviewed FROM rbac_audit_log WHERE id = $1`, [sensitive])).rows[0]
      expect(stored).toEqual({ reviewed_by: 'auditor', review_notes: 'reviewed against the minutes', reviewed: true })
      // a recorded review is never rewritten, and the review columns are outside the hash
      await expect(admin.query(`UPDATE rbac_audit_log SET review_notes = 'changed' WHERE id = $1`, [sensitive])).rejects.toMatchObject({ code: '23001' })
      expect(await q!.verifyAuditLogIntegrity(CHAIN)).toMatchObject({ valid: true, totalRecords: 5 })
    })

    it('writes without waiting when logged through logPermissionCheck, and the entry lands on the chain', async () => {
      const quiet = randomUUID()
      await q!.logPermissionCheck(entry(quiet, 0))
      await vi.waitFor(async () => expect((await chainOf(quiet)).length).toBe(1), { timeout: 10_000, interval: 100 })
      expect(await q!.verifyAuditLogIntegrity(quiet)).toMatchObject({ valid: true, totalRecords: 1 })
    })

    describe('verification', () => {
      // The owner can disable the guard; verification is what finds what was done while it was off.
      const withGuardOff = async (work: () => Promise<unknown>) => {
        await admin.query(`ALTER TABLE rbac_audit_log DISABLE TRIGGER rbac_audit_log_append_only`)
        try {
          await work()
        } finally {
          await admin.query(`ALTER TABLE rbac_audit_log ENABLE TRIGGER rbac_audit_log_append_only`)
        }
      }

      it('finds an entry edited behind the guard, and names it', async () => {
        const org = randomUUID()
        const written: string[] = []
        for (let i = 0; i < 5; i += 1) written.push(await q!.recordPermissionCheck(entry(org, i)))
        await withGuardOff(() => admin.query(`UPDATE rbac_audit_log SET granted = NOT granted WHERE id = $1`, [written[2]]))
        expect(await q!.verifyAuditLogIntegrity(org)).toEqual({ valid: false, totalRecords: 5, invalidRecords: 1, firstInvalidRecordId: written[2] })
        expect(await q!.verifyAuditLogIntegrity(CHAIN)).toMatchObject({ valid: true })
      })

      it('finds an entry deleted behind the guard, where the next entry names a hash that is no longer before it', async () => {
        const org = randomUUID()
        const written: string[] = []
        for (let i = 0; i < 5; i += 1) written.push(await q!.recordPermissionCheck(entry(org, i)))
        await withGuardOff(() => admin.query(`DELETE FROM rbac_audit_log WHERE id = $1`, [written[1]]))
        expect(await q!.verifyAuditLogIntegrity(org)).toEqual({ valid: false, totalRecords: 4, invalidRecords: 1, firstInvalidRecordId: written[2] })
      })

      it('walks a trail longer than one page, and finds an edit on the second page', async () => {
        const org = randomUUID()
        const total = q!.AUDIT_VERIFY_PAGE + 40
        const written: string[] = []
        const base = Date.now() - total * 10
        let previous: string | null = null
        await admin.query('BEGIN')
        try {
          for (let i = 0; i < total; i += 1) {
            const id = randomUUID()
            const at = new Date(base + i * 10)
            const hash = q!.computeAuditRecordHash(previous, { organizationId: org, timestamp: at, actorId: 'bulk', action: 'check_permission', resourceType: 'claim', resourceId: `claim-${i}`, granted: true })
            await admin.query(
              `INSERT INTO rbac_audit_log (id, timestamp, actor_id, action, resource_type, resource_id, organization_id, granted, record_hash, previous_hash) VALUES ($1,$2,'bulk','check_permission','claim',$3,$4,true,$5,$6)`,
              [id, at, `claim-${i}`, org, hash, previous],
            )
            written.push(id)
            previous = hash
          }
          await admin.query('COMMIT')
        } catch (error) {
          await admin.query('ROLLBACK')
          throw error
        }
        expect(await q!.verifyAuditLogIntegrity(org)).toEqual({ valid: true, totalRecords: total, invalidRecords: 0 })
        const late = written[q!.AUDIT_VERIFY_PAGE + 10]
        await withGuardOff(() => admin.query(`UPDATE rbac_audit_log SET action = 'edited' WHERE id = $1`, [late]))
        expect(await q!.verifyAuditLogIntegrity(org)).toEqual({ valid: false, totalRecords: total, invalidRecords: 1, firstInvalidRecordId: late })
      }, 120_000)
    })
  })

  // ── the middleware over the real queries ───────────────────────────────────
  describe('the enhanced middleware', () => {
    it('grants a one-use exception once, counts the use, denies the next request, and puts both decisions on the trail', async () => {
      const m = await newMember(ORG_A, 'mw')
      await q!.assignMemberRole(m, ORG_A, 'member', 'admin')
      const exception = await q!.grantPermissionException(m, ORG_A, 'edit_all_claims', 'claim', 'one-off', 'president', { usageLimit: 1 })
      state.ctx = { organizationId: ORG_A, userId: `user-${m}`, memberId: m }
      state.org = ORG_A
      const handler = vi.fn(async () => NextResponse.json({ ok: true }))
      const route = middleware!.withPermission('edit_all_claims', handler, { resourceType: 'claim', auditAction: 'edit_claim' }) as unknown as (request: NextRequest) => Promise<NextResponse>
      const call = async () => (await route(new NextRequest('http://localhost/api/claims/1'))).status

      expect(await call()).toBe(200)
      expect(await call()).toBe(403)
      expect(handler).toHaveBeenCalledTimes(1)
      expect((await admin.query(`SELECT usage_count FROM permission_exceptions WHERE id = $1`, [exception.id])).rows[0].usage_count).toBe(1)

      await vi.waitFor(
        async () => {
          const rows = (await admin.query(`SELECT granted, grant_method, denial_reason, action FROM rbac_audit_log WHERE organization_id = $1 AND actor_id = $2`, [ORG_A, m])).rows
          expect(rows).toHaveLength(2)
          expect(rows).toEqual(
            expect.arrayContaining([
              { granted: true, grant_method: 'exception', denial_reason: null, action: 'edit_claim' },
              { granted: false, grant_method: null, denial_reason: 'Missing permission: edit_all_claims', action: 'edit_claim' },
            ]),
          )
        },
        { timeout: 10_000, interval: 100 },
      )
      expect(await q!.verifyAuditLogIntegrity(ORG_A)).toMatchObject({ valid: true })
    })

    it('grants through a role without touching an exception, and denies a member with no role at all', async () => {
      const withRole = await newMember(ORG_A, 'mw-role')
      await q!.assignMemberRole(withRole, ORG_A, 'steward', 'admin')
      const bare = await newMember(ORG_A, 'mw-bare')
      state.org = ORG_A
      const handler = vi.fn(async () => NextResponse.json({ ok: true }))
      const route = middleware!.withPermission('view_own_claims', handler, { resourceType: 'claim' }) as unknown as (request: NextRequest) => Promise<NextResponse>
      state.ctx = { organizationId: ORG_A, userId: `user-${withRole}`, memberId: withRole }
      expect((await route(new NextRequest('http://localhost/api/claims/1'))).status).toBe(200)
      state.ctx = { organizationId: ORG_A, userId: `user-${bare}`, memberId: bare }
      expect((await route(new NextRequest('http://localhost/api/claims/1'))).status).toBe(403)
      expect(handler).toHaveBeenCalledTimes(1)
      await vi.waitFor(
        async () => {
          const rows = (await admin.query(`SELECT actor_id, granted, grant_method FROM rbac_audit_log WHERE organization_id = $1 AND actor_id = ANY($2)`, [ORG_A, [withRole, bare]])).rows
          expect(rows).toEqual(expect.arrayContaining([{ actor_id: withRole, granted: true, grant_method: 'role' }, { actor_id: bare, granted: false, grant_method: null }]))
        },
        { timeout: 10_000, interval: 100 },
      )
    })
  })
})
