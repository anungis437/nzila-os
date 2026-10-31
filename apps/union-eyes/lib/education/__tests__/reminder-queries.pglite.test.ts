import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { sql } from 'drizzle-orm';
import { expiryWarningQuery, rowsOf, sessionReminderQuery, toExpiryWarning, toSessionReminder } from '../reminder-queries';

// DEF-0B6-EDU-CRON-QUERIES-REFERENCE-COLUMNS-ABSENT-FROM-SCHEMA: the reminder statements run against tables created from the
// declared training schema. The earlier statements named columns the schema does not define and failed at their first query;
// the route test mocked the database and could not show it.

const ORG = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const COURSE = '33333333-3333-4333-8333-333333333333';
const OTHER_COURSE = '44444444-4444-4444-8444-444444444444';
let pg: PGlite;
let db: { execute: (query: ReturnType<typeof sql>) => Promise<unknown> };

const day = (offset: number) => `(CURRENT_DATE + ${offset})`;

async function member(userId: string, org: string, over: { email?: string; status?: string } = {}) {
  await pg.query(
    `INSERT INTO organization_members (id, user_id, organization_id, name, email, role, status)
     VALUES (gen_random_uuid(), $1, $2::uuid, $3, $4, 'member', $5)`,
    [userId, org, `Name ${userId}`, over.email ?? `${userId}@example.test`, over.status ?? 'active'],
  );
}

async function session(id: string, org: string, course: string, startOffset: number, over: { status?: string; venue?: string | null } = {}) {
  await pg.query(
    `INSERT INTO course_sessions (id, organization_id, course_id, session_code, start_date, end_date, delivery_method, session_status, venue_name, lead_instructor_name)
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4, ${day(startOffset)}, ${day(startOffset + 1)}, 'in_person', $5, $6, 'Dana Instructor')`,
    [id, org, course, `S-${id.slice(0, 4)}`, over.status ?? 'scheduled', over.venue === undefined ? 'Hall A' : over.venue],
  );
}

async function registration(userId: string, org: string, course: string, sessionId: string, status = 'registered') {
  await pg.query(
    `INSERT INTO course_registrations (id, organization_id, member_id, course_id, session_id, registration_status)
     VALUES (gen_random_uuid(), $1::uuid, $2, $3::uuid, $4::uuid, $5)`,
    [org, userId, course, sessionId, status],
  );
}

async function certification(userId: string, org: string, expiryOffset: number, over: { status?: string; revoked?: boolean; number?: string | null } = {}) {
  await pg.query(
    `INSERT INTO member_certifications (id, organization_id, member_id, certification_name, certification_number, issue_date, expiry_date, certification_status, revoked)
     VALUES (gen_random_uuid(), $1::uuid, $2, 'First Aid', $3, ${day(-100)}, ${day(expiryOffset)}, $4, $5)`,
    [org, userId, over.number === undefined ? 'CERT-1' : over.number, over.status ?? 'active', over.revoked ?? false],
  );
}

beforeAll(async () => {
  const { trainingCourses, courseSessions, courseRegistrations, memberCertifications, organizationMembers } = await import('@/db/schema');
  // The declaration that matches the physical table (it carries the topic columns, training_reminders included).
  const { communicationPreferences } = await import('@/db/schema/communication-analytics-schema');
  const { createTableDatabase } = await import('../../../app/api/__tests__/support/pglite-tables');
  const created = await createTableDatabase([trainingCourses, courseSessions, courseRegistrations, memberCertifications, organizationMembers, communicationPreferences]);
  pg = created.pg;
  db = created.db as unknown as typeof db;
});
afterAll(async () => { await pg.close(); });

beforeEach(async () => {
  await pg.exec('TRUNCATE training_courses, course_sessions, course_registrations, member_certifications, organization_members, communication_preferences');
  for (const [id, org, name] of [[COURSE, ORG, 'Steward Training'], [OTHER_COURSE, OTHER, 'Other Course']]) {
    await pg.query(
      `INSERT INTO training_courses (id, organization_id, course_code, course_name, course_category, delivery_method, duration_hours)
       VALUES ($1::uuid, $2::uuid, $3, $4, 'steward', 'in_person', 4)`,
      [id, org, `C-${String(id).slice(0, 4)}`, name],
    );
  }
});

async function optOut(userId: string, org: string, column: 'email_enabled' | 'training_reminders') {
  await pg.query(`INSERT INTO communication_preferences (id, organization_id, user_id, ${column}) VALUES (gen_random_uuid(), $1::uuid, $2, false)`, [org, userId]);
}

describe('education reminder statements against the declared schema', () => {
  it('finds a registered member of a scheduled session 7, 3 and 1 days out and carries the session details', async () => {
    await member('u1', ORG); await member('u3', ORG); await member('u7', ORG); await member('u2', ORG);
    await session('a0000000-0000-4000-8000-000000000001', ORG, COURSE, 7);
    await session('a0000000-0000-4000-8000-000000000003', ORG, COURSE, 3);
    await session('a0000000-0000-4000-8000-000000000011', ORG, COURSE, 1);
    await session('a0000000-0000-4000-8000-000000000002', ORG, COURSE, 2);
    await registration('u7', ORG, COURSE, 'a0000000-0000-4000-8000-000000000001');
    await registration('u3', ORG, COURSE, 'a0000000-0000-4000-8000-000000000003');
    await registration('u1', ORG, COURSE, 'a0000000-0000-4000-8000-000000000011');
    await registration('u2', ORG, COURSE, 'a0000000-0000-4000-8000-000000000002');

    const rows = rowsOf(await db.execute(sessionReminderQuery));

    expect(rows.map((row) => row.days_until).sort()).toEqual([1, 3, 7]);
    const reminder = toSessionReminder(rows.find((row) => row.days_until === 7)!);
    expect(reminder).toMatchObject({
      toEmail: 'u7@example.test',
      memberName: 'Name u7',
      organizationId: ORG,
      userId: 'u7',
      sourceId: expect.any(String),
      courseName: 'Steward Training',
      daysUntilSession: 7,
      location: 'Hall A',
      instructorName: 'Dana Instructor',
      sessionDuration: 4,
    });
  });

  it('leaves out a cancelled session, a cancelled registration, an inactive member and a member with no address', async () => {
    await member('ok', ORG); await member('gone', ORG, { status: 'inactive' }); await member('blank', ORG, { email: '' });
    await session('b0000000-0000-4000-8000-000000000001', ORG, COURSE, 3);
    await session('b0000000-0000-4000-8000-000000000002', ORG, COURSE, 3, { status: 'cancelled' });
    await registration('ok', ORG, COURSE, 'b0000000-0000-4000-8000-000000000001');
    await registration('ok', ORG, COURSE, 'b0000000-0000-4000-8000-000000000002');
    await registration('ok', ORG, COURSE, 'b0000000-0000-4000-8000-000000000001', 'cancelled');
    await registration('gone', ORG, COURSE, 'b0000000-0000-4000-8000-000000000001');
    await registration('blank', ORG, COURSE, 'b0000000-0000-4000-8000-000000000001');

    const rows = rowsOf(await db.execute(sessionReminderQuery));

    expect(rows.map((row) => row.email)).toEqual(['ok@example.test']);
  });

  it('writes to no member who turned e-mail or training reminders off, and to one with no preference row', async () => {
    await member('on', ORG); await member('noemail', ORG); await member('notraining', ORG); await member('other-org-pref', ORG);
    await session('c0000000-0000-4000-8000-000000000001', ORG, COURSE, 3);
    for (const u of ['on', 'noemail', 'notraining', 'other-org-pref']) await registration(u, ORG, COURSE, 'c0000000-0000-4000-8000-000000000001');
    await optOut('noemail', ORG, 'email_enabled');
    await optOut('notraining', ORG, 'training_reminders');
    // An opt-out recorded for another organization does not silence this one.
    await optOut('other-org-pref', OTHER, 'email_enabled');
    await certification('on', ORG, 30); await certification('noemail', ORG, 30); await certification('notraining', ORG, 30);

    const sessions = rowsOf(await db.execute(sessionReminderQuery)).map((row) => row.email).sort();
    expect(sessions).toEqual(['on@example.test', 'other-org-pref@example.test']);
    const warnings = rowsOf(await db.execute(expiryWarningQuery)).map((row) => row.email).sort();
    expect(warnings).toEqual(['on@example.test']);
  });

  it('never joins a member, course or session of another organization', async () => {
    await member('shared-id', OTHER);
    await session('c0000000-0000-4000-8000-000000000001', ORG, COURSE, 3);
    await registration('shared-id', ORG, COURSE, 'c0000000-0000-4000-8000-000000000001');
    await member('u1', ORG);
    await registration('u1', ORG, OTHER_COURSE, 'c0000000-0000-4000-8000-000000000001');

    expect(rowsOf(await db.execute(sessionReminderQuery))).toEqual([]);
  });

  it('shows an online session as Online when it has no venue', async () => {
    await member('u1', ORG);
    await pg.query(
      `INSERT INTO course_sessions (id, organization_id, course_id, session_code, start_date, end_date, delivery_method, session_status, virtual_meeting_url)
       VALUES ('d0000000-0000-4000-8000-000000000001', $1::uuid, $2::uuid, 'S-online', ${day(1)}, ${day(1)}, 'virtual', 'scheduled', 'https://meet.example.test/x')`,
      [ORG, COURSE],
    );
    await registration('u1', ORG, COURSE, 'd0000000-0000-4000-8000-000000000001');

    expect(toSessionReminder(rowsOf(await db.execute(sessionReminderQuery))[0]!).location).toBe('Online');
  });
});

describe('certification expiry warnings against the declared schema', () => {
  it('warns 90 and 30 days before expiry with the certification number', async () => {
    await member('u1', ORG); await member('u2', ORG); await member('u3', ORG);
    await certification('u1', ORG, 90);
    await certification('u2', ORG, 30, { number: null });
    await certification('u3', ORG, 45);

    const rows = rowsOf(await db.execute(expiryWarningQuery));

    expect(rows.map((row) => row.days_until_expiry).sort()).toEqual([30, 90]);
    expect(toExpiryWarning(rows.find((row) => row.days_until_expiry === 90)!)).toMatchObject({
      toEmail: 'u1@example.test',
      organizationId: ORG,
      userId: 'u1',
      sourceId: expect.any(String),
      certificationName: 'First Aid',
      certificateNumber: 'CERT-1',
      daysUntilExpiry: 90,
    });
    expect(toExpiryWarning(rows.find((row) => row.days_until_expiry === 30)!).certificateNumber).toBe('not recorded');
  });

  it('leaves out a revoked or lapsed certification and one held by a member of another organization', async () => {
    await member('u1', ORG); await member('u2', ORG); await member('u3', OTHER);
    await certification('u1', ORG, 30, { revoked: true });
    await certification('u2', ORG, 30, { status: 'expired' });
    await certification('u3', ORG, 30);

    expect(rowsOf(await db.execute(expiryWarningQuery))).toEqual([]);
  });
});
