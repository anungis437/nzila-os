import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import type { CaseActor } from '@/lib/cases/case-authorization'
import type { RLSTx } from '@/lib/db/with-rls-context'
import {
  createMemberThread,
  findReadableThread,
  listThreadMessages,
  listThreads,
  postThreadMessage,
} from './thread-access'

// PostgreSQL regression for conversation participation. The tables carry tenant RLS only, so the
// participant scope in thread-access is the barrier between members of the same organization.
// The engine runs as a role holding only the runtime privileges the storage-authority manifest grants
// (SELECT and INSERT), so any UPDATE or row lock it attempted would fail here as it does in the database.
const org = '11111111-1111-4111-8111-111111111111'
const foreignOrg = '22222222-2222-4222-8222-222222222222'
const SECRET = 'PRIVATE-OTHER-MEMBER-CONVERSATION'

let pg: PGlite
let tx: RLSTx
const ids = { own: randomUUID(), other: randomUUID(), assigned: randomUUID(), foreign: randomUUID(), closed: randomUUID() }

const actor = (userId: string, role: CaseActor['role'], organizationId = org): CaseActor => ({ userId, organizationId, role })
const member1 = actor('member-1', 'member')

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
  `)
  // Platform 0014 adds the assignment tables; they are installed from the real migration file.
  await pg.exec(`
    CREATE SCHEMA audit_security;
    CREATE TABLE audit_security.audit_logs(
      audit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid, user_id varchar(255),
      action varchar(100) NOT NULL, resource_type varchar(50) NOT NULL, resource_id uuid, old_values jsonb, new_values jsonb,
      ip_address varchar(45), user_agent text, session_id uuid, correlation_id uuid, severity varchar(20) DEFAULT 'info',
      outcome varchar(20) DEFAULT 'success', error_message text, metadata jsonb DEFAULT '{}'::jsonb,
      archived boolean NOT NULL DEFAULT false, archived_at timestamptz, archived_path text, created_at timestamptz DEFAULT now());
  `)
  for (const statement of readFileSync(join(__dirname, '..', '..', 'db', 'migrations-platform', '0014_message_thread_triage.sql'), 'utf8').split('--> statement-breakpoint')) {
    if (statement.replace(/--.*$/gm, '').trim()) await pg.exec(statement)
  }
  // These functions never update or lock a thread, so the role keeps SELECT and INSERT only on it.
  await pg.exec(`CREATE ROLE rt NOLOGIN;
    GRANT SELECT, INSERT ON message_threads, messages, in_app_notifications, triage_designations TO rt;
    GRANT USAGE ON SCHEMA audit_security TO rt; GRANT SELECT, INSERT ON audit_security.audit_logs TO rt;`)
  tx = drizzle(pg) as unknown as RLSTx
  const rows: Array<[keyof typeof ids, string, string, string | null, string]> = [
    ['own', org, 'member-1', null, 'open'],
    ['other', org, 'member-2', null, 'open'],
    ['assigned', org, 'member-3', 'steward-1', 'open'],
    ['foreign', foreignOrg, 'member-1', null, 'open'],
    ['closed', org, 'member-1', null, 'closed'],
  ]
  for (const [name, orgId, memberId, staffId, status] of rows) {
    await pg.query(`INSERT INTO message_threads(id,subject,member_id,staff_id,organization_id,status) VALUES($1,$2,$3,$4,$5,$6)`, [ids[name], `subject ${name}`, memberId, staffId, orgId, status])
    await pg.query(
      `INSERT INTO messages(thread_id,sender_id,sender_role,content) VALUES($1,$2,'member',$3),($1,'staff-9','staff',$4)`,
      [ids[name], memberId, name === 'other' ? SECRET : `hello ${name}`, name === 'other' ? SECRET : `reply ${name}`],
    )
  }
})
afterAll(async () => { await pg?.close() })

beforeAll(async () => { await pg.exec('SET ROLE rt') })

describe('conversation participation against PostgreSQL', () => {
  it('runs under the restricted runtime role, which cannot update or lock thread rows', async () => {
    expect(((await pg.query('SELECT current_user AS u')).rows[0] as { u: string }).u).toBe('rt')
    await expect(pg.query(`UPDATE message_threads SET status = 'open'`)).rejects.toThrow(/permission denied/)
    await expect(pg.query(`SELECT id FROM message_threads FOR UPDATE`)).rejects.toThrow(/permission denied/)
  })

  it('lists only the member\'s own threads in their organization', async () => {
    const own = (await listThreads(tx, member1)).map((t) => t.id)
    expect(own.sort()).toEqual([ids.own, ids.closed].sort())
  })

  it('denies another member\'s thread for read, messages, post and mark-read (indistinguishable from missing)', async () => {
    expect(await findReadableThread(tx, member1, ids.other)).toBeNull()
    expect(await listThreadMessages(tx, member1, ids.other)).toBeNull()
    expect(await postThreadMessage(tx, member1, ids.other, { body: 'x' })).toEqual({ kind: 'not_found' })
    expect(await listThreadMessages(tx, member1, randomUUID())).toBeNull()
    const { rows } = await pg.query(`SELECT count(*)::int AS n FROM messages WHERE thread_id=$1 AND sender_id='member-1'`, [ids.other])
    expect((rows[0] as { n: number }).n).toBe(0)
  })

  it('denies cross-organization threads even for the same user id', async () => {
    expect(await findReadableThread(tx, member1, ids.foreign)).toBeNull()
    expect(await findReadableThread(tx, actor('member-1', 'member', foreignOrg), ids.own)).toBeNull()
  })

  it('never exposes sender identifiers, metadata or other members\' content', async () => {
    const msgs = (await listThreadMessages(tx, member1, ids.own))!
    expect(msgs.map((m) => [m.fromMe, m.senderKind])).toEqual([[true, 'member'], [false, 'union']])
    expect(JSON.stringify(msgs)).not.toMatch(/staff-9|member-1|metadata|readAt/)
    const threads = JSON.stringify(await listThreads(tx, member1))
    expect(threads).not.toContain(SECRET)
    expect(threads).not.toContain('steward-1')
  })

  it('limits staff to assigned or own threads; seniority grants no tenant-wide read', async () => {
    const steward = actor('steward-1', 'steward')
    expect((await listThreads(tx, steward)).map((t) => t.id)).toEqual([ids.assigned])
    expect(await findReadableThread(tx, steward, ids.other)).toBeNull()
    for (const role of ['chief_steward', 'officer', 'admin'] as const) {
      const senior = actor(`${role}-1`, role)
      expect(await listThreads(tx, senior)).toEqual([])
      expect(await findReadableThread(tx, senior, ids.other)).toBeNull()
      expect(await findReadableThread(tx, senior, ids.assigned)).toBeNull()
    }
  })

  it('posts to an owned thread, de-duplicates a repeated submission and notifies only the counterpart without content', async () => {
    const clientRequestId = randomUUID()
    const assignedMember = actor('member-3', 'member')
    const first = await postThreadMessage(tx, assignedMember, ids.assigned, { body: 'secret-body-text', clientRequestId })
    const second = await postThreadMessage(tx, assignedMember, ids.assigned, { body: 'secret-body-text', clientRequestId })
    expect(first).toMatchObject({ kind: 'ok', duplicate: false })
    expect(second).toMatchObject({ kind: 'ok', duplicate: true })
    const { rows } = await pg.query(`SELECT user_id, message FROM in_app_notifications`)
    expect(rows).toHaveLength(1)
    expect((rows[0] as { user_id: string }).user_id).toBe('steward-1')
    expect(JSON.stringify(rows)).not.toContain('secret-body-text')
  })

  it('refuses posts to a closed thread', async () => {
    expect(await postThreadMessage(tx, member1, ids.closed, { body: 'hi' })).toEqual({ kind: 'closed' })
  })

  it('suppresses the counterpart notice when their preference declines it, but still delivers the message', async () => {
    const before = ((await pg.query(`SELECT count(*)::int AS n FROM in_app_notifications`)).rows[0] as { n: number }).n
    const result = await postThreadMessage(tx, actor('member-3', 'member'), ids.assigned, { body: 'quiet' }, async () => false)
    expect(result).toMatchObject({ kind: 'ok', duplicate: false })
    const after = ((await pg.query(`SELECT count(*)::int AS n FROM in_app_notifications`)).rows[0] as { n: number }).n
    expect(after).toBe(before)
  })

  it('creates a member-owned thread whose last activity comes from its messages', async () => {
    const thread = await createMemberThread(tx, member1, { subject: 'Question', body: 'Hello' })
    expect(thread.memberId).toBe('member-1')
    expect(thread.organizationId).toBe(org)
    const listed = (await listThreads(tx, member1)).find((t) => t.id === thread.id)!
    expect(listed.lastMessageAt).not.toBeNull()
    expect((await listThreads(tx, member1))[0].id).toBe(thread.id)
  })

})
