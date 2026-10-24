/**
 * Staff assignment of member conversations against the COMBINED deployed schema, as the runtime role, with the
 * grants activated by the approved bootstrap (platform 0014, RLS 0021, manifest privileges). Nothing is mirrored:
 * the tables, triggers, row-level security and privileges are whatever Django `migrate` plus the approved Drizzle
 * bootstrap created.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a FRESH disposable database (the same
 * preparation as authority-kernel-combined.postgres.test.ts). Not a staging isolation pass.
 */
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { seedMembership, seedUser, type Db } from '../../db/__tests__/authority-kernel-harness'
import type { RLSTx } from '@/lib/db/with-rls-context'
import { assignThread, grantTriageDesignation, listTriageQueue, revokeTriageDesignation } from './thread-assignment'
import { createMemberThread, findReadableThread, listThreads } from './thread-access'

const URL = process.env.UE_AUTHORITY_COMBINED_URL
const adapt = (c: pg.Client): Db => ({ exec: (s) => c.query(s), query: (s, p) => c.query(s, p as unknown[]) as never })

describe.skipIf(!URL)('conversation assignment on the combined deployed schema, as the runtime role', () => {
  const ORG_A = randomUUID()
  const ORG_B = randomUUID()
  const id = (name: string) => `${name}-${randomUUID().slice(0, 8)}`
  const U = { admin: id('msg-admin'), triager: id('msg-triager'), steward: id('msg-steward'), other: id('msg-other'), member: id('msg-member'), foreign: id('msg-foreign') }
  let admin: pg.Client
  let runtime: pg.Client
  let rdb: ReturnType<typeof drizzle>
  const eligible = new Set([U.triager, U.steward, U.other])
  const deps = { assigneeEligible: async (userId: string) => eligible.has(userId) }

  const inOrg = <T>(org: string, userId: string, fn: (tx: RLSTx) => Promise<T>) =>
    rdb.transaction(async (t) => {
      await t.execute(sql`SELECT set_config('app.current_org_id', ${org}, true), set_config('app.current_user_id', ${userId}, true)`)
      return fn(t as unknown as RLSTx)
    })
  const actor = (userId: string, role: 'member' | 'steward' | 'admin' = 'steward', organizationId = ORG_A) => ({ userId, organizationId, role })
  const rejectsWith = async (promise: Promise<unknown>, pattern: RegExp) => {
    const error = (await promise.then(() => null, (e: unknown) => e)) as { message?: string; cause?: { message?: string } } | null
    expect(error, 'expected the statement to be refused').not.toBeNull()
    expect(`${error!.message} ${error!.cause?.message ?? ''}`).toMatch(pattern)
  }
  // Canonical V2 writes the hash-chained public.audit_logs; otherwise the same transaction writes audit_security.audit_logs.
  const audits = async (action: string, resourceId?: string) =>
    count(
      `SELECT (SELECT count(*) FROM audit_security.audit_logs WHERE action = $1 AND organization_id = $2 AND ($3::text IS NULL OR resource_id::text = $3))
            + (SELECT count(*) FROM public.audit_logs WHERE action = $1 AND organization_id = $2 AND ($3::text IS NULL OR resource_id = $3)) AS n`,
      [action, ORG_A, resourceId ?? null],
    )
  const count = async (query: string, params: unknown[] = []) => Number((await admin.query(query, params)).rows[0].n)

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: URL })
    await admin.connect()
    const d = adapt(admin)
    for (const [org, slug] of [[ORG_A, id('msg-a')], [ORG_B, id('msg-b')]]) {
      await admin.query(
        `INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
         VALUES ($1,$2,$3,'local','{}',0,'{}',false,0,0,'{}','{}','active',now(),now(),1)`,
        [org, slug, slug],
      )
    }
    for (const user of Object.values(U)) await seedUser(d, user)
    await seedMembership(d, U.admin, ORG_A, 'admin')
    await seedMembership(d, U.triager, ORG_A, 'steward')
    await seedMembership(d, U.steward, ORG_A, 'steward')
    await seedMembership(d, U.other, ORG_A, 'steward')
    await seedMembership(d, U.member, ORG_A, 'member')
    await seedMembership(d, U.foreign, ORG_B, 'steward')
    runtime = new pg.Client({ connectionString: URL })
    await runtime.connect()
    await runtime.query('SET ROLE union_eyes_runtime')
    rdb = drizzle(runtime)
  }, 120_000)

  afterAll(async () => {
    await runtime?.end()
    await admin?.end()
  })

  it('delivers a new member conversation to a designated triager and lets assigned staff act on it', async () => {
    const granted = await inOrg(ORG_A, U.admin, (tx) => grantTriageDesignation(tx, actor(U.admin, 'admin'), { userId: U.triager, expiresAt: new Date(Date.now() + 30 * 86_400_000) }, deps))
    expect(granted.kind).toBe('ok')

    const thread = await inOrg(ORG_A, U.member, (tx) => createMemberThread(tx, actor(U.member, 'member'), { subject: 'Schedule change', body: 'PRIVATE-BODY-TEXT' }))
    expect(await count(`SELECT count(*) AS n FROM in_app_notifications WHERE user_id=$1 AND organization_id=$2`, [U.triager, ORG_A])).toBe(1)

    // The queue is metadata only, and is invisible to staff without a designation and to other tenants.
    const queue = await inOrg(ORG_A, U.triager, (tx) => listTriageQueue(tx, actor(U.triager)))
    expect(queue!.map((q) => q.id)).toEqual([thread.id])
    expect(JSON.stringify(queue)).not.toMatch(/PRIVATE-BODY-TEXT|msg-member/)
    expect(await inOrg(ORG_A, U.steward, (tx) => listTriageQueue(tx, actor(U.steward)))).toBeNull()
    expect(await inOrg(ORG_B, U.foreign, (tx) => listTriageQueue(tx, actor(U.foreign, 'steward', ORG_B)))).toBeNull()
    expect(await inOrg(ORG_A, U.triager, (tx) => findReadableThread(tx, actor(U.triager), thread.id))).toBeNull()

    const result = await inOrg(ORG_A, U.triager, (tx) => assignThread(tx, actor(U.triager), { threadId: thread.id, action: 'assign', toStaffId: U.steward, reason: 'Scheduling' }, deps))
    expect(result).toEqual({ kind: 'ok', action: 'assign', staffId: U.steward })
    expect(await inOrg(ORG_A, U.steward, (tx) => listThreads(tx, actor(U.steward)))).toHaveLength(1)
    expect(await inOrg(ORG_A, U.other, (tx) => listThreads(tx, actor(U.other)))).toHaveLength(0)
    expect(await count(`SELECT count(*) AS n FROM message_thread_assignments WHERE thread_id=$1`, [thread.id])).toBe(1)
    expect(await audits('messages.thread.assign', thread.id)).toBe(1)
    expect(await count(`SELECT count(*) AS n FROM in_app_notifications WHERE user_id=$1`, [U.steward])).toBe(1)

    // Delegation by the assignee, then a conflicting second assignment is refused.
    expect(await inOrg(ORG_A, U.steward, (tx) => assignThread(tx, actor(U.steward), { threadId: thread.id, action: 'reassign', toStaffId: U.other }, deps))).toMatchObject({ kind: 'ok' })
    expect(await inOrg(ORG_A, U.triager, (tx) => assignThread(tx, actor(U.triager), { threadId: thread.id, action: 'assign', toStaffId: U.steward }, deps))).toEqual({ kind: 'conflict', code: 'ALREADY_ASSIGNED' })
  })

  it('denies other tenants and refuses to change a thread\'s tenant, owner or assignee outside the assignment path', async () => {
    const thread = await inOrg(ORG_A, U.member, (tx) => createMemberThread(tx, actor(U.member, 'member'), { subject: 'Another', body: 'x' }))
    // Tenant isolation: the foreign organization's context cannot see or assign the thread.
    expect(await inOrg(ORG_B, U.foreign, (tx) => assignThread(tx, actor(U.foreign, 'steward', ORG_B), { threadId: thread.id, action: 'assign', toStaffId: U.foreign }, deps))).toEqual({ kind: 'not_found' })
    // The runtime holds UPDATE on threads, but triggers refuse everything except a recorded assignment.
    await rejectsWith(inOrg(ORG_A, U.admin, (tx) => tx.execute(sql`UPDATE message_threads SET staff_id = ${U.steward} WHERE id = ${thread.id}`)), /requires its history record|commit/)
    await rejectsWith(inOrg(ORG_A, U.admin, (tx) => tx.execute(sql`UPDATE message_threads SET member_id = ${U.other} WHERE id = ${thread.id}`)), /immutable/)
    await rejectsWith(inOrg(ORG_A, U.admin, (tx) => tx.execute(sql`UPDATE message_thread_assignments SET reason = 'x'`)), /append-only|permission denied/)
    await rejectsWith(inOrg(ORG_A, U.admin, (tx) => tx.execute(sql`DELETE FROM message_triage_designations`)), /permission denied|append-only/)
    expect(await count(`SELECT count(*) AS n FROM message_threads WHERE id=$1 AND staff_id IS NULL`, [thread.id])).toBe(1)
  })

  it('stops the queue as soon as a designation is revoked', async () => {
    const live = (await admin.query(`SELECT id FROM message_triage_designations WHERE organization_id=$1 AND user_id=$2 AND revoked_at IS NULL`, [ORG_A, U.triager])).rows[0].id
    expect(await inOrg(ORG_A, U.admin, (tx) => revokeTriageDesignation(tx, actor(U.admin, 'admin'), live))).toEqual({ kind: 'ok' })
    expect(await inOrg(ORG_A, U.triager, (tx) => listTriageQueue(tx, actor(U.triager)))).toBeNull()
    expect(await audits('messages.triage_designation.revoke')).toBe(1)
  })
})
