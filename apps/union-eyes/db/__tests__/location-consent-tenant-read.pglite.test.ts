/**
 * Source-level SQL regression for tenant-bound location consent reads.
 * Uses a runtime-role PGlite policy; native PG15/16 and HTTP acceptance remain separate gates.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { GeofencePrivacyService } from '@/services/geofence-privacy-service'

let pg: PGlite
let scopedDb: ReturnType<typeof drizzle>

beforeAll(async () => {
  pg = new PGlite()
  await pg.exec(`
    CREATE ROLE union_eyes_runtime NOSUPERUSER NOBYPASSRLS NOLOGIN;
    CREATE TABLE member_location_consent (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id varchar(255) UNIQUE NOT NULL,
      consent_status varchar(20) NOT NULL,
      opted_in_at timestamp,
      opted_out_at timestamp,
      consent_purpose text NOT NULL,
      purpose_description text,
      foreground_only boolean NOT NULL DEFAULT true,
      allowed_during_strike boolean NOT NULL DEFAULT false,
      allowed_during_events boolean NOT NULL DEFAULT false,
      can_revoke_anytime boolean NOT NULL DEFAULT true,
      data_retention_hours varchar(10) NOT NULL DEFAULT '24',
      auto_delete_enabled boolean NOT NULL DEFAULT true,
      expires_at timestamp,
      renewal_required boolean NOT NULL DEFAULT true,
      last_renewal_reminder timestamp,
      consent_text text NOT NULL,
      consent_version varchar(10) NOT NULL,
      ip_address varchar(45),
      user_agent text,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    );
    ALTER TABLE member_location_consent ENABLE ROW LEVEL SECURITY;
    ALTER TABLE member_location_consent FORCE ROW LEVEL SECURITY;
    CREATE POLICY consent_self ON member_location_consent FOR SELECT TO union_eyes_runtime
      USING (user_id = current_setting('app.current_user_id', true));
    GRANT SELECT ON member_location_consent TO union_eyes_runtime;
    INSERT INTO member_location_consent
      (user_id, consent_status, consent_purpose, consent_text, consent_version, allowed_during_strike, allowed_during_events, expires_at)
    VALUES
      ('member-a', 'opted_in', 'strike', 'notice', '1.0', true, false, now() + interval '1 day'),
      ('member-b', 'opted_in', 'event', 'notice', '1.0', false, true, now() + interval '1 day'),
      ('member-expired', 'opted_in', 'strike', 'notice', '1.0', true, false, now() - interval '1 day');
  `)
  scopedDb = drizzle(pg)
})

afterAll(async () => { await pg?.close() })

describe('location consent status uses the supplied tenant transaction', () => {
  it('allows own consent but cannot read another member through the runtime role', async () => {
    await pg.exec("SET ROLE union_eyes_runtime; SELECT set_config('app.current_user_id', 'member-a', false)")
    try {
      expect(await GeofencePrivacyService.hasValidConsent('member-a', 'strike', scopedDb as never)).toBe(true)
      expect(await GeofencePrivacyService.hasValidConsent('member-a', 'event', scopedDb as never)).toBe(false)
      expect(await GeofencePrivacyService.hasValidConsent('member-b', 'event', scopedDb as never)).toBe(false)
    } finally {
      await pg.exec('RESET ROLE')
    }
  })

  it('expired consent is false without mutating the stored record', async () => {
    await pg.exec("SET ROLE union_eyes_runtime; SELECT set_config('app.current_user_id', 'member-expired', false)")
    try {
      expect(await GeofencePrivacyService.hasValidConsent('member-expired', 'strike', scopedDb as never)).toBe(false)
    } finally {
      await pg.exec('RESET ROLE')
    }
    const row = await pg.query<{ consent_status: string }>(
      "SELECT consent_status FROM member_location_consent WHERE user_id = 'member-expired'",
    )
    expect(row.rows[0].consent_status).toBe('opted_in')
  })
})
