/**
 * 24-hour member location retention against the COMBINED deployed schema (Django `migrate` + the approved Drizzle
 * bootstrap), with the sweep running as the system role under forced row-level security and the exact grants the
 * storage-authority manifest activates. Nothing is mirrored.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a FRESH disposable database (same
 * preparation as document-intake.postgres.test.ts). The suite installs a fault trigger on location_deletion_log of that
 * disposable database. Not a staging isolation pass.
 */
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const URL = process.env.UE_AUTHORITY_COMBINED_URL
const state = vi.hoisted(() => ({ db: null as unknown }))

type Tx = { execute: (q: unknown) => Promise<unknown> }
async function inRole<T>(role: 'union_eyes_runtime' | 'union_eyes_system', user: string, work: (tx: unknown) => Promise<T>): Promise<T> {
  return (state.db as { transaction: (f: (tx: Tx) => Promise<T>) => Promise<T> }).transaction(async (tx) => {
    await tx.execute(sql.raw(`SET LOCAL ROLE ${role}`))
    await tx.execute(sql`SELECT set_config('app.current_user_id', ${user}, true), set_config('app.current_org_id', '', true)`)
    return work(tx)
  })
}

vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: async (work: (tx: unknown) => Promise<unknown>) => inRole('union_eyes_system', '', work),
}))

const service = URL ? await import('@/services/geofence-privacy-service') : null

describe.skipIf(!URL)('member location retention on the combined deployed schema', () => {
  const USER_A = `loc-a-${randomUUID().slice(0, 8)}`
  const USER_B = `loc-b-${randomUUID().slice(0, 8)}`
  let admin: pg.Client
  let pool: pg.Pool
  const count = async (query: string, params: unknown[] = []) => Number((await admin.query(query, params)).rows[0].n)

  const seed = async () => {
    await admin.query(`DELETE FROM location_tracking WHERE user_id = ANY($1)`, [[USER_A, USER_B]])
    await admin.query(`DELETE FROM geofence_events WHERE user_id = ANY($1)`, [[USER_A, USER_B]])
    for (const [user, expiry] of [[USER_A, '-1 hour'], [USER_A, '+20 hours'], [USER_B, '-2 hours'], [USER_B, '+3 hours']]) {
      await admin.query(
        `INSERT INTO location_tracking (id, user_id, latitude, longitude, recorded_at, expires_at, purpose)
         VALUES (gen_random_uuid(), $1, 45.5, -73.5, now() - interval '25 hours', now() + $2::interval, 'retention proof')`,
        [user, expiry],
      )
    }
    await admin.query(
      `INSERT INTO geofence_events (id, user_id, geofence_id, event_type, event_time, expires_at)
       VALUES (gen_random_uuid(), $1, $2, 'entry', now() - interval '30 hours', now() - interval '6 hours')`,
      [USER_B, randomUUID()],
    )
  }

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: URL })
    await admin.connect()
    pool = new pg.Pool({ connectionString: URL, max: 4 })
    state.db = drizzle(pool)
    await admin.query(`CREATE TABLE IF NOT EXISTS ue_location_log_faults (armed boolean)`)
    await admin.query(`GRANT SELECT ON ue_location_log_faults TO PUBLIC`)
    await admin.query(`CREATE OR REPLACE FUNCTION ue_location_log_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF EXISTS (SELECT 1 FROM ue_location_log_faults WHERE armed) THEN RAISE EXCEPTION 'injected deletion-log fault'; END IF; RETURN NEW; END $$`)
    await admin.query(`DROP TRIGGER IF EXISTS ue_location_log_fault_trg ON location_deletion_log`)
    await admin.query(`CREATE TRIGGER ue_location_log_fault_trg BEFORE INSERT ON location_deletion_log FOR EACH ROW EXECUTE FUNCTION ue_location_log_fault()`)
  }, 120_000)

  afterAll(async () => {
    await admin?.query(`DROP TRIGGER IF EXISTS ue_location_log_fault_trg ON location_deletion_log`)
    await pool?.end()
    await admin?.end()
  })

  it('a user-scoped runtime session cannot sweep other members, which is why retention needs the system role', async () => {
    await seed()
    const deleted = await inRole('union_eyes_runtime', USER_A, async (tx) => {
      const result = (await (tx as Tx).execute(sql`DELETE FROM location_tracking WHERE expires_at <= now() RETURNING user_id`)) as { rows: { user_id: string }[] }
      return result.rows.map((row) => row.user_id)
    })
    expect(deleted).toEqual([USER_A])
    expect(await count(`SELECT count(*) AS n FROM location_tracking WHERE user_id = $1 AND expires_at <= now()`, [USER_B])).toBe(1)
  })

  it('the system sweep deletes every member\'s expired points and events, keeps live ones, and records the evidence', async () => {
    await seed()
    const before = await count(`SELECT count(*) AS n FROM location_deletion_log WHERE deletion_type = 'auto_24hr'`)
    const { withSystemContext } = await import('@/lib/db/with-rls-context')
    const result = await withSystemContext((tx) => service!.GeofencePrivacyService.deleteExpiredLocationData(tx as never)) as { trackingRecordsDeleted: number; eventRecordsDeleted: number }
    expect(result.trackingRecordsDeleted).toBeGreaterThanOrEqual(2)
    expect(result.eventRecordsDeleted).toBeGreaterThanOrEqual(1)
    expect(await count(`SELECT count(*) AS n FROM location_tracking WHERE user_id = ANY($1) AND expires_at <= now()`, [[USER_A, USER_B]])).toBe(0)
    expect(await count(`SELECT count(*) AS n FROM location_tracking WHERE user_id = ANY($1) AND expires_at > now()`, [[USER_A, USER_B]])).toBe(2)
    expect(await count(`SELECT count(*) AS n FROM geofence_events WHERE user_id = $1`, [USER_B])).toBe(0)
    expect(await count(`SELECT count(*) AS n FROM location_deletion_log WHERE deletion_type = 'auto_24hr'`)).toBe(before + 1)
  })

  it('a failed evidence write rolls the whole sweep back, so no data is deleted without its record', async () => {
    await seed()
    await admin.query(`INSERT INTO ue_location_log_faults(armed) VALUES (true)`)
    try {
      const before = await count(`SELECT count(*) AS n FROM location_deletion_log`)
      const { withSystemContext } = await import('@/lib/db/with-rls-context')
      await expect(withSystemContext((tx) => service!.GeofencePrivacyService.deleteExpiredLocationData(tx as never))).rejects.toThrow()
      expect(await count(`SELECT count(*) AS n FROM location_tracking WHERE user_id = ANY($1) AND expires_at <= now()`, [[USER_A, USER_B]])).toBe(2)
      expect(await count(`SELECT count(*) AS n FROM geofence_events WHERE user_id = $1`, [USER_B])).toBe(1)
      expect(await count(`SELECT count(*) AS n FROM location_deletion_log`)).toBe(before)
    } finally {
      await admin.query(`DELETE FROM ue_location_log_faults`)
    }
  })

  it('self-service consent revocation can record its deletion evidence as the runtime role', async () => {
    const before = await count(`SELECT count(*) AS n FROM location_deletion_log WHERE deletion_type = 'user_request'`)
    await inRole('union_eyes_runtime', USER_A, async (tx) => {
      await (tx as Tx).execute(sql`INSERT INTO location_deletion_log (deletion_type, deletion_reason, record_count) VALUES ('user_request', 'consent_revoked', '3')`)
    })
    expect(await count(`SELECT count(*) AS n FROM location_deletion_log WHERE deletion_type = 'user_request'`)).toBe(before + 1)
  })

  it('the system role holds only the retention privileges: no INSERT or UPDATE on member location rows', async () => {
    const privileges = (await admin.query(
      `SELECT has_table_privilege('union_eyes_system','location_tracking','DELETE') AS del,
              has_table_privilege('union_eyes_system','location_tracking','INSERT') AS ins,
              has_table_privilege('union_eyes_system','location_tracking','UPDATE') AS upd,
              has_table_privilege('union_eyes_system','geofence_events','DELETE') AS gdel,
              has_table_privilege('union_eyes_system','location_deletion_log','INSERT') AS log`,
    )).rows[0]
    expect(privileges).toEqual({ del: true, ins: false, upd: false, gdel: true, log: true })
  })
})
