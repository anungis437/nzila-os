/**
 * In-process proof that retention deletes each expired owner by userId and expiresAt,
 * keeps live rows, and rolls the deletes back when the deletion log cannot be written.
 * Native combined-schema proof stays READY_FOR_VS_EXECUTION (UE_AUTHORITY_COMBINED_URL).
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { sql } from 'drizzle-orm'
import { GeofencePrivacyService } from '@/services/geofence-privacy-service'

let pg: PGlite
let db: ReturnType<typeof drizzle>

beforeAll(async () => {
  pg = new PGlite()
  // The columns are `timestamp without time zone` and the sweep compares them with a UTC instant, so the fixture
  // must not inherit the machine's zone.
  await pg.exec(`SET TIME ZONE 'UTC'`)
  await pg.exec(`
    CREATE ROLE union_eyes_runtime NOSUPERUSER NOBYPASSRLS NOLOGIN;
    CREATE ROLE union_eyes_system NOSUPERUSER NOBYPASSRLS NOLOGIN;
    CREATE TABLE location_tracking (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id varchar(255) NOT NULL,
      recorded_at timestamp NOT NULL DEFAULT now(),
      expires_at timestamp NOT NULL
    );
    CREATE TABLE geofence_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id varchar(255) NOT NULL,
      geofence_id uuid NOT NULL,
      event_time timestamp NOT NULL DEFAULT now(),
      expires_at timestamp NOT NULL
    );
    CREATE TABLE location_deletion_log (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      deletion_type varchar(50) NOT NULL,
      deletion_reason text,
      record_count varchar(20) NOT NULL,
      oldest_record_date timestamp,
      newest_record_date timestamp,
      initiated_by varchar(255),
      initiator_role varchar(50),
      deleted_at timestamp NOT NULL DEFAULT now()
    );
    ALTER TABLE location_tracking ENABLE ROW LEVEL SECURITY;
    ALTER TABLE location_tracking FORCE ROW LEVEL SECURITY;
    ALTER TABLE geofence_events ENABLE ROW LEVEL SECURITY;
    ALTER TABLE geofence_events FORCE ROW LEVEL SECURITY;
    CREATE POLICY tracking_user ON location_tracking FOR ALL TO union_eyes_runtime
      USING (user_id = current_setting('app.current_user_id', true))
      WITH CHECK (user_id = current_setting('app.current_user_id', true));
    CREATE POLICY tracking_system ON location_tracking FOR ALL TO union_eyes_system
      USING (true) WITH CHECK (true);
    CREATE POLICY events_user ON geofence_events FOR ALL TO union_eyes_runtime
      USING (user_id = current_setting('app.current_user_id', true))
      WITH CHECK (user_id = current_setting('app.current_user_id', true));
    CREATE POLICY events_system ON geofence_events FOR ALL TO union_eyes_system
      USING (true) WITH CHECK (true);
    GRANT SELECT, DELETE ON location_tracking, geofence_events TO union_eyes_runtime, union_eyes_system;
    GRANT INSERT ON location_deletion_log TO union_eyes_runtime, union_eyes_system;
    CREATE TABLE location_log_faults (armed boolean);
    CREATE FUNCTION location_log_fault() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
    BEGIN
      IF EXISTS (SELECT 1 FROM location_log_faults WHERE armed) THEN
        RAISE EXCEPTION 'injected deletion-log fault';
      END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER location_log_fault_trg BEFORE INSERT ON location_deletion_log
      FOR EACH ROW EXECUTE FUNCTION location_log_fault();
  `)
  db = drizzle(pg)
})

afterAll(async () => {
  await pg?.close()
})

async function seed() {
  await pg.exec('RESET ROLE')
  await pg.exec(`DELETE FROM location_tracking; DELETE FROM geofence_events; DELETE FROM location_deletion_log; DELETE FROM location_log_faults;`)
  await pg.exec(`
    INSERT INTO location_tracking (user_id, recorded_at, expires_at) VALUES
      ('user-a', now() - interval '25 hours', now() - interval '1 hour'),
      ('user-a', now(), now() + interval '20 hours'),
      ('user-b', now() - interval '26 hours', now() - interval '2 hours'),
      ('user-b', now(), now() + interval '3 hours');
    INSERT INTO geofence_events (user_id, geofence_id, event_time, expires_at) VALUES
      ('user-b', gen_random_uuid(), now() - interval '30 hours', now() - interval '6 hours'),
      ('user-a', gen_random_uuid(), now(), now() + interval '4 hours');
  `)
}

const count = async (query: string) => Number((await pg.query<{ n: string }>(query)).rows[0].n)

describe('location retention owner sweep', () => {
  it('the system role deletes every expired row, keeps live rows, and writes one log', async () => {
    await seed()
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql.raw(`SET LOCAL ROLE union_eyes_system`))
      return GeofencePrivacyService.deleteExpiredLocationData(tx as never)
    })
    expect(result).toEqual({ trackingRecordsDeleted: 2, eventRecordsDeleted: 1 })
    await pg.exec('RESET ROLE')
    expect(await count(`SELECT count(*) AS n FROM location_tracking WHERE expires_at <= now()`)).toBe(0)
    expect(await count(`SELECT count(*) AS n FROM location_tracking WHERE expires_at > now()`)).toBe(2)
    expect(await count(`SELECT count(*) AS n FROM geofence_events WHERE expires_at <= now()`)).toBe(0)
    expect(await count(`SELECT count(*) AS n FROM geofence_events WHERE expires_at > now()`)).toBe(1)
    expect(await count(`SELECT count(*) AS n FROM location_deletion_log WHERE deletion_type = 'auto_24hr'`)).toBe(1)
    // DEF-0B6-SYS-LOCATION-DELETION-LOG-FABRICATES-DATES: the log holds the real span of what was deleted, not the run time.
    const span = await pg.query<{ hours: string }>(`SELECT round(extract(epoch FROM (newest_record_date - oldest_record_date)) / 3600)::text AS hours FROM location_deletion_log WHERE deletion_type = 'auto_24hr'`)
    expect(Number(span.rows[0].hours)).toBeGreaterThanOrEqual(4)
    expect(await count(`SELECT count(*) AS n FROM location_deletion_log WHERE oldest_record_date >= deleted_at - interval '1 minute'`)).toBe(0)
  })

  it('a runtime session leaves the other member expired rows in place', async () => {
    await seed()
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT set_config('app.current_user_id', 'user-a', true)`)
      await tx.execute(sql.raw(`SET LOCAL ROLE union_eyes_runtime`))
      return GeofencePrivacyService.deleteExpiredLocationData(tx as never)
    })
    expect(result.trackingRecordsDeleted).toBe(1)
    expect(result.eventRecordsDeleted).toBe(0)
    await pg.exec('RESET ROLE')
    expect(await count(`SELECT count(*) AS n FROM location_tracking WHERE user_id = 'user-b' AND expires_at <= now()`)).toBe(1)
    expect(await count(`SELECT count(*) AS n FROM geofence_events WHERE user_id = 'user-b'`)).toBe(1)
  })

  it('rolls the deletes back when the deletion log cannot be written', async () => {
    await seed()
    await pg.exec('RESET ROLE')
    await pg.exec(`INSERT INTO location_log_faults(armed) VALUES (true)`)
    await expect(db.transaction(async (tx) => {
      await tx.execute(sql.raw(`SET LOCAL ROLE union_eyes_system`))
      return GeofencePrivacyService.deleteExpiredLocationData(tx as never)
    })).rejects.toSatisfy((error: unknown) => /deletion-log fault/.test(`${error} ${(error as { cause?: unknown }).cause ?? ''}`))
    await pg.exec('RESET ROLE')
    expect(await count(`SELECT count(*) AS n FROM location_tracking WHERE expires_at <= now()`)).toBe(2)
    expect(await count(`SELECT count(*) AS n FROM geofence_events WHERE expires_at <= now()`)).toBe(1)
    expect(await count(`SELECT count(*) AS n FROM location_deletion_log`)).toBe(0)
  })

  it('names userId and expiresAt on each retention delete', () => {
    const source = readFileSync(path.resolve(__dirname, '../../services/geofence-privacy-service.ts'), 'utf8')
    const body = source.slice(source.indexOf('static async deleteExpiredLocationData'), source.indexOf('static async deleteAllUserLocationData'))
    expect(body).toContain('eq(locationTracking.userId, userId)')
    expect(body).toContain('lte(locationTracking.expiresAt, now)')
    expect(body).toContain('eq(geofenceEvents.userId, userId)')
    expect(body).toContain('lte(geofenceEvents.expiresAt, now)')
    expect(body).not.toContain('isNotNull')
  })
})
