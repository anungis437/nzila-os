/**
 * Conversation lifecycle, legal hold, retention and read markers (lib/messaging/thread-lifecycle, thread-read-state,
 * staff-liveness) against the COMBINED deployed schema (Django `migrate` + the approved Drizzle bootstrap, platform 0014
 * and 0025, RLS 0021 and 0024), with the real application code running as the `union_eyes_runtime` role under forced
 * row-level security and the exact grants the storage-authority manifest activates. Nothing is mirrored; the PGlite suite
 * (lib/messaging/thread-lifecycle.pglite.test.ts) has no real roles, RLS or manifest grants.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a FRESH disposable database (same preparation
 * as thread-assignment.postgres.test.ts). The suite installs a fault trigger on the audit tables of that database. Not a
 * staging isolation pass, not a credentialed acceptance.
 */
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { sql } from 'drizzle-orm'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { seedMembership, type Db } from './authority-kernel-harness'
import type { CaseActor } from '@/lib/cases/case-authorization'
import type { RLSTx } from '@/lib/db/with-rls-context'

const URL = process.env.UE_AUTHORITY_COMBINED_URL

const state = vi.hoisted(() => ({ db: null as unknown }))

type Tx = { execute: (q: unknown) => Promise<unknown> }
type Role = 'union_eyes_runtime' | 'union_eyes_system'
async function inRole<T>(role: Role, org: string, user: string, work: (tx: RLSTx) => Promise<T>): Promise<T> {
  return (state.db as { transaction: (f: (tx: Tx) => Promise<T>) => Promise<T> }).transaction(async (tx) => {
    await tx.execute(sql.raw(`SET LOCAL ROLE ${role}`))
    await tx.execute(sql`SELECT set_config('app.current_user_id', ${user}, true), set_config('app.current_org_id', ${org}, true)`)
    return work(tx as unknown as RLSTx)
  })
}

const access = URL ? await import('@/lib/messaging/thread-access') : null
const assignment = URL ? await import('@/lib/messaging/thread-assignment') : null
const lifecycle = URL ? await import('@/lib/messaging/thread-lifecycle') : null
const readState = URL ? await import('@/lib/messaging/thread-read-state') : null
const designations = URL ? await import('@/lib/triage/designations') : null

describe.skipIf(!URL)('conversation lifecycle, retention and read markers on the combined deployed schema, as the runtime role', () => {
  const ORG_A = randomUUID()
  const ORG_B = randomUUID()
  const sfx = randomUUID().slice(0, 8)
  const U = {
    admin: `ml-admin-${sfx}`, triager: `ml-triager-${sfx}`, steward: `ml-steward-${sfx}`, steward2: `ml-steward2-${sfx}`,
    member: `ml-member-${sfx}`, member2: `ml-member2-${sfx}`, foreign: `ml-foreign-${sfx}`, foreignMember: `ml-fmember-${sfx}`, ghost: `ml-ghost-${sfx}`,
  }
  const BODY = 'PRIVATE-BODY-TEXT-7731'
  const SUBJECT = 'PRIVATE-SUBJECT-4417'
  const DAY = 86_400_000
  let admin: pg.Client
  let pool: pg.Pool

  const actor = (userId: string, role: CaseActor['role'] = 'steward', organizationId = ORG_A): CaseActor => ({ userId, organizationId, role })
  const member = actor(U.member, 'member')
  const member2 = actor(U.member2, 'member')
  const steward = actor(U.steward)
  const steward2 = actor(U.steward2)
  const adminActor = actor(U.admin, 'admin')
  const eligible = new Set([U.steward, U.steward2, U.triager])
  const deps = { assigneeEligible: async (userId: string) => eligible.has(userId) }

  const as = <T>(a: { userId: string; organizationId: string }, work: (tx: RLSTx) => Promise<T>) => inRole('union_eyes_runtime', a.organizationId, a.userId, work)
  const count = async (query: string, params: unknown[] = []) => Number((await admin.query(query, params)).rows[0].n)
  const audits = (action: string, resourceId?: string) =>
    count(
      `SELECT (SELECT count(*) FROM audit_security.audit_logs WHERE action = $1 AND organization_id = $2 AND ($3::text IS NULL OR resource_id::text = $3))
            + (SELECT count(*) FROM public.audit_logs WHERE action = $1 AND organization_id = $2 AND ($3::text IS NULL OR resource_id = $3)) AS n`,
      [action, ORG_A, resourceId ?? null],
    )
  const failAudit = (action: string) => admin.query(`INSERT INTO ue_msg_audit_faults(action) VALUES ($1) ON CONFLICT DO NOTHING`, [action])
  const clearFaults = () => admin.query(`DELETE FROM ue_msg_audit_faults`)
  const rejectsWith = async (promise: Promise<unknown>, pattern: RegExp) => {
    const error = (await promise.then(() => null, (e: unknown) => e)) as { message?: string; cause?: { message?: string } } | null
    expect(error, 'expected the statement to be refused').not.toBeNull()
    expect(`${error!.message} ${error!.cause?.message ?? ''}`).toMatch(pattern)
  }
  const raw = <T = unknown>(a: { userId: string; organizationId: string }, query: ReturnType<typeof sql>) => as(a, (tx) => (tx as unknown as Tx).execute(query) as Promise<T>)

  async function mkThread(memberId: string, opts: { staffId?: string | null; status?: string; org?: string } = {}) {
    const id = randomUUID()
    await admin.query(`INSERT INTO message_threads (id, subject, member_id, staff_id, organization_id, status) VALUES ($1,$2,$3,$4,$5,$6)`, [id, SUBJECT, memberId, opts.staffId ?? null, opts.org ?? ORG_A, opts.status ?? 'open'])
    await admin.query(`INSERT INTO messages (thread_id, sender_id, sender_role, content) VALUES ($1,$2,'member',$3)`, [id, memberId, BODY])
    return id
  }
  const setMembership = (userId: string, patch: { status?: string; role?: string; deleted?: boolean }) =>
    admin.query(`UPDATE organization_members SET status = coalesce($2, status), role = coalesce($3, role), deleted_at = CASE WHEN $4::boolean THEN now() ELSE NULL END WHERE user_id = $1 AND organization_id = $5`, [
      userId, patch.status ?? null, patch.role ?? null, patch.deleted ?? false, ORG_A,
    ])
  const status = async (id: string) => (await admin.query(`SELECT status, is_archived FROM message_threads WHERE id = $1`, [id])).rows[0] as { status: string; is_archived: boolean }
  const lifecycleRows = (id: string) => count(`SELECT count(*) AS n FROM message_thread_lifecycle WHERE thread_id = $1`, [id])

  beforeAll(async () => {
    vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '0')
    admin = new pg.Client({ connectionString: URL })
    await admin.connect()
    const d: Db = { exec: (s) => admin.query(s), query: (s, p) => admin.query(s, p as unknown[]) as never }
    for (const [org, slug] of [[ORG_A, `ml-a-${sfx}`], [ORG_B, `ml-b-${sfx}`]]) {
      await admin.query(
        `INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
         VALUES ($1,$2,$3,'local','{}',0,'{}',false,0,0,'{}','{}','active',now(),now(),1)`,
        [org, slug, slug],
      )
    }
    const roster: Array<[string, string, string]> = [
      [U.admin, ORG_A, 'admin'], [U.triager, ORG_A, 'steward'], [U.steward, ORG_A, 'steward'], [U.steward2, ORG_A, 'steward'],
      [U.member, ORG_A, 'member'], [U.member2, ORG_A, 'member'], [U.foreign, ORG_B, 'steward'], [U.foreignMember, ORG_B, 'member'],
    ]
    for (const [user, org, role] of roster) {
      await seedMembership(d, user, org, role)
      // Outside Canonical V2 a staff actor's live membership is read per request from the compatibility projection.
      await admin.query(
        `INSERT INTO organization_members (id, created_at, updated_at, user_id, role, status, is_primary, organization_id) VALUES (gen_random_uuid(), now(), now(), $1, $2, 'active', false, $3)`,
        [user, role, org],
      )
    }
    // Fault injection on both audit sinks of the disposable database, so rollback is proven against the real audit paths.
    await admin.query(`CREATE TABLE IF NOT EXISTS ue_msg_audit_faults (action text PRIMARY KEY)`)
    await admin.query(`GRANT SELECT ON ue_msg_audit_faults TO PUBLIC`)
    await admin.query(`CREATE OR REPLACE FUNCTION ue_msg_audit_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF EXISTS (SELECT 1 FROM ue_msg_audit_faults WHERE action = NEW.action) THEN RAISE EXCEPTION 'injected audit fault'; END IF; RETURN NEW; END $$`)
    for (const table of ['audit_security.audit_logs', 'public.audit_logs']) {
      await admin.query(`DROP TRIGGER IF EXISTS ue_msg_audit_fault_trg ON ${table}`)
      await admin.query(`CREATE TRIGGER ue_msg_audit_fault_trg BEFORE INSERT ON ${table} FOR EACH ROW EXECUTE FUNCTION ue_msg_audit_fault()`)
    }
    pool = new pg.Pool({ connectionString: URL, max: 4 })
    state.db = drizzle(pool)
  }, 120_000)

  afterAll(async () => {
    vi.unstubAllEnvs()
    for (const table of ['audit_security.audit_logs', 'public.audit_logs']) await admin?.query(`DROP TRIGGER IF EXISTS ue_msg_audit_fault_trg ON ${table}`).catch(() => undefined)
    await pool?.end()
    await admin?.end()
  })
  afterEach(async () => {
    vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '0')
    await clearFaults()
  })

  it('applies the manifest privileges: append-only conversation records, no DELETE anywhere, row security forced, and no system-role access', async () => {
    const has = async (role: Role, table: string, privilege: string) =>
      (await admin.query(`SELECT has_table_privilege($1, $2::regclass, $3) AS ok`, [role, table, privilege])).rows[0].ok as boolean
    const expected: Record<string, string[]> = {
      message_threads: ['INSERT', 'SELECT', 'UPDATE'],
      messages: ['INSERT', 'SELECT'],
      message_thread_lifecycle: ['INSERT', 'SELECT'],
      message_thread_assignments: ['INSERT', 'SELECT'],
      message_thread_reads: ['INSERT', 'SELECT', 'UPDATE'],
      message_retention_policies: ['INSERT', 'SELECT', 'UPDATE'],
    }
    for (const [table, granted] of Object.entries(expected)) {
      for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) {
        expect(await has('union_eyes_runtime', table, privilege), `${table} ${privilege}`).toBe(granted.includes(privilege))
      }
      expect(await has('union_eyes_system', table, 'SELECT'), `system ${table}`).toBe(false)
    }
    // Code paths touch these two compatibility/notification tables as well; the runtime must read the former and write the latter.
    expect(await has('union_eyes_runtime', 'organization_members', 'SELECT')).toBe(true)
    expect(await has('union_eyes_runtime', 'in_app_notifications', 'INSERT')).toBe(true)
    const forced = (await admin.query(`SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = ANY($1::text[]) AND relkind = 'r'`, [Object.keys(expected)])).rows
    expect(forced).toHaveLength(Object.keys(expected).length)
    expect(forced.every((r) => r.relrowsecurity && r.relforcerowsecurity)).toBe(true)
  })

  it('creates a conversation as the member, tenant-bound and audited without content, invisible to every other tenant and member', async () => {
    const created = await as(member, (tx) => access!.createMemberThread(tx, member, { subject: SUBJECT, body: BODY }))
    expect(await audits('messages.thread.create', created.id)).toBe(1)
    expect((await as(member, (tx) => access!.listThreads(tx, member))).map((t) => t.id)).toContain(created.id)
    expect(await as(member2, (tx) => access!.listThreads(tx, member2))).toEqual([])
    expect(await as(member2, (tx) => access!.findReadableThread(tx, member2, created.id))).toBeNull()
    const foreignMember = actor(U.foreignMember, 'member', ORG_B)
    expect(await as(foreignMember, (tx) => access!.findReadableThread(tx, foreignMember, created.id))).toBeNull()
    // Row security hides every conversation relation from another tenant, and refuses a forged write into this one.
    for (const table of ['message_threads', 'messages', 'message_thread_lifecycle', 'message_thread_reads', 'message_retention_policies', 'message_thread_assignments']) {
      const rows = await raw<{ rows: Array<{ n: number }> }>(foreignMember, sql.raw(`SELECT count(*)::int AS n FROM ${table}`))
      expect(rows.rows[0].n, table).toBe(0)
    }
    await rejectsWith(raw(foreignMember, sql`INSERT INTO message_threads (subject, member_id, organization_id) VALUES ('x', ${U.foreignMember}, ${ORG_A})`), /row-level security/)
    await rejectsWith(raw(foreignMember, sql`INSERT INTO messages (thread_id, sender_id, sender_role, content) VALUES (${created.id}, ${U.foreignMember}, 'member', 'forged')`), /row-level security|violates/)
    expect(await count(`SELECT count(*) AS n FROM messages WHERE content = 'forged'`)).toBe(0)
    // A failed audit stores neither the thread nor its first message.
    await failAudit('messages.thread.create')
    const before = await count(`SELECT count(*) AS n FROM message_threads WHERE organization_id = $1`, [ORG_A])
    await rejectsWith(as(member, (tx) => access!.createMemberThread(tx, member, { subject: 'will not persist', body: 'x' })), /injected audit fault/)
    expect(await count(`SELECT count(*) AS n FROM message_threads WHERE organization_id = $1`, [ORG_A])).toBe(before)
  })

  describe('revocation: staff access is read live from the membership, in the same transaction', () => {
    it.each([
      ['membership made inactive', { status: 'inactive' }],
      ['membership suspended', { status: 'suspended' }],
      ['membership soft-deleted', { deleted: true }],
      ['membership demoted to member', { role: 'member' }],
    ] as const)('an assignee whose %s can no longer list, read, reply, close or mark read', async (_label, patch) => {
      const id = await mkThread(U.member, { staffId: U.steward })
      expect((await as(steward, (tx) => access!.listThreads(tx, steward))).map((t) => t.id)).toContain(id)
      expect(await as(steward, (tx) => access!.postThreadMessage(tx, steward, id, { body: 'while live' }))).toMatchObject({ kind: 'ok' })

      await setMembership(U.steward, patch)
      try {
        const messagesBefore = await count(`SELECT count(*) AS n FROM messages`)
        expect(await as(steward, (tx) => access!.listThreads(tx, steward))).toEqual([])
        expect(await as(steward, (tx) => access!.findReadableThread(tx, steward, id))).toBeNull()
        expect(await as(steward, (tx) => access!.listThreadMessages(tx, steward, id))).toBeNull()
        expect(await as(steward, (tx) => access!.postThreadMessage(tx, steward, id, { body: 'after revocation' }))).toEqual({ kind: 'not_found' })
        expect(await as(steward, (tx) => lifecycle!.changeThreadLifecycle(tx, steward, id, 'close'))).toEqual({ kind: 'not_found' })
        expect(await as(steward, (tx) => readState!.markThreadRead(tx, steward, id))).toEqual({ kind: 'not_found' })
        expect(await as(steward, (tx) => readState!.getThreadDetail(tx, steward, id))).toBeNull()
        expect(await count(`SELECT count(*) AS n FROM messages`)).toBe(messagesBefore)
        // The member is unaffected.
        expect((await as(member, (tx) => access!.listThreads(tx, member))).map((t) => t.id)).toContain(id)
      } finally {
        await setMembership(U.steward, { status: 'active', role: 'steward' })
      }
      expect((await as(steward, (tx) => access!.listThreads(tx, steward))).map((t) => t.id)).toContain(id)
    })

    it('a staff member with no membership row at all, or one only in another organization, sees nothing', async () => {
      const id = await mkThread(U.member, { staffId: U.ghost })
      const ghost = actor(U.ghost)
      expect(await as(ghost, (tx) => access!.listThreads(tx, ghost))).toEqual([])
      expect(await as(ghost, (tx) => access!.findReadableThread(tx, ghost, id))).toBeNull()
      await admin.query(`INSERT INTO organization_members (id, created_at, updated_at, user_id, role, status, is_primary, organization_id) VALUES (gen_random_uuid(), now(), now(), $1, 'steward', 'active', false, $2)`, [U.ghost, ORG_B])
      expect(await as(ghost, (tx) => access!.findReadableThread(tx, ghost, id))).toBeNull()
    })

    it('a reassigned or released assignment ends the previous assignee\'s access at once', async () => {
      const id = await mkThread(U.member, { staffId: U.steward })
      expect(await as(steward, (tx) => assignment!.assignThread(tx, steward, { threadId: id, action: 'reassign', toStaffId: U.steward2 }, deps))).toMatchObject({ kind: 'ok' })
      expect(await as(steward, (tx) => access!.findReadableThread(tx, steward, id))).toBeNull()
      expect(await as(steward, (tx) => access!.postThreadMessage(tx, steward, id, { body: 'no longer mine' }))).toEqual({ kind: 'not_found' })
      expect(await as(steward2, (tx) => access!.findReadableThread(tx, steward2, id))).not.toBeNull()
      expect(await as(steward2, (tx) => assignment!.assignThread(tx, steward2, { threadId: id, action: 'release' }, deps))).toMatchObject({ kind: 'ok' })
      expect(await as(steward2, (tx) => access!.findReadableThread(tx, steward2, id))).toBeNull()
    })

    it('a revoked designation stops the queue, and so does an inactive membership behind a live designation', async () => {
      const id = await mkThread(U.member2)
      const granted = await as(adminActor, (tx) => designations!.grantDesignation(tx, adminActor, { scope: 'messages', userId: U.triager, expiresAt: new Date(Date.now() + 30 * DAY) }, deps))
      expect(granted.kind).toBe('ok')
      const triager = actor(U.triager)
      expect((await as(triager, (tx) => assignment!.listTriageQueue(tx, triager)))!.map((q) => q.id)).toContain(id)

      await setMembership(U.triager, { status: 'inactive' })
      expect(await as(triager, (tx) => assignment!.listTriageQueue(tx, triager))).toBeNull()
      expect(await as(triager, (tx) => assignment!.assignThread(tx, triager, { threadId: id, action: 'assign', toStaffId: U.steward }, deps))).toEqual({ kind: 'not_found' })
      await setMembership(U.triager, { status: 'active' })
      expect((await as(triager, (tx) => assignment!.listTriageQueue(tx, triager)))!.map((q) => q.id)).toContain(id)

      const live = (await admin.query(`SELECT id FROM triage_designations WHERE organization_id = $1 AND scope = 'messages' AND user_id = $2 AND revoked_at IS NULL`, [ORG_A, U.triager])).rows[0].id
      expect(await as(adminActor, (tx) => designations!.revokeDesignation(tx, adminActor, live))).toEqual({ kind: 'ok' })
      expect(await as(triager, (tx) => assignment!.listTriageQueue(tx, triager))).toBeNull()
      expect(await as(triager, (tx) => assignment!.assignThread(tx, triager, { threadId: id, action: 'assign', toStaffId: U.steward }, deps))).toEqual({ kind: 'not_found' })
      expect(await count(`SELECT count(*) AS n FROM message_thread_assignments WHERE thread_id = $1`, [id])).toBe(0)
    })

    it('reads the membership through the canonical predicate when Canonical V2 is on, as the runtime role', async (ctx) => {
      // The predicate belongs to the Canonical V2 auth topology (db/auth/case-assignee-predicate.ts), which the combined
      // Django + legacy-bootstrap database does not install. Without it this path is NOT proven here: skip, do not pass.
      const installed = await admin.query(`SELECT 1 FROM pg_proc WHERE proname = 'ue_case_assignee_authorized'`)
      if (installed.rows.length === 0) return ctx.skip()
      const id = await mkThread(U.member, { staffId: U.steward })
      vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '1')
      // The predicate reads the canonical user_management membership seeded above, never the compatibility projection.
      expect(await as(steward, (tx) => access!.findReadableThread(tx, steward, id))).not.toBeNull()
      await admin.query(`UPDATE user_management.organization_users SET is_active = false WHERE user_id = $1 AND organization_id = $2`, [U.steward, ORG_A])
      try {
        expect(await as(steward, (tx) => access!.findReadableThread(tx, steward, id))).toBeNull()
      } finally {
        await admin.query(`UPDATE user_management.organization_users SET is_active = true WHERE user_id = $1 AND organization_id = $2`, [U.steward, ORG_A])
      }
      expect(await as(steward, (tx) => access!.findReadableThread(tx, steward, id))).not.toBeNull()
    })
  })

  describe('close and archive', () => {
    it('lets the member close, records how, audits without content, and ends replies for both sides', async () => {
      const id = await mkThread(U.member, { staffId: U.steward })
      expect(await as(member, (tx) => lifecycle!.changeThreadLifecycle(tx, member, id, 'close'))).toEqual({ kind: 'ok', action: 'close' })
      expect((await admin.query(`SELECT action, acted_by, acted_via, reference FROM message_thread_lifecycle WHERE thread_id = $1`, [id])).rows).toEqual([{ action: 'close', acted_by: U.member, acted_via: 'thread_member', reference: null }])
      expect(await status(id)).toEqual({ status: 'closed', is_archived: false })
      expect(await audits('messages.thread.close', id)).toBe(1)
      expect(await as(member, (tx) => access!.postThreadMessage(tx, member, id, { body: 'x' }))).toEqual({ kind: 'closed' })
      expect(await as(steward, (tx) => access!.postThreadMessage(tx, steward, id, { body: 'x' }))).toEqual({ kind: 'closed' })
      expect(await as(steward, (tx) => lifecycle!.changeThreadLifecycle(tx, steward, id, 'close'))).toEqual({ kind: 'conflict', code: 'ALREADY_CLOSED' })
      // The content stays readable to both participants.
      expect((await as(steward, (tx) => access!.listThreadMessages(tx, steward, id)))!.map((m) => m.content)).toEqual([BODY])
    })

    it('lets the current assignee close and archive, and nobody else', async () => {
      const id = await mkThread(U.member, { staffId: U.steward })
      const foreignMember = actor(U.member, 'member', ORG_B)
      for (const outsider of [steward2, member2, actor(U.triager), foreignMember]) {
        expect(await as(outsider, (tx) => lifecycle!.changeThreadLifecycle(tx, outsider, id, 'close'))).toEqual({ kind: 'not_found' })
      }
      expect(await as(steward, (tx) => lifecycle!.changeThreadLifecycle(tx, steward, id, 'archive'))).toEqual({ kind: 'conflict', code: 'NOT_CLOSED' })
      expect(await as(steward, (tx) => lifecycle!.changeThreadLifecycle(tx, steward, id, 'close'))).toEqual({ kind: 'ok', action: 'close' })
      expect(await as(steward, (tx) => lifecycle!.changeThreadLifecycle(tx, steward, id, 'archive'))).toEqual({ kind: 'ok', action: 'archive' })
      expect(await as(member, (tx) => lifecycle!.changeThreadLifecycle(tx, member, id, 'archive'))).toEqual({ kind: 'conflict', code: 'ALREADY_ARCHIVED' })
      expect((await admin.query(`SELECT action, acted_via FROM message_thread_lifecycle WHERE thread_id = $1 ORDER BY seq`, [id])).rows).toEqual([
        { action: 'close', acted_via: 'current_assignee' },
        { action: 'archive', acted_via: 'current_assignee' },
      ])
      expect((await as(member, (tx) => access!.listThreads(tx, member))).find((t) => t.id === id)).toMatchObject({ isArchived: true, status: 'closed' })
      expect(await as(member, (tx) => access!.listThreadMessages(tx, member, id))).toHaveLength(1)
    })

    it('rolls the close, the archive and their history back when either audit sink cannot record them', async () => {
      const id = await mkThread(U.member)
      await failAudit('messages.thread.close')
      await rejectsWith(as(member, (tx) => lifecycle!.changeThreadLifecycle(tx, member, id, 'close')), /injected audit fault/)
      expect(await status(id)).toEqual({ status: 'open', is_archived: false })
      expect(await lifecycleRows(id)).toBe(0)
      await clearFaults()

      expect(await as(member, (tx) => lifecycle!.changeThreadLifecycle(tx, member, id, 'close'))).toMatchObject({ kind: 'ok' })
      await failAudit('messages.thread.archive')
      await rejectsWith(as(member, (tx) => lifecycle!.changeThreadLifecycle(tx, member, id, 'archive')), /injected audit fault/)
      expect(await status(id)).toEqual({ status: 'closed', is_archived: false })
      expect(await lifecycleRows(id)).toBe(1)
      await clearFaults()

      // Under Canonical V2 the same decision is audited on the hash chain and rolls back against that sink too.
      const v2 = await mkThread(U.member)
      vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '1')
      await failAudit('messages.thread.close')
      await rejectsWith(as(member, (tx) => lifecycle!.changeThreadLifecycle(tx, member, v2, 'close')), /injected audit fault/)
      expect(await status(v2)).toEqual({ status: 'open', is_archived: false })
      await clearFaults()
      expect(await as(member, (tx) => lifecycle!.changeThreadLifecycle(tx, member, v2, 'close'))).toMatchObject({ kind: 'ok' })
      expect(await count(`SELECT count(*) AS n FROM public.audit_logs WHERE action = 'messages.thread.close' AND organization_id = $1 AND resource_id = $2`, [ORG_A, v2])).toBe(1)
    })

    it('the database refuses a status or archive change without its history, a reopen and an un-archive, from the runtime role', async () => {
      const id = await mkThread(U.member)
      await rejectsWith(raw(member, sql`UPDATE message_threads SET status = 'closed' WHERE id = ${id}`), /requires its lifecycle record/)
      await rejectsWith(raw(member, sql`UPDATE message_threads SET is_archived = true WHERE id = ${id}`), /only a closed conversation can be archived/)
      expect(await as(member, (tx) => lifecycle!.changeThreadLifecycle(tx, member, id, 'close'))).toMatchObject({ kind: 'ok' })
      await rejectsWith(raw(member, sql`UPDATE message_threads SET status = 'open' WHERE id = ${id}`), /can only move to closed/)
      expect(await as(member, (tx) => lifecycle!.changeThreadLifecycle(tx, member, id, 'archive'))).toMatchObject({ kind: 'ok' })
      await rejectsWith(raw(member, sql`UPDATE message_threads SET is_archived = false WHERE id = ${id}`), /stays archived/)
      // Identity of the conversation is immutable even though the runtime role holds UPDATE on the table.
      await rejectsWith(raw(member, sql`UPDATE message_threads SET member_id = ${U.member2} WHERE id = ${id}`), /immutable/)
      expect(await status(id)).toEqual({ status: 'closed', is_archived: true })
    })

    it('keeps the lifecycle history append-only for the runtime role, and bound to its own tenant and thread state', async () => {
      const id = await mkThread(U.member)
      const insert = (a: { userId: string; organizationId: string }, org: string, action: string, via: string, reference: string | null) =>
        raw(a, sql`INSERT INTO message_thread_lifecycle (organization_id, thread_id, action, acted_by, acted_via, reference) VALUES (${org}, ${id}, ${action}, ${a.userId}, ${via}, ${reference})`)
      await rejectsWith(insert(member, ORG_A, 'close', 'thread_member', null), /not closed/)
      await rejectsWith(insert(member, ORG_A, 'hold_place', 'thread_member', 'x'), /message_lifecycle_hold_by_administrator/)
      await rejectsWith(insert(member, ORG_A, 'hold_place', 'organization_administrator', '  '), /message_lifecycle_hold_reference/)
      await rejectsWith(insert(adminActor, ORG_B, 'hold_place', 'organization_administrator', 'x'), /row-level security|does not match a conversation/)
      expect(await as(member, (tx) => lifecycle!.changeThreadLifecycle(tx, member, id, 'close'))).toMatchObject({ kind: 'ok' })
      for (const statement of [sql`UPDATE message_thread_lifecycle SET acted_by = 'x' WHERE thread_id = ${id}`, sql`DELETE FROM message_thread_lifecycle WHERE thread_id = ${id}`, sql`TRUNCATE message_thread_lifecycle`]) {
        await rejectsWith(raw(member, statement), /permission denied/)
      }
      // A closed conversation cannot be closed again, even by a raw insert.
      await rejectsWith(insert(member, ORG_A, 'close', 'thread_member', null), /message_lifecycle|already|closed|unique|violates/i)
      // The messages themselves are immutable for the runtime role, and no row of an append-only table can be locked.
      for (const statement of [sql`UPDATE messages SET content = 'rewritten' WHERE thread_id = ${id}`, sql`DELETE FROM messages WHERE thread_id = ${id}`]) {
        await rejectsWith(raw(member, statement), /permission denied/)
      }
      for (const table of ['message_thread_lifecycle', 'messages']) {
        await rejectsWith(raw(member, sql.raw(`SELECT 1 FROM ${table} FOR UPDATE`)), /permission denied/)
      }
      // The rows the code does lock or update are lockable with the UPDATE privilege the runtime holds.
      await raw(member, sql`SELECT id FROM message_threads WHERE id = ${id} FOR UPDATE`)
      expect(await lifecycleRows(id)).toBe(1)
    })
  })

  describe('notifications and audit never carry message text', () => {
    it('tells the assignee, the member and the triagers that something exists, with a link each side can open, and nothing else', async () => {
      const triager = actor(U.triager)
      expect((await as(adminActor, (tx) => designations!.grantDesignation(tx, adminActor, { scope: 'messages', userId: U.triager, expiresAt: new Date(Date.now() + 30 * DAY) }, deps))).kind).toBe('ok')
      const created = await as(member, (tx) => access!.createMemberThread(tx, member, { subject: SUBJECT, body: BODY }))
      const assigned = await as(triager, (tx) => assignment!.assignThread(tx, triager, { threadId: created.id, action: 'assign', toStaffId: U.steward, reason: 'dues file' }, deps))
      expect(assigned).toMatchObject({ kind: 'ok' })
      expect(await as(steward, (tx) => access!.postThreadMessage(tx, steward, created.id, { body: `${BODY} reply` }))).toMatchObject({ kind: 'ok' })
      expect(await as(member, (tx) => access!.postThreadMessage(tx, member, created.id, { body: `${BODY} follow-up` }))).toMatchObject({ kind: 'ok' })
      const rows = (await admin.query(`SELECT user_id, title, message, action_url, data FROM in_app_notifications WHERE data ->> 'threadId' = $1 OR action_url LIKE '%' || $1 || '%' ORDER BY created_at, user_id`, [created.id])).rows
      const events = rows.map((r) => `${r.user_id}:${r.data.event}`)
      expect(events).toEqual(expect.arrayContaining([`${U.steward}:thread_assigned`, `${U.steward}:thread_message`, `${U.member}:thread_message`]))
      const byEvent = Object.fromEntries(rows.map((r) => [`${r.user_id}:${r.data.event}`, r]))
      expect(byEvent[`${U.steward}:thread_assigned`].action_url).toBe(`/dashboard/messages/staff?thread=${created.id}`)
      expect(byEvent[`${U.member}:thread_message`].action_url).toBe(`/dashboard/messages?thread=${created.id}`)
      expect(JSON.stringify(rows)).not.toMatch(/PRIVATE-BODY-TEXT|PRIVATE-SUBJECT/)
    })

    it('writes no message text, subject, hold reference or policy reference into any audit record', async () => {
      const id = await mkThread(U.member, { staffId: U.steward })
      await as(steward, (tx) => access!.postThreadMessage(tx, steward, id, { body: BODY }))
      await as(member, (tx) => readState!.markThreadRead(tx, member, id))
      await as(adminActor, (tx) => lifecycle!.setLegalHold(tx, adminActor, id, 'place', 'HOLD-REF-9921'))
      await as(member, (tx) => lifecycle!.changeThreadLifecycle(tx, member, id, 'close'))
      await as(member, (tx) => lifecycle!.changeThreadLifecycle(tx, member, id, 'archive'))
      const audit = JSON.stringify((await admin.query(`SELECT row_to_json(a) AS r FROM audit_security.audit_logs a WHERE organization_id = $1`, [ORG_A])).rows)
      expect(audit).not.toMatch(/PRIVATE-BODY-TEXT|PRIVATE-SUBJECT|HOLD-REF-9921|POLICY-REF-1|AUTH-REF-1|dues file/)
      for (const action of ['messages.message.create', 'messages.thread.read', 'messages.thread.hold_place', 'messages.thread.close', 'messages.thread.archive']) {
        expect(await audits(action), action).toBeGreaterThan(0)
      }
    })
  })

  describe('retention is policy-parameterised, hold-aware and never deletes', () => {
    const closedThread = async (opts: { staffId?: string | null } = {}) => {
      const id = await mkThread(U.member, opts)
      await as(member, (tx) => lifecycle!.changeThreadLifecycle(tx, member, id, 'close'))
      return id
    }
    const retentionOf = async (id: string, now = new Date()) => {
      const row = (await admin.query(`SELECT id, organization_id, status FROM message_threads WHERE id = $1`, [id])).rows[0]
      return as(adminActor, (tx) => lifecycle!.threadRetention(tx, { id: row.id, organizationId: row.organization_id, status: row.status }, now))
    }
    const liveCount = () => count(`SELECT count(*) AS n FROM message_retention_policies WHERE organization_id = $1 AND superseded_at IS NULL`, [ORG_A])

    it('says "policy not adopted" until an organization records one; the period then comes only from an adopted record, by an administrator, and nothing is deleted', async () => {
      const id = await closedThread()
      const open = await mkThread(U.member2)
      expect(await retentionOf(open)).toEqual({ state: 'not_closed' })
      expect(await retentionOf(id)).toEqual({ state: 'policy_not_adopted' })
      expect(await retentionOf(id, new Date(Date.now() + 100 * 365 * DAY))).toEqual({ state: 'policy_not_adopted' })
      expect(await liveCount()).toBe(0)

      expect(await as(steward, (tx) => lifecycle!.adoptRetentionPolicy(tx, steward, { retentionDays: 30, policyReference: 'p', authorityReference: 'a' }))).toEqual({ kind: 'forbidden' })
      for (const days of [0, -1, 1.5, 36501]) {
        expect(await as(adminActor, (tx) => lifecycle!.adoptRetentionPolicy(tx, adminActor, { retentionDays: days, policyReference: 'p', authorityReference: 'a' })), String(days)).toEqual({ kind: 'invalid' })
      }
      expect(await as(adminActor, (tx) => lifecycle!.adoptRetentionPolicy(tx, adminActor, { retentionDays: 30, policyReference: ' ', authorityReference: 'a' }))).toEqual({ kind: 'invalid' })
      expect(await liveCount()).toBe(0)

      const adopted = await as(adminActor, (tx) => lifecycle!.adoptRetentionPolicy(tx, adminActor, { retentionDays: 30, policyReference: 'Policy 1', authorityReference: 'Resolution 9' }))
      expect(adopted).toMatchObject({ kind: 'ok', policy: { retentionDays: 30, adoptedBy: U.admin } })
      expect(await audits('messages.retention.adopt')).toBeGreaterThan(0)
      expect(JSON.stringify((await admin.query(`SELECT row_to_json(a) AS r FROM audit_security.audit_logs a WHERE organization_id = $1 AND action = 'messages.retention.adopt'`, [ORG_A])).rows)).not.toMatch(/Policy 1|Resolution 9/)
      expect(await retentionOf(id, new Date(Date.now() + 10 * DAY))).toMatchObject({ state: 'retained' })
      expect(await retentionOf(id, new Date(Date.now() + 31 * DAY))).toMatchObject({ state: 'retention_elapsed' })
      // Reporting that a period has elapsed deletes nothing; the runtime role could not delete in any case.
      expect(await count(`SELECT count(*) AS n FROM messages WHERE thread_id = $1`, [id])).toBe(1)
      expect(await as(member, (tx) => readState!.getThreadDetail(tx, member, id, new Date(Date.now() + 90 * DAY)))).toMatchObject({ retention: { audience: 'member', state: 'retained' } })

      // A second adoption supersedes the first: exactly one policy is live, and history is kept.
      await as(adminActor, (tx) => lifecycle!.adoptRetentionPolicy(tx, adminActor, { retentionDays: 365, policyReference: 'Policy 2', authorityReference: 'Resolution 12' }))
      expect(await liveCount()).toBe(1)
      expect(await count(`SELECT count(*) AS n FROM message_retention_policies WHERE organization_id = $1`, [ORG_A])).toBe(2)
      expect(await retentionOf(id, new Date(Date.now() + 31 * DAY))).toMatchObject({ state: 'retained' })

      // Append-only for the runtime role; the trigger refuses everything but a supersession, even though UPDATE is granted.
      await rejectsWith(raw(adminActor, sql`DELETE FROM message_retention_policies`), /permission denied/)
      await rejectsWith(raw(adminActor, sql`UPDATE message_retention_policies SET retention_days = 1 WHERE organization_id = ${ORG_A}`), /superseded policy is final|only supersession/)
      // Another tenant sees none of it, and cannot adopt into this one.
      const foreignAdmin = actor(U.foreign, 'admin', ORG_B)
      expect((await raw<{ rows: Array<{ n: number }> }>(foreignAdmin, sql`SELECT count(*)::int AS n FROM message_retention_policies`)).rows[0].n).toBe(0)
      await rejectsWith(raw(foreignAdmin, sql`INSERT INTO message_retention_policies (organization_id, policy_reference, authority_reference, retention_days, adopted_by) VALUES (${ORG_A}, 'p', 'a', 5, ${U.foreign})`), /row-level security/)
    })

    it('rolls an adoption back when its audit record cannot be written', async () => {
      const before = await count(`SELECT count(*) AS n FROM message_retention_policies WHERE organization_id = $1`, [ORG_A])
      const liveBefore = await liveCount()
      await failAudit('messages.retention.adopt')
      await rejectsWith(as(adminActor, (tx) => lifecycle!.adoptRetentionPolicy(tx, adminActor, { retentionDays: 90, policyReference: 'p', authorityReference: 'a' })), /injected audit fault/)
      expect(await count(`SELECT count(*) AS n FROM message_retention_policies WHERE organization_id = $1`, [ORG_A])).toBe(before)
      // The supersession of the live policy rolled back with it: the previous policy is still the live one.
      expect(await liveCount()).toBe(liveBefore)
    })

    it('a legal hold is not an administrator role, and a recorded hold still overrides retention without granting a read', async () => {
      const id = await closedThread({ staffId: U.steward })
      const elapsed = new Date(Date.now() + 1000 * DAY)
      expect(await retentionOf(id, elapsed)).toMatchObject({ state: 'retention_elapsed' })

      expect(await as(steward, (tx) => lifecycle!.setLegalHold(tx, steward, id, 'place', 'MATTER-1'))).toEqual({ kind: 'forbidden' })
      expect(await as(adminActor, (tx) => lifecycle!.setLegalHold(tx, adminActor, id, 'place', '  '))).toEqual({ kind: 'invalid_reference' })
      expect(await as(adminActor, (tx) => lifecycle!.setLegalHold(tx, adminActor, 'not-a-uuid', 'place', 'MATTER-1'))).toEqual({ kind: 'not_found' })
      const foreignAdmin = actor(U.foreign, 'admin', ORG_B)
      expect(await as(foreignAdmin, (tx) => lifecycle!.setLegalHold(tx, foreignAdmin, id, 'place', 'MATTER-1'))).toEqual({ kind: 'not_found' })
      expect(await as(adminActor, (tx) => lifecycle!.setLegalHold(tx, adminActor, id, 'place', 'MATTER-1'))).toEqual({ kind: 'forbidden' })
      expect(await as(adminActor, (tx) => lifecycle!.setLegalHold(tx, adminActor, id, 'release', 'MATTER-1'))).toEqual({ kind: 'forbidden' })
      expect(await count(`SELECT count(*) AS n FROM message_thread_lifecycle WHERE thread_id = $1 AND action LIKE 'hold%'`, [id])).toBe(0)

      await admin.query(
        `INSERT INTO message_thread_lifecycle(organization_id,thread_id,action,acted_by,acted_via,reference) VALUES($1,$2,'hold_place',$3,'organization_administrator','MATTER-1')`,
        [ORG_A, id, adminActor.userId],
      )
      expect(await retentionOf(id, elapsed)).toEqual({ state: 'legal_hold' })
      expect(await as(steward, (tx) => readState!.getThreadDetail(tx, steward, id, elapsed))).toMatchObject({ viewerRole: 'assignee', retention: { audience: 'staff', state: 'legal_hold' } })
      const memberDetail = JSON.stringify(await as(member, (tx) => readState!.getThreadDetail(tx, member, id, elapsed)))
      expect(memberDetail).toContain('"state":"retained"')
      expect(memberDetail).not.toMatch(/legal|hold|MATTER-1/)
      expect(await as(adminActor, (tx) => access!.findReadableThread(tx, adminActor, id))).toBeNull()
      expect(await as(adminActor, (tx) => access!.listThreadMessages(tx, adminActor, id))).toBeNull()

      await admin.query(
        `INSERT INTO message_thread_lifecycle(organization_id,thread_id,action,acted_by,acted_via,reference) VALUES($1,$2,'hold_release',$3,'organization_administrator','MATTER-1 closed')`,
        [ORG_A, id, adminActor.userId],
      )
      expect(await retentionOf(id, elapsed)).toMatchObject({ state: 'retention_elapsed' })
      expect((await admin.query(`SELECT action FROM message_thread_lifecycle WHERE thread_id = $1 AND action LIKE 'hold%' ORDER BY seq`, [id])).rows.map((r) => r.action)).toEqual(['hold_place', 'hold_release'])
    })

    it('refuses to count a closed conversation whose closing was never recorded', async () => {
      const id = await mkThread(U.member, { status: 'closed' })
      expect(await retentionOf(id, new Date(Date.now() + 1000 * DAY))).toEqual({ state: 'closure_unrecorded' })
    })
  })

  describe('read state', () => {
    it('shows each side that the other has read, without saying who, and writes only when something new was seen', async () => {
      const id = await mkThread(U.member, { staffId: U.steward })
      await as(steward, (tx) => access!.postThreadMessage(tx, steward, id, { body: 'union reply' }))
      expect((await as(member, (tx) => access!.listThreadMessages(tx, member, id)))!.map((m) => m.readByCounterpart)).toEqual([false, false])

      expect(await as(member, (tx) => readState!.markThreadRead(tx, member, id))).toEqual({ kind: 'ok', changed: true })
      expect(await as(member, (tx) => readState!.markThreadRead(tx, member, id))).toEqual({ kind: 'ok', changed: false })
      expect(await audits('messages.thread.read', id)).toBe(1)
      expect((await as(steward, (tx) => access!.listThreadMessages(tx, steward, id)))!.map((m) => [m.fromMe, m.readByCounterpart])).toEqual([[false, false], [true, true]])
      expect(await as(steward, (tx) => readState!.markThreadRead(tx, steward, id))).toEqual({ kind: 'ok', changed: true })
      expect((await as(member, (tx) => access!.listThreadMessages(tx, member, id)))!.map((m) => [m.fromMe, m.readByCounterpart])).toEqual([[true, true], [false, true]])
      expect(JSON.stringify(await as(member, (tx) => access!.listThreadMessages(tx, member, id)))).not.toMatch(new RegExp(`${U.steward}|${U.member}`))
      expect(await as(steward2, (tx) => readState!.markThreadRead(tx, steward2, id))).toEqual({ kind: 'not_found' })
      expect(await as(member2, (tx) => readState!.markThreadRead(tx, member2, id))).toEqual({ kind: 'not_found' })
      expect(await count(`SELECT count(*) AS n FROM message_thread_reads WHERE thread_id = $1`, [id])).toBe(2)
    })

    it('rolls the marker back with its audit, and the database keeps markers monotonic, tenant-bound, identity-immutable and undeletable', async () => {
      const id = await mkThread(U.member, { staffId: U.steward })
      await as(steward, (tx) => access!.postThreadMessage(tx, steward, id, { body: 'hello' }))
      await failAudit('messages.thread.read')
      await rejectsWith(as(member, (tx) => readState!.markThreadRead(tx, member, id)), /injected audit fault/)
      expect(await count(`SELECT count(*) AS n FROM message_thread_reads WHERE thread_id = $1`, [id])).toBe(0)
      await clearFaults()
      expect(await as(member, (tx) => readState!.markThreadRead(tx, member, id))).toEqual({ kind: 'ok', changed: true })

      await rejectsWith(raw(member, sql`UPDATE message_thread_reads SET last_read_at = last_read_at - interval '1 day' WHERE thread_id = ${id}`), /never moves backwards/)
      await rejectsWith(raw(member, sql`UPDATE message_thread_reads SET user_id = 'someone' WHERE thread_id = ${id}`), /immutable/)
      await rejectsWith(raw(member, sql`INSERT INTO message_thread_reads (thread_id, user_id, organization_id, last_read_at) VALUES (${id}, 'x', ${ORG_B}, now())`), /row-level security|does not match a conversation/)
      await rejectsWith(raw(member, sql`DELETE FROM message_thread_reads WHERE thread_id = ${id}`), /permission denied/)
      // The upsert the code issues relies on the UPDATE privilege (ON CONFLICT DO UPDATE locks the row): it is granted and works.
      await as(steward, (tx) => access!.postThreadMessage(tx, steward, id, { body: 'second' }))
      expect(await as(member, (tx) => readState!.markThreadRead(tx, member, id))).toEqual({ kind: 'ok', changed: true })
      // Another tenant's session sees no marker.
      const foreignMember = actor(U.foreignMember, 'member', ORG_B)
      expect((await raw<{ rows: Array<{ n: number }> }>(foreignMember, sql`SELECT count(*)::int AS n FROM message_thread_reads`)).rows[0].n).toBe(0)
    })
  })
})
