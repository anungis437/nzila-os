/**
 * Native PostgreSQL qualification of cache migration 0032_grievance_events_actor_text.
 *
 * Two parts. First, a disposable database holding the PRECEDING schema (the approved migrations declared
 * grievance_events.actor_user_id as uuid): the migration is applied, proven to preserve existing rows and the index, to
 * accept text principals, to be idempotent, to fail closed without its table, and its rollback is proven to refuse when it would
 * lose history and to succeed when it would not. Second, against the combined database built by Django migrate plus the approved
 * Drizzle bootstrap (which applied it for real): the column is text and the runtime role keeps its privileges.
 *
 * Needs UE_AUTHORITY_COMBINED_URL (see apps/union-eyes/db/__tests__/README.md); skipped when it is not set. The disposable
 * database is created and dropped on the same server and never touches the combined database's data.
 */
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const URL_ = process.env.UE_AUTHORITY_COMBINED_URL
const dir = join(__dirname, '..', 'migrations-cache')
const up = readFileSync(join(dir, '0032_grievance_events_actor_text.sql'), 'utf8')
const down = readFileSync(join(dir, '0032_grievance_events_actor_text.rollback.sql'), 'utf8')

const PRECEDING = `
  CREATE TYPE grievance_event_type AS ENUM ('created');
  CREATE TABLE public.grievance_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    grievance_id uuid NOT NULL,
    event_type grievance_event_type NOT NULL,
    actor_user_id uuid NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
  );
  CREATE INDEX idx_grievance_events_actor ON public.grievance_events USING btree (actor_user_id);
`

const withDb = (url: string, name: string) => {
  const u = new globalThis.URL(url)
  u.pathname = `/${name}`
  return u.toString()
}

describe.skipIf(!URL_)('migration 0032 on native PostgreSQL', () => {
  const scratch = `m0032_${randomUUID().replace(/-/g, '').slice(0, 12)}`
  let admin: pg.Client
  let db: pg.Client
  const actorType = async () =>
    (await db.query(`SELECT data_type FROM information_schema.columns WHERE table_name='grievance_events' AND column_name='actor_user_id'`)).rows[0].data_type as string

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: URL_ })
    await admin.connect()
    await admin.query(`CREATE DATABASE ${scratch}`)
    db = new pg.Client({ connectionString: withDb(URL_ as string, scratch) })
    await db.connect()
    await db.query(PRECEDING)
  })

  afterAll(async () => {
    await db?.end()
    await admin?.query(`DROP DATABASE IF EXISTS ${scratch} WITH (FORCE)`)
    await admin?.end()
  })

  it('upgrades the preceding schema, preserving the existing uuid actor and the index', async () => {
    const actor = randomUUID()
    await db.query(`INSERT INTO grievance_events (grievance_id, event_type, actor_user_id) VALUES ($1, 'created', $2)`, [randomUUID(), actor])
    expect(await actorType()).toBe('uuid')
    await db.query(up)
    expect(await actorType()).toBe('text')
    expect((await db.query(`SELECT actor_user_id FROM grievance_events`)).rows[0].actor_user_id).toBe(actor)
    expect((await db.query(`SELECT 1 FROM pg_indexes WHERE indexname='idx_grievance_events_actor'`)).rowCount).toBe(1)
  })

  it('now accepts a text principal (the failure the runtime suite found)', async () => {
    await db.query(`INSERT INTO grievance_events (grievance_id, event_type, actor_user_id) VALUES ($1, 'created', 'ue-qa-steward-primary')`, [randomUUID()])
    expect((await db.query(`SELECT count(*)::int AS n FROM grievance_events WHERE actor_user_id = 'ue-qa-steward-primary'`)).rows[0].n).toBe(1)
  })

  it('is idempotent', async () => {
    await db.query(up)
    await db.query(up)
    expect(await actorType()).toBe('text')
    expect((await db.query(`SELECT count(*)::int AS n FROM grievance_events`)).rows[0].n).toBe(2)
  })

  it('rolls back only when no history would be lost', async () => {
    await expect(db.query(down)).rejects.toThrow(/rollback refused/)
    expect(await actorType()).toBe('text')
    await db.query(`DELETE FROM grievance_events WHERE actor_user_id = 'ue-qa-steward-primary'`)
    await db.query(down)
    expect(await actorType()).toBe('uuid')
    await expect(db.query(`INSERT INTO grievance_events (grievance_id, event_type, actor_user_id) VALUES ($1, 'created', 'not-a-uuid')`, [randomUUID()])).rejects.toThrow()
    await db.query(up)
    expect(await actorType()).toBe('text')
  })

  it('fails closed when the table does not exist', async () => {
    await db.query('ALTER TABLE public.grievance_events RENAME TO grievance_events_moved')
    await expect(db.query(up)).rejects.toThrow(/fail-closed/)
    await db.query('ALTER TABLE public.grievance_events_moved RENAME TO grievance_events')
  })

  it('holds on the combined database: text actor, and the runtime role keeps its privileges', async () => {
    const combined = new pg.Client({ connectionString: URL_ })
    await combined.connect()
    try {
      const type = (await combined.query(`SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='grievance_events' AND column_name='actor_user_id'`)).rows[0]
      expect(type?.data_type).toBe('text')
      const grants = (await combined.query(`SELECT has_table_privilege('union_eyes_runtime','public.grievance_events','INSERT') AS i, has_table_privilege('union_eyes_runtime','public.grievance_events','SELECT') AS s`)).rows[0]
      expect(grants).toEqual({ i: true, s: true })
    } finally {
      await combined.end()
    }
  })
})
