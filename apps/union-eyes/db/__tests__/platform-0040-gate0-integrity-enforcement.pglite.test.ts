import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const file = join(process.cwd(), 'db/migrations-platform/0040_gate0_integrity_enforcement.sql')
const statements = readFileSync(file, 'utf8')
  .split('--> statement-breakpoint')
  .map((s) => s.trim())
  .filter((s) => s && !s.split('\n').every((l) => l.startsWith('--')))

const run = async (pg: PGlite) => {
  for (const sql of statements) await pg.exec(sql)
}

const ORG = '11111111-1111-4111-8111-111111111111'
const COURSE = '22222222-2222-4222-8222-222222222222'
const SESSION = '33333333-3333-4333-8333-333333333333'

const STUBS = `
  CREATE TYPE employer_execution_replay_mode AS ENUM ('exact','simulated');
  CREATE TABLE employer_execution_replays (id uuid primary key default gen_random_uuid(), mode employer_execution_replay_mode not null default 'exact');
  CREATE TABLE ml_predictions (id uuid primary key default gen_random_uuid(), organization_id uuid not null, predicted_value numeric not null default 0);
  CREATE TABLE course_sessions (id uuid primary key, max_enrollment integer);
  CREATE TABLE course_registrations (id uuid primary key default gen_random_uuid(), organization_id uuid not null, member_id varchar(255) not null, course_id uuid not null, session_id uuid not null, registration_status varchar(50) default 'registered');
`

describe('platform migration 0040_gate0_integrity_enforcement on PGlite', () => {
  let pg: PGlite
  beforeEach(async () => {
    pg = new PGlite()
    await pg.exec(STUBS)
    await pg.exec(`INSERT INTO course_sessions (id, max_enrollment) VALUES ('${SESSION}', 2)`)
  })
  afterEach(async () => {
    await pg.close()
  })

  const register = (member: string, status = 'registered') =>
    pg.query(
      `INSERT INTO course_registrations (organization_id, member_id, course_id, session_id, registration_status) VALUES ($1::uuid, $2, $3::uuid, $4::uuid, $5)`,
      [ORG, member, COURSE, SESSION, status],
    )

  it('is idempotent and adds the replay mode and prediction provenance columns', async () => {
    await run(pg)
    await run(pg)
    await pg.exec(`INSERT INTO employer_execution_replays (mode) VALUES ('new_engine')`)
    const modes = await pg.query<{ mode: string }>('SELECT mode FROM employer_execution_replays')
    expect(modes.rows[0].mode).toBe('new_engine')
    const cols = await pg.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'ml_predictions' AND column_name IN ('model_version','subject_id') ORDER BY 1`,
    )
    expect(cols.rows.map((c) => c.column_name)).toEqual(['model_version', 'subject_id'])
  })

  it('refuses a registration beyond the session capacity, and a cancelled place frees a seat', async () => {
    await run(pg)
    await register('a')
    await register('b')
    await expect(register('c')).rejects.toThrow(/course session is full/)
    await pg.query(`UPDATE course_registrations SET registration_status = 'cancelled' WHERE member_id = 'a'`)
    await register('c')
    const registered = await pg.query<{ n: number }>(`SELECT count(*)::int AS n FROM course_registrations WHERE registration_status = 'registered'`)
    expect(registered.rows[0].n).toBe(2)
  })

  it('does not count a re-save of an already registered row against the capacity, but guards re-activation', async () => {
    await run(pg)
    await register('a')
    await register('b')
    await pg.query(`UPDATE course_registrations SET registration_status = 'registered' WHERE member_id = 'a'`)
    await pg.query(`UPDATE course_registrations SET registration_status = 'cancelled' WHERE member_id = 'b'`)
    await register('c')
    await expect(pg.query(`UPDATE course_registrations SET registration_status = 'registered' WHERE member_id = 'b'`)).rejects.toThrow(/course session is full/)
  })

  it('leaves a session with no maximum unbounded', async () => {
    await pg.exec(`UPDATE course_sessions SET max_enrollment = NULL`)
    await run(pg)
    for (const member of ['a', 'b', 'c', 'd']) await register(member)
    const total = await pg.query<{ n: number }>('SELECT count(*)::int AS n FROM course_registrations')
    expect(total.rows[0].n).toBe(4)
  })

  it('allows one registration per member and session', async () => {
    await run(pg)
    await register('a')
    await expect(register('a')).rejects.toThrow(/duplicate key/)
  })

  it('refuses to apply over existing duplicate registrations and deletes nothing', async () => {
    await register('a')
    await register('a')
    await expect(run(pg)).rejects.toThrow(/duplicate registrations/)
    const total = await pg.query<{ n: number }>('SELECT count(*)::int AS n FROM course_registrations')
    expect(total.rows[0].n).toBe(2)
  })

  it('skips relations that do not exist', async () => {
    const bare = new PGlite()
    await run(bare)
    await bare.close()
  })
})
