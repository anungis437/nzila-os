/**
 * The chatbot session archive route on real PostgreSQL, as the real roles (UE-CONV-H-017).
 *
 * The unit test replaces the database, so it cannot say whether the runtime role may update chat_sessions under row-level security, whether another member's or
 * another organization's session is out of reach, or what a second archive that arrives while the first holds the row does. This runs the unmodified route against
 * the combined Django + Drizzle schema, with only the request boundary replaced (see native-route-harness.ts), and proves that
 *   - the owner archives an active session: the status moves, nothing else on the row changes, the transcript is kept and the audit record commits with it;
 *   - archiving it again is a success that writes and audits nothing, including when the second request is the one that waited on the first's row lock;
 *   - another member of the same organization, a member of another organization, a deleted session and a malformed id all answer "not found" and change nothing;
 *   - the runtime role cannot update a session of another organization at all, whatever the statement says;
 *   - when the audit record cannot be written the status is not changed.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database.
 */
import { randomUUID } from 'node:crypto'
import type pg from 'pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const URL = process.env.UE_AUTHORITY_COMBINED_URL

vi.mock('@/db/db', async () => ({ db: (await import('./native-route-harness')).ambientDb }))
vi.mock('@/db', async () => ({ db: (await import('./native-route-harness')).ambientDb }))
vi.mock('@/lib/db/with-rls-context', async () => (await import('./native-route-harness')).rlsContextModule)
vi.mock('@/lib/audit/atomic-audit', async () => ({ persistAtomicAudit: (await import('./native-route-harness')).recordAudit }))
vi.mock('@/lib/api/with-api', async () => ({ withApi: (await import('./native-route-harness')).emulatedWithApi }))

const { harness, RUNTIME_ROLE } = await import('./native-route-harness')
const archiveRoute = URL ? await import('@/app/api/chatbot/sessions/[sessionId]/archive/route') : null

type Row = Record<string, unknown>
type Handler = (ctx: unknown) => Promise<unknown>
const run = (handler: unknown, ctx: unknown) => (handler as Handler)(ctx)
const rejection = async (promise: Promise<unknown>) => promise.then(() => null, (error: unknown) => error as { code?: string; message?: string })

describe.skipIf(!URL)('the chatbot session archive route on the combined schema, as the real roles', () => {
  const tag = randomUUID().slice(0, 8)
  const ORG_A = randomUUID()
  const ORG_B = randomUUID()
  const owner = `owner-${tag}`
  const colleague = `colleague-${tag}`
  const outsider = `outsider-${tag}`
  const asOwner = { organizationId: ORG_A, userId: owner }
  const asColleague = { organizationId: ORG_A, userId: colleague }
  const asOutsider = { organizationId: ORG_B, userId: outsider }
  let admin: pg.Client

  const archive = (who: { organizationId: string; userId: string }, sessionId: string) => run(archiveRoute!.POST, { ...who, params: { sessionId } }) as Promise<Row>
  const session = async (organizationId = ORG_A, userId = owner, status = 'active') => {
    const id = randomUUID()
    await admin.query(
      `INSERT INTO public.chat_sessions (id, user_id, organization_id, title, status, message_count) VALUES ($1, $2, $3, $4, $5, 2)`,
      [id, userId, organizationId, `Session ${tag}`, status],
    )
    await admin.query(`INSERT INTO public.chat_messages (session_id, role, content) VALUES ($1, 'user', 'hello'), ($1, 'assistant', 'hi')`, [id])
    return id
  }
  const stored = async (id: string) => (await admin.query(`SELECT * FROM public.chat_sessions WHERE id = $1`, [id])).rows[0] as Row
  const auditsFor = (id: string) => harness.audits.filter((audit) => audit.resourceId === id)
  const newOrganization = (id: string, name: string) =>
    admin.query(
      `INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
       VALUES ($1,$2,$3,'local','{}',0,'{}',false,0,0,'{}','{}','active',now(),now(),1)`,
      [id, name, `${name.toLowerCase().replace(/\W+/g, '-')}-${id}`],
    )

  beforeAll(async () => {
    admin = await harness.start(URL!)
    await newOrganization(ORG_A, `Chat A ${tag}`)
    await newOrganization(ORG_B, `Chat B ${tag}`)
    harness.setRole(owner, ORG_A, 'member')
    harness.setRole(colleague, ORG_A, 'member')
    harness.setRole(outsider, ORG_B, 'member')
  }, 60_000)

  afterAll(async () => {
    await admin?.end()
    await harness.stop()
  })

  it('archives the owner\'s active session: only the status and its timestamp change, the transcript stays, and the audit record is the change\'s own', async () => {
    const id = await session()
    const before = await stored(id)

    expect(await archive(asOwner, id)).toEqual({ data: { id, status: 'archived' } })

    const after = await stored(id)
    expect(after).toMatchObject({ status: 'archived', title: before.title, user_id: owner, organization_id: ORG_A, message_count: 2 })
    expect((after.updated_at as Date).getTime()).toBeGreaterThanOrEqual((before.updated_at as Date).getTime())
    expect((await admin.query(`SELECT 1 FROM public.chat_messages WHERE session_id = $1`, [id])).rowCount).toBe(2)
    expect(auditsFor(id)).toMatchObject([{ action: 'chatbot.session.archive', organizationId: ORG_A, userId: owner, resourceType: 'chat_sessions', details: { from: 'active', to: 'archived' } }])
  })

  it('archiving an archived session succeeds and writes and audits nothing more', async () => {
    const id = await session()
    await archive(asOwner, id)
    const afterFirst = await stored(id)

    expect(await archive(asOwner, id)).toEqual({ data: { id, status: 'archived' } })

    expect((await stored(id)).updated_at).toEqual(afterFirst.updated_at)
    expect(auditsFor(id)).toHaveLength(1)
  })

  it('is a success, without a second audit record, for the request that waited on another archive\'s row lock', async () => {
    const id = await session()
    // The first archive, held open: it has changed the row and not yet committed.
    await admin.query('BEGIN')
    await admin.query(`UPDATE public.chat_sessions SET status = 'archived' WHERE id = $1`, [id])

    const waiting = archive(asOwner, id)
    // The request has read the session as active and is blocked on its update.
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const blocked = await admin.query(`SELECT 1 FROM pg_locks WHERE NOT granted LIMIT 1`)
      if (blocked.rowCount) break
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    expect((await admin.query(`SELECT 1 FROM pg_locks WHERE NOT granted LIMIT 1`)).rowCount).toBe(1)
    await admin.query('COMMIT')

    expect(await waiting).toEqual({ data: { id, status: 'archived' } })
    expect((await stored(id)).status).toBe('archived')
    expect(auditsFor(id)).toHaveLength(0)
  }, 30_000)

  it('answers "not found", and changes nothing, for a session that is another member\'s, another organization\'s, deleted, or not an id at all', async () => {
    const others = await session(ORG_A, colleague)
    const foreign = await session(ORG_B, outsider)
    const deleted = await session(ORG_A, owner, 'deleted')

    expect(await rejection(archive(asOwner, others))).toMatchObject({ code: 'NOT_FOUND' })
    expect(await rejection(archive(asOwner, foreign))).toMatchObject({ code: 'NOT_FOUND' })
    expect(await rejection(archive(asOutsider, others))).toMatchObject({ code: 'NOT_FOUND' })
    expect(await rejection(archive(asOwner, deleted))).toMatchObject({ code: 'NOT_FOUND' })
    expect(await rejection(archive(asOwner, 'not-an-id'))).toMatchObject({ code: 'NOT_FOUND' })
    expect(await rejection(archive(asOwner, randomUUID()))).toMatchObject({ code: 'NOT_FOUND' })

    expect([(await stored(others)).status, (await stored(foreign)).status, (await stored(deleted)).status]).toEqual(['active', 'active', 'deleted'])
    expect([...auditsFor(others), ...auditsFor(foreign), ...auditsFor(deleted)]).toEqual([])
    // A colleague in the same organization still owns their own.
    expect(await archive(asColleague, others)).toEqual({ data: { id: others, status: 'archived' } })
  })

  it('cannot be reached around: the runtime role of another organization updates none of the rows, whatever its statement', async () => {
    const id = await session(ORG_A, owner)
    const { sql } = await import('drizzle-orm')

    const result = await harness.tenant(RUNTIME_ROLE, ORG_B, outsider, (tx) => tx.execute(sql`UPDATE public.chat_sessions SET status = 'archived' WHERE id = ${id}`))

    expect(result.rowCount).toBe(0)
    expect((await stored(id)).status).toBe('active')
  })

  it('leaves the session active when the audit record cannot be written', async () => {
    const id = await session()
    harness.failNextAudit()

    expect(await rejection(archive(asOwner, id))).toMatchObject({ message: 'audit sink unavailable' })

    expect((await stored(id)).status).toBe('active')
    expect(auditsFor(id)).toEqual([])
  })
})
