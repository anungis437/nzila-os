/**
 * In-process proof that the consent expiry sweep marks only opted-in consents whose expiry has passed, one member at a time, leaves
 * live, withdrawn and never-asked consents alone, and that a user-scoped session cannot do it for other members.
 * Native combined-schema proof stays READY_FOR_VS_EXECUTION (UE_AUTHORITY_COMBINED_URL).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { GeofencePrivacyService } from '@/services/geofence-privacy-service'

let pg: PGlite
let db: ReturnType<typeof drizzle>

beforeAll(async () => {
  pg = new PGlite()
  await pg.exec(`SET TIME ZONE 'UTC'`)
  await pg.exec(`
    CREATE ROLE union_eyes_runtime NOSUPERUSER NOBYPASSRLS NOLOGIN;
    CREATE ROLE union_eyes_system NOSUPERUSER NOBYPASSRLS NOLOGIN;
    CREATE TABLE member_location_consent (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id varchar(255) NOT NULL,
      consent_status varchar(20) NOT NULL DEFAULT 'never_asked',
      expires_at timestamp,
      updated_at timestamp NOT NULL DEFAULT now()
    );
    ALTER TABLE member_location_consent ENABLE ROW LEVEL SECURITY;
    ALTER TABLE member_location_consent FORCE ROW LEVEL SECURITY;
    CREATE POLICY consent_user ON member_location_consent FOR ALL TO union_eyes_runtime
      USING (user_id = current_setting('app.current_user_id', true))
      WITH CHECK (user_id = current_setting('app.current_user_id', true));
    CREATE POLICY consent_system ON member_location_consent FOR ALL TO union_eyes_system USING (true) WITH CHECK (true);
    GRANT SELECT, UPDATE ON member_location_consent TO union_eyes_runtime, union_eyes_system;
    INSERT INTO member_location_consent (user_id, consent_status, expires_at) VALUES
      ('lapsed-1', 'opted_in', now() - interval '1 day'),
      ('lapsed-2', 'opted_in', now() - interval '1 hour'),
      ('live', 'opted_in', now() + interval '30 days'),
      ('open-ended', 'opted_in', NULL),
      ('withdrawn', 'opted_out', now() - interval '5 days'),
      ('never', 'never_asked', NULL);
  `)
  db = drizzle(pg)
})

afterAll(async () => {
  await pg?.close()
})

const statusOf = async (userId: string) =>
  (await pg.query<{ consent_status: string }>(`SELECT consent_status FROM member_location_consent WHERE user_id = '${userId}'`)).rows[0].consent_status

describe('consent expiry sweep', () => {
  it('a user-scoped session cannot lapse other members consents', async () => {
    await pg.exec(`SET ROLE union_eyes_runtime; SELECT set_config('app.current_user_id', 'live', false);`)
    const result = await GeofencePrivacyService.expireLapsedConsents(db as never)
    await pg.exec('RESET ROLE')
    expect(result.consentsExpired).toBe(0)
    expect(await statusOf('lapsed-1')).toBe('opted_in')
  })

  it('the system role lapses only opted-in consents whose expiry has passed, and reports the count', async () => {
    await pg.exec(`SET ROLE union_eyes_system`)
    const result = await GeofencePrivacyService.expireLapsedConsents(db as never)
    await pg.exec('RESET ROLE')

    expect(result).toEqual({ consentsExpired: 2, consentsTruncated: false })
    expect(await statusOf('lapsed-1')).toBe('expired')
    expect(await statusOf('lapsed-2')).toBe('expired')
    for (const untouched of [['live', 'opted_in'], ['open-ended', 'opted_in'], ['withdrawn', 'opted_out'], ['never', 'never_asked']] as const) {
      expect(await statusOf(untouched[0]), untouched[0]).toBe(untouched[1])
    }
  })

  it('is idempotent: a second run lapses nothing', async () => {
    await pg.exec(`SET ROLE union_eyes_system`)
    const result = await GeofencePrivacyService.expireLapsedConsents(db as never)
    await pg.exec('RESET ROLE')
    expect(result.consentsExpired).toBe(0)
  })
})
