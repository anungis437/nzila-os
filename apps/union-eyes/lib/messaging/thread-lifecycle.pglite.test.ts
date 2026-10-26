import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import type { CaseActor } from '@/lib/cases/case-authorization'
import type { RLSTx } from '@/lib/db/with-rls-context'
import { assignThread, listTriageQueue } from './thread-assignment'
import { createMemberThread, findReadableThread, listThreadMessages, listThreads, postThreadMessage } from './thread-access'
import {
  adoptRetentionPolicy,
  changeThreadLifecycle,
  evaluateRetention,
  memberRetentionView,
  setLegalHold,
  threadRetention,
} from './thread-lifecycle'
import { getThreadDetail, markThreadRead } from './thread-read-state'

// Conversation lifecycle, revocation, retention and read state against PostgreSQL, using the REAL platform 0014 and 0025
// migrations (tables, constraints and guard triggers) and the real application code, as a role holding only the
// privileges the storage-authority manifest grants. RLS is scoped migrations 0021 and 0024 and is covered by the combined
// real-PostgreSQL suite. These are in-process database tests, NOT a signed-in browser acceptance run.
const org = '11111111-1111-4111-8111-111111111111'
const foreignOrg = '22222222-2222-4222-8222-222222222222'
const DAY = 86_400_000
const BODY = 'PRIVATE-BODY-TEXT-7731'
const SUBJECT = 'PRIVATE-SUBJECT-4417'

const migration = (name: string) => readFileSync(join(__dirname, '..', '..', 'db', 'migrations-platform', name), 'utf8')

let pg: PGlite
let db: ReturnType<typeof drizzle>
const tx = () => db as unknown as RLSTx
const inTx = <T>(fn: (t: RLSTx) => Promise<T>) => db.transaction(async (t) => fn(t as unknown as RLSTx))
const actor = (userId: string, role: CaseActor['role'] = 'steward', organizationId = org): CaseActor => ({ userId, organizationId, role })
const member = actor('member-1', 'member')
const steward = actor('steward-1')
const admin = actor('admin-1', 'admin')

const asOwner = async <T>(fn: () => Promise<T>) => {
  await pg.exec('RESET ROLE')
  try {
    return await fn()
  } finally {
    await pg.exec('SET ROLE rt')
  }
}
const count = async (sqlText: string, params: unknown[] = []) => Number(((await pg.query<{ n: string }>(sqlText, params)).rows[0] as { n: string }).n)

const thread = (memberId: string, opts: { staffId?: string | null; status?: string; org?: string } = {}) =>
  asOwner(async () => {
    const id = randomUUID()
    await pg.query(`INSERT INTO message_threads(id,subject,member_id,staff_id,organization_id,status) VALUES($1,$2,$3,$4,$5,$6)`, [
      id,
      SUBJECT,
      memberId,
      opts.staffId ?? null,
      opts.org ?? org,
      opts.status ?? 'open',
    ])
    await pg.query(`INSERT INTO messages(thread_id,sender_id,sender_role,content) VALUES($1,$2,'member',$3)`, [id, memberId, BODY])
    return id
  })

const setMembership = (userId: string, patch: { status?: string; role?: string; deleted?: boolean }) =>
  asOwner(async () => {
    await pg.query(`UPDATE organization_members SET status=coalesce($2,status), role=coalesce($3,role), deleted_at=CASE WHEN $4::boolean THEN now() ELSE NULL END WHERE user_id=$1`, [
      userId,
      patch.status ?? null,
      patch.role ?? null,
      patch.deleted ?? false,
    ])
  })

const designate = (userId: string, days = 30) =>
  asOwner(async () => {
    await pg.query(`INSERT INTO triage_designations(organization_id,scope,user_id,granted_by,granted_at,expires_at) VALUES($1,'messages',$2,'admin-1',now()-interval '1 day',now()+($3||' days')::interval)`, [org, userId, String(days)])
  })

beforeAll(async () => {
  vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '0')
  pg = new PGlite()
  await pg.exec(`
    CREATE TYPE message_status AS ENUM ('sent','delivered','read');
    CREATE TYPE message_type AS ENUM ('text','file','system');
    CREATE TABLE message_threads (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), subject text NOT NULL, member_id text NOT NULL, staff_id text,
      organization_id uuid NOT NULL, status text NOT NULL DEFAULT 'open', priority text DEFAULT 'normal', category text,
      is_archived boolean DEFAULT false, last_message_at timestamp, created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now());
    CREATE TABLE messages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), thread_id uuid NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
      sender_id text NOT NULL, sender_role text NOT NULL, message_type message_type NOT NULL DEFAULT 'text', content text,
      file_url text, file_name text, file_size text, status message_status NOT NULL DEFAULT 'sent', read_at timestamp,
      is_edited boolean DEFAULT false, edited_at timestamp, metadata text, created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now());
    CREATE TABLE in_app_notifications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz,
      user_id text NOT NULL, organization_id uuid, title text, message text, type text NOT NULL DEFAULT 'info',
      action_label text, action_url text, data jsonb, read boolean NOT NULL DEFAULT false, read_at timestamp, expires_at timestamp);
    CREATE TABLE organization_members (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, user_id text NOT NULL, role text NOT NULL,
      status text NOT NULL DEFAULT 'active', deleted_at timestamptz);
    CREATE SCHEMA audit_security;
    CREATE TABLE audit_security.audit_logs(
      audit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid, user_id varchar(255),
      action varchar(100) NOT NULL, resource_type varchar(50) NOT NULL, resource_id uuid, old_values jsonb, new_values jsonb,
      ip_address varchar(45), user_agent text, session_id uuid, correlation_id uuid, severity varchar(20) DEFAULT 'info',
      outcome varchar(20) DEFAULT 'success', error_message text, metadata jsonb DEFAULT '{}'::jsonb,
      archived boolean NOT NULL DEFAULT false, archived_at timestamptz, archived_path text, created_at timestamptz DEFAULT now());
  `)
  for (const file of ['0014_message_thread_triage.sql', '0025_message_thread_lifecycle_and_retention.sql']) {
    for (const statement of migration(file).split('--> statement-breakpoint')) {
      if (statement.replace(/--.*$/gm, '').trim()) await pg.exec(statement)
    }
  }
  // The privileges the storage-authority manifest grants, and nothing more.
  await pg.exec(`
    CREATE ROLE rt NOLOGIN;
    GRANT USAGE ON SCHEMA audit_security TO rt;
    GRANT SELECT, INSERT, UPDATE ON message_threads TO rt;
    GRANT SELECT, INSERT ON messages, in_app_notifications, message_thread_assignments, message_thread_lifecycle TO rt;
    GRANT SELECT, INSERT, UPDATE ON triage_designations, message_retention_policies, message_thread_reads TO rt;
    GRANT SELECT ON organization_members TO rt;
    GRANT SELECT, INSERT ON audit_security.audit_logs TO rt;
    SET ROLE rt;
  `)
  db = drizzle(pg)
})
afterAll(async () => {
  vi.unstubAllEnvs()
  await pg?.close()
})
beforeEach(async () => {
  await pg.exec('RESET ROLE')
  await pg.exec(`
    ALTER TABLE message_threads DISABLE TRIGGER USER;
    TRUNCATE message_thread_reads, message_retention_policies, message_thread_lifecycle, message_thread_assignments,
      triage_designations, messages, in_app_notifications, message_threads, organization_members CASCADE;
    TRUNCATE audit_security.audit_logs;
    ALTER TABLE message_threads ENABLE TRIGGER USER;
    INSERT INTO organization_members(organization_id,user_id,role) VALUES
      ('${org}','steward-1','steward'), ('${org}','steward-2','steward'), ('${org}','triager-1','steward'), ('${org}','admin-1','admin');
    GRANT INSERT ON audit_security.audit_logs TO rt;
    SET ROLE rt;
  `)
})

const deps = { assigneeEligible: async () => true }

describe('revocation: staff lose the conversation the moment their authority ends', () => {
  it.each([
    ['membership made inactive', { status: 'inactive' }],
    ['membership suspended', { status: 'suspended' }],
    ['membership soft-deleted', { deleted: true }],
    ['membership demoted to member', { role: 'member' }],
  ] as const)('an assignee whose %s can no longer list, read or reply', async (_label, patch) => {
    const id = await thread('member-1', { staffId: 'steward-1' })
    expect((await listThreads(tx(), steward)).map((t) => t.id)).toEqual([id])
    expect(await postThreadMessage(tx(), steward, id, { body: 'while live' })).toMatchObject({ kind: 'ok' })

    await setMembership('steward-1', patch)
    const messagesBefore = await count(`SELECT count(*) AS n FROM messages`)
    const notificationsBefore = await count(`SELECT count(*) AS n FROM in_app_notifications`)
    expect(await listThreads(tx(), steward)).toEqual([])
    expect(await findReadableThread(tx(), steward, id)).toBeNull()
    expect(await listThreadMessages(tx(), steward, id)).toBeNull()
    expect(await postThreadMessage(tx(), steward, id, { body: 'after revocation' })).toEqual({ kind: 'not_found' })
    expect(await changeThreadLifecycle(tx(), steward, id, 'close')).toEqual({ kind: 'not_found' })
    expect(await markThreadRead(tx(), steward, id)).toEqual({ kind: 'not_found' })
    expect(await getThreadDetail(tx(), steward, id)).toBeNull()
    expect(await count(`SELECT count(*) AS n FROM messages`)).toBe(messagesBefore)
    expect(await count(`SELECT count(*) AS n FROM in_app_notifications`)).toBe(notificationsBefore)

    // The member is unaffected, and restoring the membership restores the access: it is read live, never cached.
    expect((await listThreads(tx(), member)).map((t) => t.id)).toEqual([id])
    await setMembership('steward-1', { status: 'active', role: 'steward' })
    expect((await listThreads(tx(), steward)).map((t) => t.id)).toEqual([id])
  })

  it('a staff member with no membership row at all, or one in another organization, sees nothing', async () => {
    const id = await thread('member-1', { staffId: 'ghost-staff' })
    expect(await listThreads(tx(), actor('ghost-staff'))).toEqual([])
    expect(await findReadableThread(tx(), actor('ghost-staff'), id)).toBeNull()
    await asOwner(async () => {
      await pg.query(`INSERT INTO organization_members(organization_id,user_id,role) VALUES($1,'ghost-staff','steward')`, [foreignOrg])
    })
    expect(await findReadableThread(tx(), actor('ghost-staff'), id)).toBeNull()
  })

  it('a released or reassigned assignment ends the previous assignee\'s access at once', async () => {
    const id = await thread('member-1', { staffId: 'steward-1' })
    expect(await inTx((t) => assignThread(t, actor('steward-1'), { threadId: id, action: 'reassign', toStaffId: 'steward-2' }, deps))).toMatchObject({ kind: 'ok' })
    expect(await findReadableThread(tx(), steward, id)).toBeNull()
    expect(await postThreadMessage(tx(), steward, id, { body: 'no longer mine' })).toEqual({ kind: 'not_found' })
    expect(await findReadableThread(tx(), actor('steward-2'), id)).not.toBeNull()
    expect(await inTx((t) => assignThread(t, actor('steward-2'), { threadId: id, action: 'release' }, deps))).toMatchObject({ kind: 'ok' })
    expect(await findReadableThread(tx(), actor('steward-2'), id)).toBeNull()
  })

  it('a revoked or expired designation stops the queue, and so does an inactive membership behind a live designation', async () => {
    await thread('member-1')
    await designate('triager-1')
    expect(await listTriageQueue(tx(), actor('triager-1'))).toHaveLength(1)

    await setMembership('triager-1', { status: 'inactive' })
    expect(await listTriageQueue(tx(), actor('triager-1'))).toBeNull()
    const id = (await pg.query<{ id: string }>(`SELECT id FROM message_threads`)).rows[0].id
    expect(await inTx((t) => assignThread(t, actor('triager-1'), { threadId: id, action: 'assign', toStaffId: 'steward-1' }, deps))).toEqual({ kind: 'not_found' })
    await setMembership('triager-1', { status: 'active' })
    expect(await listTriageQueue(tx(), actor('triager-1'))).toHaveLength(1)

    await asOwner(async () => {
      await pg.query(`UPDATE triage_designations SET revoked_at=now(), revoked_by='admin-1' WHERE user_id='triager-1'`)
    })
    expect(await listTriageQueue(tx(), actor('triager-1'))).toBeNull()
    expect(await inTx((t) => assignThread(t, actor('triager-1'), { threadId: id, action: 'assign', toStaffId: 'steward-1' }, deps))).toEqual({ kind: 'not_found' })
    expect(await count(`SELECT count(*) AS n FROM message_thread_assignments`)).toBe(0)
  })

  it('reads assignee eligibility through the conversation predicate when canonical bootstrap is on', async () => {
    const id = await thread('member-1', { staffId: 'steward-1' })
    const adminThread = await thread('member-1', { staffId: 'admin-1' })
    await asOwner(async () => {
      await pg.exec(`CREATE OR REPLACE FUNCTION public.ue_conversation_assignee_authorized(target text, row_org uuid) RETURNS boolean LANGUAGE sql STABLE AS
        $$ SELECT EXISTS (
             SELECT 1 FROM organization_members
             WHERE user_id = target AND organization_id = row_org AND status = 'active' AND deleted_at IS NULL
               AND lower(role) IN ('bargaining_committee','chief_steward','health_safety_rep','officer','president','secretary_treasurer','steward','vice_president')
           ) $$`)
    })
    vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '1')
    try {
      expect(await findReadableThread(tx(), steward, id)).not.toBeNull()
      expect(await findReadableThread(tx(), admin, adminThread)).toBeNull()
      await setMembership('steward-1', { status: 'inactive' })
      expect(await findReadableThread(tx(), steward, id)).toBeNull()
    } finally {
      vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '0')
    }
  })

  it('a missing conversation predicate denies the assignee and still lets the member read', async () => {
    const id = await thread('member-1', { staffId: 'steward-1' })
    await asOwner(async () => {
      await pg.exec('DROP FUNCTION IF EXISTS public.ue_conversation_assignee_authorized(text, uuid)')
    })
    vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '1')
    try {
      expect(await findReadableThread(tx(), member, id)).not.toBeNull()
      expect(await findReadableThread(tx(), steward, id)).toBeNull()
      expect(await inTx((t) => findReadableThread(t, member, id))).not.toBeNull()
      expect(await inTx((t) => findReadableThread(t, steward, id))).toBeNull()
    } finally {
      vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '0')
    }
  })

  it('ignores the actor role label and the administrator title', async () => {
    const id = await thread('member-1', { staffId: 'steward-1' })
    await setMembership('steward-1', { role: 'admin' })
    expect(await findReadableThread(tx(), actor('steward-1', 'steward'), id)).toBeNull()
    const assignedAdmin = await thread('member-1', { staffId: 'admin-1' })
    expect(await findReadableThread(tx(), actor('admin-1', 'admin'), assignedAdmin)).toBeNull()
    expect(await listThreads(tx(), actor('admin-1', 'admin'))).toEqual([])
  })

  it('lets a health and safety representative read only the conversation assigned to them', async () => {
    await asOwner(async () => {
      await pg.query(`INSERT INTO organization_members(organization_id,user_id,role) VALUES($1,'safety-1','health_safety_rep')`, [org])
    })
    const own = await thread('member-1', { staffId: 'safety-1' })
    const other = await thread('member-2', { staffId: 'steward-1' })
    const safety = actor('safety-1')
    expect((await listThreads(tx(), safety)).map((t) => t.id)).toEqual([own])
    expect(await findReadableThread(tx(), safety, other)).toBeNull()
  })

  it('a stored union representative role confers no conversation', async () => {
    await asOwner(async () => {
      await pg.query(`INSERT INTO organization_members(organization_id,user_id,role) VALUES($1,'rep-1','union_rep')`, [org])
    })
    const id = await thread('member-1', { staffId: 'rep-1' })
    expect(await findReadableThread(tx(), actor('rep-1', 'steward'), id)).toBeNull()
  })

  it('an inactive membership denies the conversation owner', async () => {
    const id = await thread('member-1')
    await asOwner(async () => {
      await pg.query(`INSERT INTO organization_members(organization_id,user_id,role,status) VALUES($1,'member-1','member','inactive')`, [org])
    })
    expect(await listThreads(tx(), member)).toEqual([])
    expect(await findReadableThread(tx(), member, id)).toBeNull()
  })

  it('a recorded recusal denies that conversation and leaves another assignment readable', async () => {
    const blocked = await thread('member-1', { staffId: 'steward-1' })
    const open = await thread('member-2', { staffId: 'steward-1' })
    await asOwner(async () => {
      await pg.exec(`CREATE TABLE IF NOT EXISTS ue_authority_recusals (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, principal_user_id text NOT NULL,
        resource_type text NOT NULL, resource_id uuid NOT NULL, reason text NOT NULL, declared_at timestamptz NOT NULL DEFAULT now(),
        lifted_at timestamptz, lifted_by text);
        GRANT SELECT ON ue_authority_recusals TO rt;`)
      await pg.query(`DELETE FROM ue_authority_recusals`)
      await pg.query(`INSERT INTO ue_authority_recusals(organization_id,principal_user_id,resource_type,resource_id,reason) VALUES($1,'steward-1','message_thread',$2,'conflict')`, [org, blocked])
    })
    expect(await findReadableThread(tx(), steward, blocked)).toBeNull()
    expect(await findReadableThread(tx(), steward, open)).not.toBeNull()
    expect(await findReadableThread(tx(), member, blocked)).not.toBeNull()
  })
})

describe('close and archive', () => {
  it('lets the member close, records how, audits without content, and ends replies for both sides', async () => {
    const id = await thread('member-1', { staffId: 'steward-1' })
    expect(await inTx((t) => changeThreadLifecycle(t, member, id, 'close'))).toEqual({ kind: 'ok', action: 'close' })

    const history = (await pg.query<Record<string, unknown>>(`SELECT action, acted_by, acted_via, reference FROM message_thread_lifecycle`)).rows
    expect(history).toEqual([{ action: 'close', acted_by: 'member-1', acted_via: 'thread_member', reference: null }])
    expect(await count(`SELECT count(*) AS n FROM message_threads WHERE id=$1 AND status='closed'`, [id])).toBe(1)
    expect(await count(`SELECT count(*) AS n FROM audit_security.audit_logs WHERE action='messages.thread.close'`)).toBe(1)
    expect(await postThreadMessage(tx(), member, id, { body: 'x' })).toEqual({ kind: 'closed' })
    expect(await postThreadMessage(tx(), steward, id, { body: 'x' })).toEqual({ kind: 'closed' })
    // Closed is final, and the content stays readable to both participants.
    expect(await inTx((t) => changeThreadLifecycle(t, steward, id, 'close'))).toEqual({ kind: 'conflict', code: 'ALREADY_CLOSED' })
    expect((await listThreadMessages(tx(), steward, id))!.map((m) => m.content)).toEqual([BODY])
  })

  it('lets the current assignee close and archive, and nobody else', async () => {
    const id = await thread('member-1', { staffId: 'steward-1' })
    for (const outsider of [actor('steward-2'), actor('member-2', 'member'), actor('triager-1'), actor('member-1', 'member', foreignOrg)]) {
      expect(await inTx((t) => changeThreadLifecycle(t, outsider, id, 'close'))).toEqual({ kind: 'not_found' })
    }
    expect(await inTx((t) => changeThreadLifecycle(t, steward, id, 'archive'))).toEqual({ kind: 'conflict', code: 'NOT_CLOSED' })
    expect(await inTx((t) => changeThreadLifecycle(t, steward, id, 'close'))).toEqual({ kind: 'ok', action: 'close' })
    expect(await inTx((t) => changeThreadLifecycle(t, steward, id, 'archive'))).toEqual({ kind: 'ok', action: 'archive' })
    expect(await inTx((t) => changeThreadLifecycle(t, member, id, 'archive'))).toEqual({ kind: 'conflict', code: 'ALREADY_ARCHIVED' })
    expect((await pg.query<{ action: string; acted_via: string }>(`SELECT action, acted_via FROM message_thread_lifecycle ORDER BY seq`)).rows).toEqual([
      { action: 'close', acted_via: 'current_assignee' },
      { action: 'archive', acted_via: 'current_assignee' },
    ])
    expect((await listThreads(tx(), member))[0]).toMatchObject({ isArchived: true, status: 'closed' })
    expect(await listThreadMessages(tx(), member, id)).toHaveLength(1)
  })

  it('rolls the close and its history back when the audit record cannot be written', async () => {
    const id = await thread('member-1')
    await asOwner(async () => {
      await pg.exec('REVOKE INSERT ON audit_security.audit_logs FROM rt')
    })
    await expect(inTx((t) => changeThreadLifecycle(t, member, id, 'close'))).rejects.toThrow()
    expect(await count(`SELECT count(*) AS n FROM message_threads WHERE id=$1 AND status='open'`, [id])).toBe(1)
    expect(await count(`SELECT count(*) AS n FROM message_thread_lifecycle`)).toBe(0)
  })

  it('the database refuses a status or archive change without its history, a reopen and an un-archive', async () => {
    const id = await thread('member-1')
    await expect(pg.transaction(async (c) => c.query(`UPDATE message_threads SET status='closed' WHERE id=$1`, [id]))).rejects.toThrow(/requires its lifecycle record/)
    await expect(pg.query(`UPDATE message_threads SET is_archived=true WHERE id=$1`, [id])).rejects.toThrow(/only a closed conversation can be archived/)
    expect(await inTx((t) => changeThreadLifecycle(t, member, id, 'close'))).toMatchObject({ kind: 'ok' })
    await expect(pg.query(`UPDATE message_threads SET status='open' WHERE id=$1`, [id])).rejects.toThrow(/can only move to closed/)
    expect(await inTx((t) => changeThreadLifecycle(t, member, id, 'archive'))).toMatchObject({ kind: 'ok' })
    await expect(pg.query(`UPDATE message_threads SET is_archived=false WHERE id=$1`, [id])).rejects.toThrow(/stays archived/)
  })

  it('keeps lifecycle history append-only and bound to its own tenant and thread state', async () => {
    const id = await thread('member-1')
    await expect(pg.query(`INSERT INTO message_thread_lifecycle(organization_id,thread_id,action,acted_by,acted_via) VALUES($1,$2,'close','member-1','thread_member')`, [org, id])).rejects.toThrow(/not closed/)
    await expect(pg.query(`INSERT INTO message_thread_lifecycle(organization_id,thread_id,action,acted_by,acted_via,reference) VALUES($1,$2,'hold_place','member-1','thread_member','x')`, [org, id])).rejects.toThrow(/message_lifecycle_hold_by_administrator/)
    await expect(pg.query(`INSERT INTO message_thread_lifecycle(organization_id,thread_id,action,acted_by,acted_via,reference) VALUES($1,$2,'hold_place','a','organization_administrator','x')`, [foreignOrg, id])).rejects.toThrow(/does not match a conversation/)
    expect(await inTx((t) => changeThreadLifecycle(t, member, id, 'close'))).toMatchObject({ kind: 'ok' })
    await expect(pg.query(`UPDATE message_thread_lifecycle SET acted_by='x'`)).rejects.toThrow(/permission denied/)
    await asOwner(async () => {
      await expect(pg.query(`UPDATE message_thread_lifecycle SET acted_by='x'`)).rejects.toThrow(/append-only/)
      await expect(pg.query(`DELETE FROM message_thread_lifecycle`)).rejects.toThrow(/append-only/)
    })
  })
})

describe('notifications never carry message text', () => {
  it('tells the assignee, the member and the triagers that something exists, with a link each side can open, and nothing else', async () => {
    await designate('triager-1')
    const created = await inTx((t) => createMemberThread(t, member, { subject: SUBJECT, body: BODY }))
    const assigned = await inTx((t) => assignThread(t, actor('triager-1'), { threadId: created.id, action: 'assign', toStaffId: 'steward-1' }, { assigneeEligible: async () => true }))
    expect(assigned).toMatchObject({ kind: 'ok' })
    expect(await postThreadMessage(tx(), steward, created.id, { body: `${BODY} reply` })).toMatchObject({ kind: 'ok' })
    expect(await postThreadMessage(tx(), member, created.id, { body: `${BODY} follow-up` })).toMatchObject({ kind: 'ok' })

    const rows = (await pg.query<{ user_id: string; title: string; message: string; action_url: string | null; data: { event: string } }>(
      `SELECT user_id, title, message, action_url, data FROM in_app_notifications ORDER BY created_at, user_id`,
    )).rows
    expect(rows.map((r) => `${r.user_id}:${r.data.event}`).sort()).toEqual([
      'member-1:thread_message',
      'steward-1:thread_assigned',
      'steward-1:thread_message',
      'triager-1:thread_triage_waiting',
    ])
    const byEvent = Object.fromEntries(rows.map((r) => [`${r.user_id}:${r.data.event}`, r]))
    expect(byEvent['steward-1:thread_assigned'].action_url).toBe(`/dashboard/messages/staff?thread=${created.id}`)
    expect(byEvent['steward-1:thread_message'].action_url).toBe(`/dashboard/messages/staff?thread=${created.id}`)
    expect(byEvent['member-1:thread_message'].action_url).toBe(`/dashboard/messages?thread=${created.id}`)
    expect(byEvent['triager-1:thread_triage_waiting'].action_url).toBeNull()
    expect(JSON.stringify(rows)).not.toMatch(/PRIVATE-BODY-TEXT|PRIVATE-SUBJECT/)
  })

  it('writes no message text, subject or hold reference into any audit record', async () => {
    const created = await inTx((t) => createMemberThread(t, member, { subject: SUBJECT, body: BODY }))
    await asOwner(async () => {
      await pg.query(`UPDATE message_threads SET staff_id=NULL WHERE id=$1`, [created.id])
    })
    await inTx((t) => assignThread(t, actor('steward-1'), { threadId: created.id, action: 'assign', toStaffId: 'steward-1' }, deps)).catch(() => undefined)
    await designate('triager-1')
    await inTx((t) => assignThread(t, actor('triager-1'), { threadId: created.id, action: 'assign', toStaffId: 'steward-1', reason: 'dues file' }, deps))
    await postThreadMessage(tx(), steward, created.id, { body: BODY })
    await inTx((t) => markThreadRead(t, member, created.id))
    expect(await inTx((t) => setLegalHold(t, admin, created.id, 'place', 'HOLD-REF-9921'))).toEqual({ kind: 'forbidden' })
    expect(await inTx((t) => adoptRetentionPolicy(t, admin, { retentionDays: 365, policyReference: 'POLICY-REF-1', authorityReference: 'AUTH-REF-1' }))).toEqual({ kind: 'forbidden' })
    await inTx((t) => changeThreadLifecycle(t, member, created.id, 'close'))
    await inTx((t) => changeThreadLifecycle(t, member, created.id, 'archive'))

    const audit = JSON.stringify((await pg.query(`SELECT action, resource_type, metadata FROM audit_security.audit_logs`)).rows)
    expect(audit).not.toMatch(/PRIVATE-BODY-TEXT|PRIVATE-SUBJECT|HOLD-REF-9921|POLICY-REF-1|AUTH-REF-1|dues file/)
    const actions = (await pg.query<{ action: string }>(`SELECT action FROM audit_security.audit_logs`)).rows.map((r) => r.action).sort()
    expect(actions).toEqual(
      [
        'messages.message.create',
        'messages.thread.archive',
        'messages.thread.assign',
        'messages.thread.close',
        'messages.thread.create',
        'messages.thread.read',
      ].sort(),
    )
  })
})

describe('retention is policy-parameterised, hold-aware and never deletes', () => {
  const closed = async (opts: { staffId?: string | null } = {}) => {
    const id = await thread('member-1', opts)
    await inTx((t) => changeThreadLifecycle(t, member, id, 'close'))
    return id
  }
  const retentionOf = async (id: string, now = new Date()) => {
    const row = (await pg.query<{ id: string; organization_id: string; status: string }>(`SELECT id, organization_id, status FROM message_threads WHERE id=$1`, [id])).rows[0]
    return threadRetention(tx(), { id: row.id, organizationId: row.organization_id, status: row.status }, now)
  }

  it('says "policy not adopted" until an organization records one, and never offers disposition', async () => {
    const open = await thread('member-2')
    const id = await closed()
    expect(await retentionOf(open)).toEqual({ state: 'not_closed' })
    expect(await retentionOf(id)).toEqual({ state: 'policy_not_adopted' })
    expect(await retentionOf(id, new Date(Date.now() + 100 * 365 * DAY))).toEqual({ state: 'policy_not_adopted' })
    expect(await count(`SELECT count(*) AS n FROM message_retention_policies`)).toBe(0)

    const detail = await getThreadDetail(tx(), member, id)
    expect(detail).toMatchObject({ viewerRole: 'member', canReply: false, canArchive: true, retention: { audience: 'member', state: 'policy_not_adopted' } })
  })

  it('takes the period only from a recorded policy, and an administrator title cannot record one', async () => {
    const id = await closed()
    expect(await inTx((t) => adoptRetentionPolicy(t, steward, { retentionDays: 30, policyReference: 'p', authorityReference: 'a' }))).toEqual({ kind: 'forbidden' })
    for (const days of [0, -1, 1.5, 36501]) {
      expect(await inTx((t) => adoptRetentionPolicy(t, admin, { retentionDays: days, policyReference: 'p', authorityReference: 'a' }))).toEqual({ kind: 'invalid' })
    }
    expect(await inTx((t) => adoptRetentionPolicy(t, admin, { retentionDays: 30, policyReference: ' ', authorityReference: 'a' }))).toEqual({ kind: 'invalid' })
    expect(await inTx((t) => adoptRetentionPolicy(t, admin, { retentionDays: 30, policyReference: 'p', authorityReference: '' }))).toEqual({ kind: 'invalid' })
    expect(await inTx((t) => adoptRetentionPolicy(t, admin, { retentionDays: 30, policyReference: 'Policy 1', authorityReference: 'Resolution 9' }))).toEqual({ kind: 'forbidden' })

    await asOwner(async () => {
      await pg.query(
        `INSERT INTO message_retention_policies(organization_id,policy_reference,authority_reference,retention_days,adopted_by) VALUES($1,'Policy 1','Resolution 9',30,$2)`,
        [org, admin.userId],
      )
    })
    expect(await retentionOf(id, new Date(Date.now() + 10 * DAY))).toMatchObject({ state: 'retained' })
    expect(await retentionOf(id, new Date(Date.now() + 31 * DAY))).toMatchObject({ state: 'retention_elapsed' })
    // Reporting that a period has elapsed deletes nothing.
    expect(await count(`SELECT count(*) AS n FROM messages`)).toBe(1)
    expect(await count(`SELECT count(*) AS n FROM message_threads`)).toBe(1)
    expect(await getThreadDetail(tx(), member, id, new Date(Date.now() + 90 * DAY))).toMatchObject({ retention: { audience: 'member', state: 'retained' } })
    expect(await getThreadDetail(tx(), steward, id, new Date())).toBeNull()

    // A later recorded policy supersedes the first. The application write is mandate-gated and is not reached here.
    await asOwner(async () => {
      await pg.query(`UPDATE message_retention_policies SET superseded_at=now(), superseded_by=$2 WHERE organization_id=$1 AND superseded_at IS NULL`, [org, admin.userId])
      await pg.query(
        `INSERT INTO message_retention_policies(organization_id,policy_reference,authority_reference,retention_days,adopted_by) VALUES($1,'Policy 2','Resolution 12',365,$2)`,
        [org, admin.userId],
      )
    })
    expect(await count(`SELECT count(*) AS n FROM message_retention_policies WHERE superseded_at IS NULL`)).toBe(1)
    expect(await count(`SELECT count(*) AS n FROM message_retention_policies`)).toBe(2)
    expect(await retentionOf(id, new Date(Date.now() + 31 * DAY))).toMatchObject({ state: 'retained' })
    await asOwner(async () => {
      await expect(pg.query(`DELETE FROM message_retention_policies`)).rejects.toThrow(/append-only/)
      await expect(pg.query(`UPDATE message_retention_policies SET retention_days = 1`)).rejects.toThrow(/superseded policy is final|only supersession/)
    })
  })

  it('an unauthorized adoption writes nothing, including when the audit insert is revoked', async () => {
    await asOwner(async () => {
      await pg.exec('REVOKE INSERT ON audit_security.audit_logs FROM rt')
    })
    expect(await inTx((t) => adoptRetentionPolicy(t, admin, { retentionDays: 30, policyReference: 'p', authorityReference: 'a' }))).toEqual({ kind: 'forbidden' })
    expect(await count(`SELECT count(*) AS n FROM message_retention_policies`)).toBe(0)
  })

  it('a legal hold is not an administrator role, and a recorded hold still overrides retention without granting a read', async () => {
    const id = await closed({ staffId: 'steward-1' })
    await asOwner(async () => {
      await pg.query(
        `INSERT INTO message_retention_policies(organization_id,policy_reference,authority_reference,retention_days,adopted_by) VALUES($1,'p','a',1,$2)`,
        [org, admin.userId],
      )
    })
    const later = new Date(Date.now() + 10 * DAY)
    expect(await retentionOf(id, later)).toMatchObject({ state: 'retention_elapsed' })

    expect(await inTx((t) => setLegalHold(t, steward, id, 'place', 'MATTER-1'))).toEqual({ kind: 'forbidden' })
    expect(await inTx((t) => setLegalHold(t, admin, id, 'place', '  '))).toEqual({ kind: 'invalid_reference' })
    expect(await inTx((t) => setLegalHold(t, admin, 'not-a-uuid', 'place', 'MATTER-1'))).toEqual({ kind: 'not_found' })
    expect(await inTx((t) => setLegalHold(t, actor('admin-9', 'admin', foreignOrg), id, 'place', 'MATTER-1'))).toEqual({ kind: 'not_found' })
    expect(await inTx((t) => setLegalHold(t, admin, id, 'place', 'MATTER-1'))).toEqual({ kind: 'forbidden' })
    expect(await inTx((t) => setLegalHold(t, admin, id, 'release', 'MATTER-1'))).toEqual({ kind: 'forbidden' })
    expect(await count(`SELECT count(*) AS n FROM message_thread_lifecycle WHERE action LIKE 'hold%'`)).toBe(0)

    await pg.query(
      `INSERT INTO message_thread_lifecycle(organization_id,thread_id,action,acted_by,acted_via,reference) VALUES($1,$2,'hold_place',$3,'organization_administrator','MATTER-1')`,
      [org, id, admin.userId],
    )
    expect(await retentionOf(id, later)).toEqual({ state: 'legal_hold' })
    expect(await getThreadDetail(tx(), steward, id, later)).toMatchObject({ viewerRole: 'assignee', retention: { audience: 'staff', state: 'legal_hold' } })
    const memberDetail = JSON.stringify(await getThreadDetail(tx(), member, id, later))
    expect(memberDetail).toContain('"state":"retained"')
    expect(memberDetail).not.toMatch(/legal|hold|MATTER-1/)
    expect(await findReadableThread(tx(), admin, id)).toBeNull()
    expect(await listThreadMessages(tx(), admin, id)).toBeNull()

    await pg.query(
      `INSERT INTO message_thread_lifecycle(organization_id,thread_id,action,acted_by,acted_via,reference) VALUES($1,$2,'hold_release',$3,'organization_administrator','MATTER-1 closed')`,
      [org, id, admin.userId],
    )
    expect(await retentionOf(id, later)).toMatchObject({ state: 'retention_elapsed' })
    expect((await pg.query<{ action: string }>(`SELECT action FROM message_thread_lifecycle WHERE action LIKE 'hold%' ORDER BY seq`)).rows.map((r) => r.action)).toEqual(['hold_place', 'hold_release'])
  })

  it('rolls a hold back when its audit record cannot be written, and refuses a hold without a reference in the database', async () => {
    const id = await thread('member-1')
    await expect(pg.query(`INSERT INTO message_thread_lifecycle(organization_id,thread_id,action,acted_by,acted_via,reference) VALUES($1,$2,'hold_place','a','organization_administrator','  ')`, [org, id])).rejects.toThrow(/message_lifecycle_hold_reference/)
    await asOwner(async () => {
      await pg.exec('REVOKE INSERT ON audit_security.audit_logs FROM rt')
    })
    expect(await inTx((t) => setLegalHold(t, admin, id, 'place', 'MATTER-1'))).toEqual({ kind: 'forbidden' })
    expect(await count(`SELECT count(*) AS n FROM message_thread_lifecycle`)).toBe(0)
  })

  it('refuses to count a closed conversation whose closing was never recorded', async () => {
    const id = await thread('member-1', { status: 'closed' })
    await asOwner(async () => {
      await pg.query(
        `INSERT INTO message_retention_policies(organization_id,policy_reference,authority_reference,retention_days,adopted_by) VALUES($1,'p','a',1,$2)`,
        [org, admin.userId],
      )
    })
    expect(await retentionOf(id, new Date(Date.now() + 100 * DAY))).toEqual({ state: 'closure_unrecorded' })
  })

  it('evaluates positions purely, with no default period', () => {
    const facts = { closedAt: new Date('2026-01-01T00:00:00Z'), archivedAt: null, held: false }
    expect(evaluateRetention({ status: 'closed' }, facts, null, new Date('2030-01-01'))).toEqual({ state: 'policy_not_adopted' })
    expect(evaluateRetention({ status: 'closed' }, facts, { retentionDays: 10 }, new Date('2026-01-05'))).toEqual({ state: 'retained', retainedUntil: '2026-01-11T00:00:00.000Z' })
    expect(evaluateRetention({ status: 'closed' }, facts, { retentionDays: 10 }, new Date('2026-01-11'))).toMatchObject({ state: 'retention_elapsed' })
    expect(evaluateRetention({ status: 'open' }, { ...facts, held: true }, null, new Date())).toEqual({ state: 'legal_hold' })
    expect(memberRetentionView({ state: 'legal_hold' })).toBe('retained')
    expect(memberRetentionView({ state: 'retention_elapsed', retainedUntil: 'x' })).toBe('retained')
  })
})

describe('read state', () => {
  it('shows each side that the other has read, without saying who, and writes only when something new was seen', async () => {
    const id = await thread('member-1', { staffId: 'steward-1' })
    await postThreadMessage(tx(), steward, id, { body: 'union reply' })
    expect((await listThreadMessages(tx(), member, id))!.map((m) => m.readByCounterpart)).toEqual([false, false])

    expect(await inTx((t) => markThreadRead(t, member, id))).toEqual({ kind: 'ok', changed: true })
    expect(await inTx((t) => markThreadRead(t, member, id))).toEqual({ kind: 'ok', changed: false })
    expect(await count(`SELECT count(*) AS n FROM audit_security.audit_logs WHERE action='messages.thread.read'`)).toBe(1)
    // The member read the union's reply, so the union's message is shown as read; their own is not read yet.
    expect((await listThreadMessages(tx(), steward, id))!.map((m) => [m.fromMe, m.readByCounterpart])).toEqual([[false, false], [true, true]])

    expect(await inTx((t) => markThreadRead(t, steward, id))).toEqual({ kind: 'ok', changed: true })
    // Only the viewer's own messages are shown as read in the UI; the flag on the other side's messages is not displayed.
    expect((await listThreadMessages(tx(), member, id))!.map((m) => [m.fromMe, m.readByCounterpart])).toEqual([[true, true], [false, true]])
    expect(JSON.stringify(await listThreadMessages(tx(), member, id))).not.toMatch(/steward-1|member-1/)

    expect(await inTx((t) => markThreadRead(t, actor('steward-2'), id))).toEqual({ kind: 'not_found' })
    expect(await inTx((t) => markThreadRead(t, actor('member-2', 'member'), id))).toEqual({ kind: 'not_found' })
    expect(await count(`SELECT count(*) AS n FROM message_thread_reads`)).toBe(2)
  })

  it('rolls the marker back with its audit, and the database keeps markers monotonic, tenant-bound and undeletable', async () => {
    const id = await thread('member-1', { staffId: 'steward-1' })
    await postThreadMessage(tx(), steward, id, { body: 'hello' })
    await asOwner(async () => {
      await pg.exec('REVOKE INSERT ON audit_security.audit_logs FROM rt')
    })
    await expect(inTx((t) => markThreadRead(t, member, id))).rejects.toThrow()
    expect(await count(`SELECT count(*) AS n FROM message_thread_reads`)).toBe(0)
    await asOwner(async () => {
      await pg.exec('GRANT INSERT ON audit_security.audit_logs TO rt')
    })
    await inTx((t) => markThreadRead(t, member, id))
    await expect(pg.query(`UPDATE message_thread_reads SET last_read_at = last_read_at - interval '1 day'`)).rejects.toThrow(/never moves backwards/)
    await expect(pg.query(`UPDATE message_thread_reads SET user_id = 'someone'`)).rejects.toThrow(/immutable/)
    await expect(pg.query(`INSERT INTO message_thread_reads(thread_id,user_id,organization_id,last_read_at) VALUES($1,'x',$2,now())`, [id, foreignOrg])).rejects.toThrow(/does not match a conversation/)
    await expect(pg.query(`DELETE FROM message_thread_reads`)).rejects.toThrow(/permission denied/)
  })
})
