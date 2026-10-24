import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import type { RLSTx } from '@/lib/db/with-rls-context'
import {
  assignThread,
  listTriageQueue,
} from './thread-assignment'
import { grantDesignation, listDesignations, revokeDesignation, TRIAGE_MAX_DAYS } from '@/lib/triage/designations'
import { createMemberThread, findReadableThread, listThreadMessages, listThreads } from './thread-access'

// Runs the real platform 0014 migration (tables, constraints and guard triggers) on PostgreSQL, then exercises the
// assignment contract as a role holding only the privileges the storage-authority manifest grants. RLS itself is
// scoped migration 0021 and is covered by the combined real-PostgreSQL suite; tenant predicates are asserted here.
const org = '11111111-1111-4111-8111-111111111111'
const foreignOrg = '22222222-2222-4222-8222-222222222222'
const DAY = 86_400_000
const NOW = new Date('2026-10-24T12:00:00.000Z')
const later = (days: number) => new Date(NOW.getTime() + days * DAY)

const MIGRATION = readFileSync(join(__dirname, '..', '..', 'db', 'migrations-platform', '0014_message_thread_triage.sql'), 'utf8')

let pg: PGlite
let db: ReturnType<typeof drizzle>
const tx = () => db as unknown as RLSTx
const inTx = <T>(fn: (t: RLSTx) => Promise<T>) => db.transaction(async (t) => fn(t as unknown as RLSTx))

const staff = new Set(['triager-1', 'triager-2', 'steward-1', 'steward-2', 'steward-3'])
const deps = { assigneeEligible: async (id: string) => staff.has(id), now: () => NOW }
const who = (userId: string, organizationId = org) => ({ userId, organizationId })

const nthread = async (memberId: string, opts: { org?: string; staffId?: string | null; status?: string; archived?: boolean } = {}) => {
  const id = randomUUID()
  await pg.query(
    `INSERT INTO message_threads(id,subject,member_id,staff_id,organization_id,status,is_archived) VALUES($1,$2,$3,$4,$5,$6,$7)`,
    [id, `subject ${id.slice(0, 4)}`, memberId, opts.staffId ?? null, opts.org ?? org, opts.status ?? 'open', opts.archived ?? false],
  )
  await pg.query(`INSERT INTO messages(thread_id,sender_id,sender_role,content) VALUES($1,$2,'member','PRIVATE-BODY-TEXT')`, [id, memberId])
  return id
}

const designate = (userId: string, days = 30, organizationId = org) =>
  pg.query(`INSERT INTO triage_designations(organization_id,scope,user_id,granted_by,granted_at,expires_at) VALUES($1,'messages',$2,'admin-1',$3,$4)`, [
    organizationId,
    userId,
    new Date(NOW.getTime() - DAY).toISOString(),
    later(days).toISOString(),
  ])

const count = async (sqlText: string, params: unknown[] = []) => Number(((await pg.query<{ n: string }>(sqlText, params)).rows[0] as { n: string }).n)

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
    CREATE SCHEMA audit_security;
    CREATE TABLE audit_security.audit_logs(
      audit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid, user_id varchar(255),
      action varchar(100) NOT NULL, resource_type varchar(50) NOT NULL, resource_id uuid, old_values jsonb, new_values jsonb,
      ip_address varchar(45), user_agent text, session_id uuid, correlation_id uuid, severity varchar(20) DEFAULT 'info',
      outcome varchar(20) DEFAULT 'success', error_message text, metadata jsonb DEFAULT '{}'::jsonb,
      archived boolean NOT NULL DEFAULT false, archived_at timestamptz, archived_path text, created_at timestamptz DEFAULT now());
  `)
  for (const statement of MIGRATION.split('--> statement-breakpoint')) {
    if (statement.replace(/--.*$/gm, '').trim()) await pg.exec(statement)
  }
  // The privileges the storage-authority manifest grants, and nothing more.
  await pg.exec(`
    CREATE ROLE rt NOLOGIN;
    GRANT USAGE ON SCHEMA audit_security TO rt;
    GRANT SELECT, INSERT, UPDATE ON message_threads TO rt;
    GRANT SELECT, INSERT ON messages, in_app_notifications, message_thread_assignments TO rt;
    GRANT SELECT, INSERT, UPDATE ON triage_designations TO rt;
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
  // Test data resets run as the owner; the role is restored for the assertions.
  await pg.exec(`
    ALTER TABLE triage_designations DISABLE TRIGGER USER;
    ALTER TABLE message_thread_assignments DISABLE TRIGGER USER;
    ALTER TABLE message_threads DISABLE TRIGGER USER;
    TRUNCATE message_thread_assignments, triage_designations, messages, in_app_notifications, message_threads CASCADE;
    TRUNCATE audit_security.audit_logs;
    ALTER TABLE triage_designations ENABLE TRIGGER USER;
    ALTER TABLE message_thread_assignments ENABLE TRIGGER USER;
    ALTER TABLE message_threads ENABLE TRIGGER USER;
    GRANT INSERT ON audit_security.audit_logs TO rt;
    SET ROLE rt;
  `)
})

// Fixture writes need owner rights for the designation table, which the runtime writes only through the API.
const asOwner = async <T>(fn: () => Promise<T>) => {
  await pg.exec('RESET ROLE')
  try {
    return await fn()
  } finally {
    await pg.exec('SET ROLE rt')
  }
}

describe('triage queue visibility', () => {
  it('shows unassigned open conversations as metadata only, and only to a live designation holder', async () => {
    await asOwner(async () => {
      await designate('triager-1')
    })
    const waiting = await asOwner(() => nthread('member-1'))
    await asOwner(async () => {
      await nthread('member-2', { staffId: 'steward-1' })
      await nthread('member-3', { status: 'closed' })
      await nthread('member-4', { archived: true })
      await nthread('triager-1')
      await nthread('member-5', { org: foreignOrg })
    })
    const queue = await listTriageQueue(tx(), who('triager-1'), NOW)
    expect(queue!.map((q) => q.id)).toEqual([waiting])
    const serialized = JSON.stringify(queue)
    expect(serialized).not.toMatch(/PRIVATE-BODY-TEXT|member-1|memberId|staffId/)

    // A staff member without a designation learns nothing; neither does a person in another organization.
    expect(await listTriageQueue(tx(), who('steward-1'), NOW)).toBeNull()
    expect(await listTriageQueue(tx(), who('triager-1', foreignOrg), NOW)).toBeNull()
  })

  it('stops showing the queue when the designation expires or is revoked', async () => {
    await asOwner(async () => {
      await designate('triager-1', 5)
      await designate('triager-2', 30)
      await nthread('member-1')
    })
    expect(await listTriageQueue(tx(), who('triager-1'), later(4))).not.toBeNull()
    expect(await listTriageQueue(tx(), who('triager-1'), later(6))).toBeNull()

    const live = (await pg.query<{ id: string }>(`SELECT id FROM triage_designations WHERE user_id='triager-2'`)).rows[0]
    expect(await inTx((t) => revokeDesignation(t, who('admin-1'), live.id, { now: () => later(1) }))).toEqual({ kind: 'ok' })
    expect(await listTriageQueue(tx(), who('triager-2'), later(1))).toBeNull()
  })

  it('notifies live triagers, without content, when a member starts a conversation', async () => {
    await asOwner(async () => {
      await designate('triager-1')
      await designate('triager-2')
    })
    await inTx((t) => createMemberThread(t, { userId: 'member-9', organizationId: org, role: 'member' }, { subject: 'Hours dispute', body: 'PRIVATE-BODY-TEXT' }))
    const rows = (await pg.query<{ user_id: string; message: string; data: unknown }>(`SELECT user_id, message, data FROM in_app_notifications ORDER BY user_id`)).rows
    expect(rows.map((r) => r.user_id)).toEqual(['triager-1', 'triager-2'])
    expect(JSON.stringify(rows)).not.toMatch(/PRIVATE-BODY-TEXT|Hours dispute|member-9/)
    expect(await count(`SELECT count(*) AS n FROM audit_security.audit_logs WHERE action='messages.thread.create'`)).toBe(1)
  })
})

describe('assignment', () => {
  it('lets a triager assign an unassigned conversation, after which the assignee can read and act on it', async () => {
    await asOwner(async () => {
      await designate('triager-1')
    })
    const id = await asOwner(() => nthread('member-1'))
    const result = await inTx((t) => assignThread(t, who('triager-1'), { threadId: id, action: 'assign', toStaffId: 'steward-1', reason: 'Dues file' }, deps))
    expect(result).toEqual({ kind: 'ok', action: 'assign', staffId: 'steward-1' })

    const history = (await pg.query<Record<string, unknown>>(`SELECT action, from_staff_id, to_staff_id, acted_by, acted_via, reason FROM message_thread_assignments`)).rows
    expect(history).toEqual([{ action: 'assign', from_staff_id: null, to_staff_id: 'steward-1', acted_by: 'triager-1', acted_via: 'triage_designation', reason: 'Dues file' }])
    expect(await count(`SELECT count(*) AS n FROM audit_security.audit_logs WHERE action='messages.thread.assign'`)).toBe(1)
    const notice = (await pg.query<{ user_id: string; message: string }>(`SELECT user_id, message FROM in_app_notifications`)).rows
    expect(notice).toEqual([{ user_id: 'steward-1', message: 'A member conversation has been assigned to you.' }])

    const assignee = { userId: 'steward-1', organizationId: org, role: 'steward' as const }
    expect((await listThreads(tx(), assignee)).map((t) => t.id)).toEqual([id])
    expect((await listThreadMessages(tx(), assignee, id))!.length).toBe(1)
    // The triager no longer sees it, and never saw the content.
    expect(await findReadableThread(tx(), { userId: 'triager-1', organizationId: org, role: 'steward' }, id)).toBeNull()
    expect(await listTriageQueue(tx(), who('triager-1'), NOW)).toEqual([])
  })

  it('refuses callers who hold neither the thread nor a live designation, indistinguishable from a missing thread', async () => {
    const id = await asOwner(() => nthread('member-1'))
    await asOwner(async () => {
      await designate('triager-1', 30, foreignOrg)
    })
    for (const caller of [who('steward-2'), who('triager-1')]) {
      expect(await inTx((t) => assignThread(t, caller, { threadId: id, action: 'assign', toStaffId: 'steward-1' }, deps))).toEqual({ kind: 'not_found' })
    }
    expect(await inTx((t) => assignThread(t, who('triager-1'), { threadId: 'not-a-uuid', action: 'release' }, deps))).toEqual({ kind: 'not_found' })
    expect(await count(`SELECT count(*) AS n FROM message_thread_assignments`)).toBe(0)
  })

  it('refuses an ineligible assignee, the conversation\'s own member, and assigning an already assigned thread', async () => {
    await asOwner(async () => {
      await designate('triager-1')
    })
    const id = await asOwner(() => nthread('steward-3'))
    expect(await inTx((t) => assignThread(t, who('triager-1'), { threadId: id, action: 'assign', toStaffId: 'someone-else' }, deps))).toEqual({ kind: 'ineligible_assignee' })
    expect(await inTx((t) => assignThread(t, who('triager-1'), { threadId: id, action: 'assign', toStaffId: 'steward-3' }, deps))).toEqual({ kind: 'ineligible_assignee' })
    expect(await inTx((t) => assignThread(t, who('triager-1'), { threadId: id, action: 'assign', toStaffId: 'steward-1' }, deps))).toMatchObject({ kind: 'ok' })
    expect(await inTx((t) => assignThread(t, who('triager-1'), { threadId: id, action: 'assign', toStaffId: 'steward-2' }, deps))).toEqual({ kind: 'conflict', code: 'ALREADY_ASSIGNED' })
  })

  it('never lets a person decide who serves their own conversation', async () => {
    await asOwner(async () => {
      await designate('triager-1')
    })
    const own = await asOwner(() => nthread('triager-1'))
    expect(await inTx((t) => assignThread(t, who('triager-1'), { threadId: own, action: 'assign', toStaffId: 'steward-1' }, deps))).toEqual({ kind: 'forbidden' })
    expect(await count(`SELECT count(*) AS n FROM message_threads WHERE staff_id IS NOT NULL`)).toBe(0)
  })

  it('lets the current assignee delegate and release, and records how each decision was authorized', async () => {
    const id = await asOwner(() => nthread('member-1', { staffId: 'steward-1' }))
    expect(await inTx((t) => assignThread(t, who('steward-1'), { threadId: id, action: 'reassign', toStaffId: 'steward-2', reason: 'Escalation' }, deps))).toEqual({ kind: 'ok', action: 'reassign', staffId: 'steward-2' })
    // The previous assignee has lost the thread.
    expect(await inTx((t) => assignThread(t, who('steward-1'), { threadId: id, action: 'release' }, deps))).toEqual({ kind: 'not_found' })
    expect(await inTx((t) => assignThread(t, who('steward-2'), { threadId: id, action: 'reassign', toStaffId: 'steward-2' }, deps))).toEqual({ kind: 'conflict', code: 'SAME_ASSIGNEE' })
    expect(await inTx((t) => assignThread(t, who('steward-2'), { threadId: id, action: 'release' }, deps))).toEqual({ kind: 'ok', action: 'release', staffId: null })
    expect((await pg.query<{ action: string; acted_via: string }>(`SELECT action, acted_via FROM message_thread_assignments ORDER BY created_at, action`)).rows.map((r) => `${r.action}:${r.acted_via}`).sort()).toEqual([
      'reassign:current_assignee',
      'release:current_assignee',
    ])
    // Released conversations return to the queue for designated triagers.
    await asOwner(async () => {
      await designate('triager-1')
    })
    expect((await listTriageQueue(tx(), who('triager-1'), NOW))!.map((q) => q.id)).toEqual([id])
  })

  it('does not assign closed conversations', async () => {
    await asOwner(async () => {
      await designate('triager-1')
    })
    const id = await asOwner(() => nthread('member-1', { status: 'closed' }))
    expect(await inTx((t) => assignThread(t, who('triager-1'), { threadId: id, action: 'assign', toStaffId: 'steward-1' }, deps))).toEqual({ kind: 'closed' })
  })

  it('rolls the assignment, its history and notice back when the audit record cannot be written', async () => {
    await asOwner(async () => {
      await designate('triager-1')
    })
    const id = await asOwner(() => nthread('member-1'))
    await asOwner(async () => {
      await pg.exec('REVOKE INSERT ON audit_security.audit_logs FROM rt')
    })
    await expect(inTx((t) => assignThread(t, who('triager-1'), { threadId: id, action: 'assign', toStaffId: 'steward-1' }, deps))).rejects.toThrow()
    expect(await count(`SELECT count(*) AS n FROM message_threads WHERE id=$1 AND staff_id IS NOT NULL`, [id])).toBe(0)
    expect(await count(`SELECT count(*) AS n FROM message_thread_assignments`)).toBe(0)
    expect(await count(`SELECT count(*) AS n FROM in_app_notifications`)).toBe(0)
  })

  it('lets exactly one of two concurrent assignments win', async () => {
    await asOwner(async () => {
      await designate('triager-1')
      await designate('triager-2')
    })
    const id = await asOwner(() => nthread('member-1'))
    const [a, b] = await Promise.all([
      inTx((t) => assignThread(t, who('triager-1'), { threadId: id, action: 'assign', toStaffId: 'steward-1' }, deps)),
      inTx((t) => assignThread(t, who('triager-2'), { threadId: id, action: 'assign', toStaffId: 'steward-2' }, deps)),
    ])
    expect([a.kind, b.kind].sort()).toEqual(['conflict', 'ok'])
    expect(await count(`SELECT count(*) AS n FROM message_thread_assignments`)).toBe(1)
  })
})

describe('designations', () => {
  it('grants an expiring designation to eligible staff, audited, and refuses self-grants, long terms and duplicates', async () => {
    const admin = who('admin-1')
    const granted = await inTx((t) => grantDesignation(t, admin, { scope: 'messages', userId: 'triager-1', expiresAt: later(30) }, deps))
    expect(granted).toMatchObject({ kind: 'ok', designation: { userId: 'triager-1', grantedBy: 'admin-1', revokedAt: null } })
    expect(await count(`SELECT count(*) AS n FROM audit_security.audit_logs WHERE action='triage.designation.grant'`)).toBe(1)

    expect(await inTx((t) => grantDesignation(t, admin, { scope: 'messages', userId: 'triager-1', expiresAt: later(30) }, deps))).toEqual({ kind: 'conflict' })
    expect(await inTx((t) => grantDesignation(t, admin, { scope: 'messages', userId: 'admin-1', expiresAt: later(30) }, deps))).toEqual({ kind: 'self_grant' })
    expect(await inTx((t) => grantDesignation(t, admin, { scope: 'messages', userId: 'triager-2', expiresAt: later(TRIAGE_MAX_DAYS + 1) }, deps))).toEqual({ kind: 'invalid_expiry' })
    expect(await inTx((t) => grantDesignation(t, admin, { scope: 'messages', userId: 'triager-2', expiresAt: later(-1) }, deps))).toEqual({ kind: 'invalid_expiry' })
    expect(await inTx((t) => grantDesignation(t, admin, { scope: 'messages', userId: 'a-member', expiresAt: later(30) }, deps))).toEqual({ kind: 'ineligible' })
    expect((await listDesignations(tx(), admin)).map((d) => d.userId)).toEqual(['triager-1'])
    expect(await listDesignations(tx(), who('admin-1', foreignOrg))).toEqual([])
  })

  it('allows a fresh grant once a previous designation has lapsed, recording the lapse', async () => {
    await asOwner(async () => {
      await designate('triager-1', 5)
    })
    const result = await inTx((t) => grantDesignation(t, who('admin-1'), { scope: 'messages', userId: 'triager-1', expiresAt: later(40) }, { ...deps, now: () => later(10) }))
    expect(result.kind).toBe('ok')
    const rows = (await pg.query<{ revoked_by: string | null }>(`SELECT revoked_by FROM triage_designations ORDER BY granted_at`)).rows
    expect(rows.map((r) => r.revoked_by)).toEqual(['system:expiry', null])
  })
})

describe('database integrity (guard triggers)', () => {
  it('refuses a staff_id change without its history record at commit, and any change to tenant, owner or subject', async () => {
    const id = await asOwner(() => nthread('member-1'))
    await expect(pg.query(`UPDATE message_threads SET staff_id='steward-1' WHERE id=$1`, [id])).rejects.toThrow(/requires its history record/)
    await expect(pg.query(`UPDATE message_threads SET member_id='member-2' WHERE id=$1`, [id])).rejects.toThrow(/immutable/)
    await expect(pg.query(`UPDATE message_threads SET organization_id=$2 WHERE id=$1`, [id, foreignOrg])).rejects.toThrow(/immutable/)
    await expect(pg.query(`UPDATE message_threads SET subject='changed' WHERE id=$1`, [id])).rejects.toThrow(/immutable/)
    expect(await count(`SELECT count(*) AS n FROM message_threads WHERE id=$1 AND staff_id IS NULL AND member_id='member-1'`, [id])).toBe(1)
  })

  it('refuses a history record that names a different tenant or assignee than the thread', async () => {
    const id = await asOwner(() => nthread('member-1'))
    await expect(
      pg.query(
        `INSERT INTO message_thread_assignments(organization_id,thread_id,action,from_staff_id,to_staff_id,acted_by,acted_via) VALUES($1,$2,'reassign','x','steward-1','a','current_assignee')`,
        [org, id],
      ),
    ).rejects.toThrow(/does not match the thread/)
    await expect(
      pg.query(`INSERT INTO message_thread_assignments(organization_id,thread_id,action,to_staff_id,acted_by,acted_via) VALUES($1,$2,'assign','steward-1','a','triage_designation')`, [foreignOrg, id]),
    ).rejects.toThrow(/does not match the thread/)
  })

  it('keeps assignment history and designations append-only', async () => {
    await asOwner(async () => {
      await designate('triager-1')
    })
    const id = await asOwner(() => nthread('member-1'))
    await inTx((t) => assignThread(t, who('triager-1'), { threadId: id, action: 'assign', toStaffId: 'steward-1' }, deps))
    await expect(pg.query(`UPDATE message_thread_assignments SET reason='edited'`)).rejects.toThrow(/permission denied|append-only/)
    await expect(pg.query(`DELETE FROM triage_designations`)).rejects.toThrow(/permission denied|append-only/)
    await asOwner(async () => {
      await expect(pg.query(`UPDATE message_thread_assignments SET reason='edited'`)).rejects.toThrow(/append-only/)
      await expect(pg.query(`DELETE FROM triage_designations`)).rejects.toThrow(/append-only/)
      await expect(pg.query(`UPDATE triage_designations SET expires_at = expires_at + interval '1 year'`)).rejects.toThrow(/only revocation/)
    })
  })

  it('refuses a self-granted designation and an expiry that precedes the grant', async () => {
    await asOwner(async () => {
      await expect(pg.query(`INSERT INTO triage_designations(organization_id,scope,user_id,granted_by,expires_at) VALUES($1,'messages','x','x',now()+interval '1 day')`, [org])).rejects.toThrow(/no_self_grant/)
      await expect(pg.query(`INSERT INTO triage_designations(organization_id,scope,user_id,granted_by,expires_at) VALUES($1,'messages','x','y',now()-interval '1 day')`, [org])).rejects.toThrow(/expiry_after_grant/)
    })
  })
})
