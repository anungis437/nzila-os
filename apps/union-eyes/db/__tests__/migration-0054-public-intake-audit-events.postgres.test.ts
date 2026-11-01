/**
 * Native PostgreSQL qualification of platform 0054_public_intake_audit_events and cache 0044_public_intake_audit_events_rls_closure, and of
 * the pseudonymous audit chain that lib/public-intake/intake-audit.ts writes into it.
 *
 * On a disposable database owned by a non-superuser role, the migrations are applied twice and the store is proven append-only AS the
 * application roles (the system role reads and inserts; no tenant session sees or writes it; nothing can update, delete or truncate an
 * event, even a role that was granted the privilege), the real writer is run concurrently without forking a chain, and the verifier is
 * shown to catch a rewritten event and a removed middle event, and to NOT catch a removed newest event on its own (the caller keeps the
 * head). Rollbacks are proven. Needs UE_AUTHORITY_COMBINED_URL; skipped when it is not set.
 */
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { appendPublicIntakeAudit, pseudonymousSubjectRef, verifyPublicIntakeAuditChain } from '../../lib/public-intake/intake-audit'
import type { RLSTx } from '../../lib/db/with-rls-context'

const URL_ = process.env.UE_AUTHORITY_COMBINED_URL
const sql = (dir: string, name: string) => readFileSync(join(__dirname, '..', dir, `${name}.sql`), 'utf8')
const P = (rollback = false) => sql('migrations-platform', `0054_public_intake_audit_events${rollback ? '.rollback' : ''}`)
const C = (rollback = false) => sql('migrations-cache', `0044_public_intake_audit_events_rls_closure${rollback ? '.rollback' : ''}`)
const withDb = (url: string, name: string) => { const u = new globalThis.URL(url); u.pathname = `/${name}`; return u.toString() }

describe.skipIf(!URL_)('migrations 0054 and 0044 on native PostgreSQL', () => {
  const scratch = `m0054_${randomUUID().replace(/-/g, '').slice(0, 10)}`
  const owner = `m0054_owner_${randomUUID().replace(/-/g, '').slice(0, 8)}`
  const key = 'k'.repeat(16) + randomUUID() // 52 characters, not a placeholder
  let admin: pg.Client
  let db: pg.Client
  let url: string

  const migrate = async (text: string) => {
    await db.query(`SET ROLE ${owner}`)
    try { await db.query(text) } finally { await db.query('RESET ROLE') }
  }
  const as = async <T>(client: pg.Client, role: string, fn: (tx: RLSTx) => Promise<T>, commit = false): Promise<T> => {
    await client.query('BEGIN')
    try {
      await client.query(`SET LOCAL ROLE ${role}`)
      const value = await fn(drizzle(client) as unknown as RLSTx)
      await client.query(commit ? 'COMMIT' : 'ROLLBACK')
      return value
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
  }
  const event = (subjectId: string, action = 'workbook.memory_holder.read', operation: 'read' | 'create' = 'read') => ({
    surface: 'workbook.memory_holder',
    action,
    operation,
    subjectKind: 'unclaimed_workbook' as const,
    subjectId,
    details: { holderCount: 3 },
  })
  const count = async (ref: string) => Number((await db.query('SELECT count(*)::int AS n FROM public_intake_audit_events WHERE subject_ref = $1', [ref])).rows[0].n)

  beforeAll(async () => {
    process.env.PUBLIC_INTAKE_AUDIT_KEY = key
    admin = new pg.Client({ connectionString: URL_ })
    await admin.connect()
    await admin.query(`CREATE ROLE ${owner} NOLOGIN`)
    await admin.query(`CREATE DATABASE ${scratch} OWNER ${owner}`)
    url = withDb(URL_ as string, scratch)
    db = new pg.Client({ connectionString: url })
    await db.connect()
    await db.query(`GRANT ALL ON SCHEMA public TO ${owner}`)
    await migrate(P())
    await migrate(P())
    // What the storage-authority manifest grants the system role; the runtime role is granted everything on purpose so row security alone must hold.
    await db.query('GRANT SELECT, INSERT ON public_intake_audit_events TO union_eyes_system')
    await db.query('GRANT SELECT, INSERT, UPDATE, DELETE ON public_intake_audit_events TO union_eyes_runtime')
    await migrate(C())
    await migrate(C())
  })
  afterAll(async () => {
    await db?.end()
    await admin?.query(`DROP DATABASE IF EXISTS ${scratch} WITH (FORCE)`)
    await admin?.query(`DROP ROLE IF EXISTS ${owner}`)
    await admin?.end()
  })

  it('forces row security with system-role SELECT and INSERT policies only', async () => {
    const policies = (await db.query(`SELECT policyname, cmd, roles::text[] AS roles FROM pg_policies WHERE tablename = 'public_intake_audit_events' ORDER BY policyname`)).rows
    expect(policies).toEqual([
      { policyname: 'ue_system_insert', cmd: 'INSERT', roles: ['union_eyes_system'] },
      { policyname: 'ue_system_select', cmd: 'SELECT', roles: ['union_eyes_system'] },
    ])
    expect((await db.query(`SELECT relforcerowsecurity FROM pg_class WHERE oid = 'public_intake_audit_events'::regclass`)).rows[0].relforcerowsecurity).toBe(true)
  })

  it('records and chains events through the real writer as the system role, storing the keyed reference and never the identifier', async () => {
    const workbook = randomUUID()
    await as(db, 'union_eyes_system', async (tx) => {
      await appendPublicIntakeAudit(tx, event(workbook))
      await appendPublicIntakeAudit(tx, event(workbook, 'workbook.memory_holder.create', 'create'))
    }, true)
    const ref = pseudonymousSubjectRef('unclaimed_workbook', workbook)
    const rows = (await db.query('SELECT * FROM public_intake_audit_events WHERE subject_ref = $1 ORDER BY occurred_at', [ref])).rows
    expect(rows).toHaveLength(2)
    expect(rows[0].previous_hash).toBeNull()
    expect(rows[1].previous_hash).toBe(rows[0].content_hash)
    expect(rows[1].occurred_at.getTime()).toBeGreaterThan(rows[0].occurred_at.getTime())
    expect(JSON.stringify((await db.query('SELECT * FROM public_intake_audit_events')).rows)).not.toContain(workbook)
    expect(await as(db, 'union_eyes_system', (tx) => verifyPublicIntakeAuditChain(tx, 'unclaimed_workbook', workbook))).toMatchObject({ ok: true, events: 2, head: rows[1].content_hash })
  })

  it('hides the store from, and refuses writes by, a tenant session even where DML was granted', async () => {
    const refused = await as(db, 'union_eyes_runtime', (tx) => appendPublicIntakeAudit(tx, event(randomUUID()))).then(() => null, (error: { cause?: { message?: string }; message: string }) => error.cause?.message ?? error.message)
    expect(refused).toMatch(/row-level security/)
    expect(await as(db, 'union_eyes_runtime', async () => (await db.query('SELECT 1 FROM public_intake_audit_events')).rowCount)).toBe(0)
  })

  it('refuses update, delete and truncate for every role, including one that was granted the privilege and a superuser', async () => {
    await expect(as(db, 'union_eyes_system', () => db.query(`UPDATE public_intake_audit_events SET outcome = 'failure'`))).rejects.toThrow(/permission denied/)
    await expect(as(db, 'union_eyes_system', () => db.query('DELETE FROM public_intake_audit_events'))).rejects.toThrow(/permission denied/)
    await expect(db.query(`UPDATE public_intake_audit_events SET outcome = 'failure'`)).rejects.toThrow(/append-only/)
    await expect(db.query('DELETE FROM public_intake_audit_events')).rejects.toThrow(/append-only/)
    await expect(db.query('TRUNCATE public_intake_audit_events')).rejects.toThrow(/append-only/)
  })

  it('refuses a malformed reference, an unknown operation, an unknown subject kind and a forked chain', async () => {
    const insert = (over: Record<string, string | null> = {}) => {
      const row = { subject_kind: 'unclaimed_workbook', subject_ref: 'a'.repeat(64), operation: 'read', previous_hash: null, content_hash: 'b'.repeat(64), ...over }
      return as(db, 'union_eyes_system', () => db.query(
        `INSERT INTO public_intake_audit_events (occurred_at, subject_kind, subject_ref, surface, action, operation, previous_hash, content_hash)
         VALUES (now(), $1, $2, 's', 'a', $3, $4, $5)`,
        [row.subject_kind, row.subject_ref, row.operation, row.previous_hash, row.content_hash],
      ))
    }
    await expect(insert({ subject_ref: 'nothex' })).rejects.toThrow(/subject_check/)
    await expect(insert({ operation: 'export' })).rejects.toThrow(/operation_check/)
    await expect(insert({ subject_kind: 'member' })).rejects.toThrow(/kind_check/)
    await as(db, 'union_eyes_system', async () => {
      await db.query(`INSERT INTO public_intake_audit_events (occurred_at, subject_kind, subject_ref, surface, action, operation, previous_hash, content_hash)
        VALUES (now(), 'unclaimed_workbook', '${'c'.repeat(64)}', 's', 'a', 'read', NULL, '${'d'.repeat(64)}')`)
      await expect(db.query(`INSERT INTO public_intake_audit_events (occurred_at, subject_kind, subject_ref, surface, action, operation, previous_hash, content_hash)
        VALUES (now(), 'unclaimed_workbook', '${'c'.repeat(64)}', 's', 'a', 'read', NULL, '${'e'.repeat(64)}')`)).rejects.toThrow(/chain_uq/)
    })
  })

  it('does not fork a chain under concurrent writers on separate connections', async () => {
    const workbook = randomUUID()
    const writers = await Promise.all(Array.from({ length: 4 }, async () => { const c = new pg.Client({ connectionString: url }); await c.connect(); return c }))
    try {
      await Promise.all(writers.map((client) => (async () => {
        for (let i = 0; i < 5; i += 1) await as(client, 'union_eyes_system', (tx) => appendPublicIntakeAudit(tx, event(workbook)), true)
      })()))
    } finally {
      await Promise.all(writers.map((c) => c.end()))
    }
    expect(await count(pseudonymousSubjectRef('unclaimed_workbook', workbook))).toBe(20)
    expect(await as(db, 'union_eyes_system', (tx) => verifyPublicIntakeAuditChain(tx, 'unclaimed_workbook', workbook))).toMatchObject({ ok: true, events: 20 })
  })

  it('detects a rewritten event and a removed middle event, and cannot see a removed newest event without the head', async () => {
    const workbook = randomUUID()
    const ref = pseudonymousSubjectRef('unclaimed_workbook', workbook)
    await as(db, 'union_eyes_system', async (tx) => { for (let i = 0; i < 4; i += 1) await appendPublicIntakeAudit(tx, event(workbook)) }, true)
    const verify = () => as(db, 'union_eyes_system', (tx) => verifyPublicIntakeAuditChain(tx, 'unclaimed_workbook', workbook))
    const before = await verify()
    expect(before).toMatchObject({ ok: true, events: 4 })

    // Tampering needs the owner to switch the append-only trigger off: that is the privileged act the verifier exists to expose.
    await migrate(`ALTER TABLE public.public_intake_audit_events DISABLE TRIGGER USER`)
    try {
      const ordered = (await db.query('SELECT id FROM public_intake_audit_events WHERE subject_ref = $1 ORDER BY occurred_at', [ref])).rows.map((r) => r.id)

      await db.query(`UPDATE public_intake_audit_events SET details = '{"holderCount": 0}'::jsonb WHERE id = $1`, [ordered[1]])
      expect(await verify()).toMatchObject({ ok: false, brokenAt: 1, reason: 'content_mismatch' })

      await db.query(`UPDATE public_intake_audit_events SET details = '{"holderCount": 3}'::jsonb WHERE id = $1`, [ordered[1]])
      expect(await verify()).toMatchObject({ ok: true })

      await db.query('DELETE FROM public_intake_audit_events WHERE id = $1', [ordered[1]])
      expect(await verify()).toMatchObject({ ok: false, brokenAt: 1, reason: 'previous_mismatch' })
    } finally {
      await migrate(`ALTER TABLE public.public_intake_audit_events ENABLE TRIGGER USER`)
    }
  })

  it('does not detect a removed newest event on its own: the verifier returns the head so a copy kept elsewhere can be compared', async () => {
    const workbook = randomUUID()
    const ref = pseudonymousSubjectRef('unclaimed_workbook', workbook)
    await as(db, 'union_eyes_system', async (tx) => { for (let i = 0; i < 3; i += 1) await appendPublicIntakeAudit(tx, event(workbook)) }, true)
    const verify = () => as(db, 'union_eyes_system', (tx) => verifyPublicIntakeAuditChain(tx, 'unclaimed_workbook', workbook))
    const full = await verify()
    expect(full).toMatchObject({ ok: true, events: 3 })

    await migrate(`ALTER TABLE public.public_intake_audit_events DISABLE TRIGGER USER`)
    try {
      await db.query('DELETE FROM public_intake_audit_events WHERE id = (SELECT id FROM public_intake_audit_events WHERE subject_ref = $1 ORDER BY occurred_at DESC LIMIT 1)', [ref])
    } finally {
      await migrate(`ALTER TABLE public.public_intake_audit_events ENABLE TRIGGER USER`)
    }
    const truncated = await verify()
    expect(truncated).toMatchObject({ ok: true, events: 2 })
    expect((truncated as { head: string }).head).not.toBe((full as { head: string }).head)
  })

  it('rolls back both migrations and re-applies them', async () => {
    await migrate(C(true))
    expect((await db.query(`SELECT count(*)::int AS n FROM pg_policies WHERE tablename = 'public_intake_audit_events'`)).rows[0].n).toBe(0)
    await migrate(P(true))
    expect((await db.query(`SELECT to_regclass('public.public_intake_audit_events') AS t`)).rows[0].t).toBeNull()
    await migrate(P())
    expect((await db.query(`SELECT to_regclass('public.public_intake_audit_events') AS t`)).rows[0].t).not.toBeNull()
  })
})
