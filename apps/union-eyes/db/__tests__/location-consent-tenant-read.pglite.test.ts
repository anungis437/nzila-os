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
const ORGANIZATION_ID = '11111111-1111-4111-8111-111111111111'
const STRIKE_SCOPE_ID = '22222222-2222-4222-8222-222222222222'
const EVENT_SCOPE_ID = '33333333-3333-4333-8333-333333333333'
const savedNotice = { version: process.env.UE_LOCATION_CONSENT_NOTICE_VERSION, text: process.env.UE_LOCATION_CONSENT_NOTICE_TEXT }

beforeAll(async () => {
  // A consent is valid only for the notice version currently configured, and for none when no notice is configured; the stored rows below
  // acknowledged version 1.0 unless they say otherwise.
  process.env.UE_LOCATION_CONSENT_NOTICE_VERSION = '1.0'
  process.env.UE_LOCATION_CONSENT_NOTICE_TEXT = 'notice'
  pg = new PGlite()
  await pg.exec(`
    CREATE ROLE union_eyes_runtime NOSUPERUSER NOBYPASSRLS NOLOGIN;
    CREATE TABLE member_location_consent (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id varchar(255) NOT NULL,
      organization_id uuid NOT NULL,
      scope_kind varchar(16) NOT NULL,
      scope_id uuid NOT NULL,
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
    CREATE UNIQUE INDEX member_location_consent_scope_uniq ON member_location_consent
      (user_id, organization_id, consent_purpose, scope_kind, scope_id);
    CREATE TABLE geofences (
      id uuid PRIMARY KEY,
      strike_id uuid,
      union_local_id uuid,
      status varchar(20) NOT NULL
    );
    CREATE TABLE calendar_events (
      id uuid PRIMARY KEY,
      organization_id uuid NOT NULL,
      status varchar(20) NOT NULL
    );
    ALTER TABLE member_location_consent ENABLE ROW LEVEL SECURITY;
    ALTER TABLE member_location_consent FORCE ROW LEVEL SECURITY;
    CREATE POLICY consent_self ON member_location_consent FOR SELECT TO union_eyes_runtime
      USING (user_id = current_setting('app.current_user_id', true));
    GRANT SELECT ON member_location_consent, geofences, calendar_events TO union_eyes_runtime;
    INSERT INTO geofences (id, strike_id, union_local_id, status)
      VALUES ('${STRIKE_SCOPE_ID}', '44444444-4444-4444-8444-444444444444', '${ORGANIZATION_ID}', 'active');
    INSERT INTO calendar_events (id, organization_id, status)
      VALUES ('${EVENT_SCOPE_ID}', '${ORGANIZATION_ID}', 'scheduled');
    INSERT INTO member_location_consent
      (user_id, organization_id, scope_kind, scope_id, consent_status, consent_purpose, consent_text, consent_version, allowed_during_strike, allowed_during_events, expires_at)
    VALUES
      ('member-a', '${ORGANIZATION_ID}', 'strike', '${STRIKE_SCOPE_ID}', 'opted_in', 'strike', 'notice', '1.0', true, false, now() + interval '1 day'),
      ('member-b', '${ORGANIZATION_ID}', 'event', '${EVENT_SCOPE_ID}', 'opted_in', 'event', 'notice', '1.0', false, true, now() + interval '1 day'),
      ('member-expired', '${ORGANIZATION_ID}', 'strike', '${STRIKE_SCOPE_ID}', 'opted_in', 'strike', 'notice', '1.0', true, false, now() - interval '1 day'),
      ('member-old-notice', '${ORGANIZATION_ID}', 'strike', '${STRIKE_SCOPE_ID}', 'opted_in', 'strike', 'notice', '0.9', true, false, now() + interval '1 day');
  `)
  scopedDb = drizzle(pg)
})

afterAll(async () => {
  await pg?.close()
  for (const [name, value] of [['UE_LOCATION_CONSENT_NOTICE_VERSION', savedNotice.version], ['UE_LOCATION_CONSENT_NOTICE_TEXT', savedNotice.text]] as const) {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
})

describe('location consent status uses the supplied tenant transaction', () => {
  it('allows own consent but cannot read another member through the runtime role', async () => {
    await pg.exec("SET ROLE union_eyes_runtime; SELECT set_config('app.current_user_id', 'member-a', false)")
    try {
      expect(await GeofencePrivacyService.hasValidConsent('member-a', ORGANIZATION_ID, 'strike', STRIKE_SCOPE_ID, scopedDb as never)).toBe(true)
      expect(await GeofencePrivacyService.hasValidConsent('member-a', ORGANIZATION_ID, 'event', EVENT_SCOPE_ID, scopedDb as never)).toBe(false)
      expect(await GeofencePrivacyService.hasValidConsent('member-b', ORGANIZATION_ID, 'event', EVENT_SCOPE_ID, scopedDb as never)).toBe(false)
    } finally {
      await pg.exec('RESET ROLE')
    }
  })

  it('a consent given to a superseded notice is not valid, and none is valid when no notice is configured', async () => {
    await pg.exec("SET ROLE union_eyes_runtime; SELECT set_config('app.current_user_id', 'member-old-notice', false)")
    try {
      expect(await GeofencePrivacyService.hasValidConsent('member-old-notice', ORGANIZATION_ID, 'strike', STRIKE_SCOPE_ID, scopedDb as never)).toBe(false)
    } finally {
      await pg.exec('RESET ROLE')
    }
    await pg.exec("SET ROLE union_eyes_runtime; SELECT set_config('app.current_user_id', 'member-a', false)")
    const configured = process.env.UE_LOCATION_CONSENT_NOTICE_TEXT
    delete process.env.UE_LOCATION_CONSENT_NOTICE_TEXT
    try {
      expect(await GeofencePrivacyService.hasValidConsent('member-a', ORGANIZATION_ID, 'strike', STRIKE_SCOPE_ID, scopedDb as never)).toBe(false)
    } finally {
      process.env.UE_LOCATION_CONSENT_NOTICE_TEXT = configured
      await pg.exec('RESET ROLE')
    }
  })

  it('expired consent is false without mutating the stored record', async () => {
    await pg.exec("SET ROLE union_eyes_runtime; SELECT set_config('app.current_user_id', 'member-expired', false)")
    try {
      expect(await GeofencePrivacyService.hasValidConsent('member-expired', ORGANIZATION_ID, 'strike', STRIKE_SCOPE_ID, scopedDb as never)).toBe(false)
    } finally {
      await pg.exec('RESET ROLE')
    }
    const row = await pg.query<{ consent_status: string }>(
      "SELECT consent_status FROM member_location_consent WHERE user_id = 'member-expired'",
    )
    expect(row.rows[0].consent_status).toBe('opted_in')
  })
})
