// Mutation isolation (UE-CONV-K-006) against real PostgreSQL semantics (PGlite): an UPDATE/DELETE that names a row only
// by id must carry the acting organization in the statement itself, so a row of ANOTHER organization is never touched.
// The real service code runs; only the connection plumbing is stood in for. Each case proves the cross-tenant call
// affects no row and that the same-organization call still works.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';
const COMMITTEE = '33333333-3333-4333-8333-333333333333';
const USER = 'user-1';
const MEMBER_1 = '44444444-4444-4444-8444-444444444444';
const MEMBER_2 = '55555555-5555-4555-8555-555555555555';

const state = vi.hoisted(() => ({ db: null as unknown }));

const dbProxy = vi.hoisted(
  () =>
    new Proxy(
      {},
      {
        get: (_t, p) => {
          const d = state.db as Record<PropertyKey, unknown> | null;
          const v = d?.[p];
          return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(d) : v;
        },
      },
    ),
);

vi.mock('@/db', () => ({ db: dbProxy }));
vi.mock('@/db/db', () => ({ db: dbProxy }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (...args: unknown[]) => {
    const work = args[args.length - 1] as (tx: unknown) => Promise<unknown>;
    return (state.db as { transaction: (f: (t: unknown) => Promise<unknown>) => Promise<unknown> }).transaction((t) => work(t));
  },
}));
vi.mock('@/lib/services/notification-service', () => ({ NotificationService: {}, getNotificationService: () => ({}) }));
vi.mock('@/lib/config/env-validation', () => ({ env: { VOTING_SECRET: 'x'.repeat(48), NODE_ENV: 'test' } }));

const { createDocumentDatabase, resetDocumentDatabase, ddl } = await import('@/lib/documents/test-support/pglite-document-database');
const schema = await import('@/db/schema');
const committee = await import('@/lib/services/committee-workspace-service');
const voting = await import('@/lib/services/voting-service');
const gdpr = await import('@/lib/gdpr/consent-manager');

let pg: PGlite;
let db: ReturnType<typeof drizzle<typeof schema>>;
const rows = async (sql: string, params: unknown[] = []) => (await pg.query(sql, params)).rows as Array<Record<string, unknown>>;

beforeAll(async () => {
  pg = await createDocumentDatabase();
  for (const table of [
    schema.committeeMeetings,
    schema.committeeMeetingAttendees,
    schema.committeeActionItems,
    schema.committeeDocuments,
    schema.votingSessions,
    schema.votingOptions,
    schema.voterEligibility,
    schema.userConsents,
    schema.gdprDataRequests,
  ]) {
    await pg.exec(ddl(table as never));
  }
  db = drizzle(pg, { schema });
  state.db = db;
});
afterAll(async () => {
  await pg.close();
});
beforeEach(async () => {
  await resetDocumentDatabase(pg);
  await pg.exec(
    'TRUNCATE committee_meeting_attendees, committee_documents, committee_action_items, committee_meetings, voter_eligibility, voting_options, voting_sessions, user_consents, gdpr_data_requests',
  );
});

describe('committee workspace', () => {
  async function meeting(organizationId: string) {
    const [m] = await db
      .insert(schema.committeeMeetings)
      .values({ committeeId: COMMITTEE, organizationId, title: 'Executive', meetingDate: new Date('2026-03-01T10:00:00Z'), status: 'scheduled' } as never)
      .returning();
    return m.id as string;
  }

  it('does not change, record minutes on or approve a meeting of another organization', async () => {
    const id = await meeting(ORG_A);

    expect(await committee.updateMeeting(id, ORG_B, { title: 'Hijacked', updatedBy: USER } as never)).toBeFalsy();
    expect(await committee.recordMinutes(id, ORG_B, 'forged minutes', USER)).toBeNull();
    expect(await committee.approveMinutes(id, ORG_B, USER)).toBeNull();

    const [row] = await rows('SELECT title, minutes, minutes_approved_at FROM committee_meetings WHERE id = $1', [id]);
    expect(row).toMatchObject({ title: 'Executive', minutes: null, minutes_approved_at: null });
  });

  it('still updates, records minutes on and approves a meeting of the acting organization', async () => {
    const id = await meeting(ORG_A);

    expect(await committee.updateMeeting(id, ORG_A, { title: 'Renamed', updatedBy: USER } as never)).toMatchObject({ title: 'Renamed' });
    expect(await committee.recordMinutes(id, ORG_A, 'real minutes', USER)).toMatchObject({ minutes: 'real minutes' });
    expect(await committee.approveMinutes(id, ORG_A, USER)).toMatchObject({ minutesApprovedBy: USER });
    expect((await rows("SELECT count(*)::int AS n FROM audit_security.audit_logs WHERE action LIKE 'committee.%'"))[0].n).toBe(3);
  });

  it('rolls back attendance recorded against a meeting of another organization', async () => {
    const id = await meeting(ORG_A);
    await db.insert(schema.committeeMeetingAttendees).values({ meetingId: id, memberId: 'member-1', attended: false } as never);

    await expect(committee.recordAttendance(id, ORG_B, [{ memberId: 'member-1', attended: true }], USER)).rejects.toThrow();

    const [attendee] = await rows('SELECT attended FROM committee_meeting_attendees WHERE meeting_id = $1', [id]);
    expect(attendee.attended).toBe(false);
    const [m] = await rows('SELECT attendee_count FROM committee_meetings WHERE id = $1', [id]);
    expect(m.attendee_count).toBeNull();
  });

  it('records attendance for the acting organization, updating the existing attendee row', async () => {
    const id = await meeting(ORG_A);
    await db.insert(schema.committeeMeetingAttendees).values({ meetingId: id, memberId: 'member-1', attended: false } as never);

    await committee.recordAttendance(id, ORG_A, [{ memberId: 'member-1', attended: true }], USER);

    expect((await rows('SELECT attended FROM committee_meeting_attendees WHERE meeting_id = $1', [id]))[0].attended).toBe(true);
    expect((await rows('SELECT attendee_count FROM committee_meetings WHERE id = $1', [id]))[0].attendee_count).toBe(1);
  });

  it('does not update an action item or remove a document of another organization', async () => {
    const [item] = await db
      .insert(schema.committeeActionItems)
      .values({ committeeId: COMMITTEE, organizationId: ORG_A, title: 'Follow up', status: 'pending', priority: 'medium' } as never)
      .returning();
    const [document] = await db
      .insert(schema.committeeDocuments)
      .values({ committeeId: COMMITTEE, organizationId: ORG_A, title: 'Agenda', fileUrl: 'https://x/a.pdf', category: 'agenda' } as never)
      .returning();

    expect(await committee.updateActionItem(item.id, ORG_B, { status: 'completed', updatedBy: USER } as never)).toBeFalsy();
    await committee.removeDocument(document.id, ORG_B, USER);

    expect((await rows('SELECT status FROM committee_action_items WHERE id = $1', [item.id]))[0].status).toBe('pending');
    expect((await rows('SELECT count(*)::int AS n FROM committee_documents WHERE id = $1', [document.id]))[0].n).toBe(1);

    expect(await committee.updateActionItem(item.id, ORG_A, { status: 'completed', updatedBy: USER } as never)).toMatchObject({ status: 'completed' });
    await committee.removeDocument(document.id, ORG_A, USER);
    expect((await rows('SELECT count(*)::int AS n FROM committee_documents WHERE id = $1', [document.id]))[0].n).toBe(0);
  });
});

describe('voting service (rows owned through their session)', () => {
  async function session(organizationId: string) {
    const [s] = await db
      .insert(schema.votingSessions)
      .values({ title: 'Ratification', type: 'simple_majority', status: 'draft', meetingType: 'general', organizationId, createdBy: USER } as never)
      .returning();
    const [option] = await db.insert(schema.votingOptions).values({ sessionId: s.id, text: 'Yes', orderIndex: 0 } as never).returning();
    const [eligibility] = await db
      .insert(schema.voterEligibility)
      .values({ sessionId: s.id, memberId: MEMBER_1, isEligible: true, canDelegate: true } as never)
      .returning();
    return { sessionId: s.id as string, optionId: option.id as string, eligibilityId: eligibility.id as string };
  }

  it('leaves another organization option and eligibility untouched', async () => {
    const a = await session(ORG_A);

    expect(await voting.updateVotingOption(a.optionId, ORG_B, { text: 'Hijacked' } as never)).toBeNull();
    expect(await voting.updateVoterEligibility(a.eligibilityId, ORG_B, { isEligible: false } as never)).toBeNull();
    await voting.deleteVotingOption(a.optionId, ORG_B);

    expect((await rows('SELECT text FROM voting_options WHERE id = $1', [a.optionId]))[0].text).toBe('Yes');
    expect((await rows('SELECT is_eligible FROM voter_eligibility WHERE id = $1', [a.eligibilityId]))[0].is_eligible).toBe(true);
  });

  it('still changes and deletes them for the owning organization', async () => {
    const a = await session(ORG_A);

    expect(await voting.updateVotingOption(a.optionId, ORG_A, { text: 'Approve' } as never)).toMatchObject({ text: 'Approve' });
    expect(await voting.updateVoterEligibility(a.eligibilityId, ORG_A, { isEligible: false } as never)).toMatchObject({ isEligible: false });
    await voting.deleteVotingOption(a.optionId, ORG_A);
    expect((await rows('SELECT count(*)::int AS n FROM voting_options WHERE id = $1', [a.optionId]))[0].n).toBe(0);
  });

  it('does not set a proxy on another organization voter row', async () => {
    const a = await session(ORG_A);
    await db.insert(schema.voterEligibility).values({ sessionId: a.sessionId, memberId: MEMBER_2, isEligible: true } as never);
    await expect(voting.setProxyVoter(a.sessionId, MEMBER_1, MEMBER_2, ORG_B)).resolves.toBeNull();
    expect((await rows('SELECT delegated_to FROM voter_eligibility WHERE id = $1', [a.eligibilityId]))[0].delegated_to).toBeNull();

    await voting.setProxyVoter(a.sessionId, MEMBER_1, MEMBER_2, ORG_A);
    expect((await rows('SELECT delegated_to FROM voter_eligibility WHERE id = $1', [a.eligibilityId]))[0].delegated_to).toBe(MEMBER_2);
  });

  it('does not rewrite an option, an eligibility row or a proxy once the session has opened', async () => {
    const a = await session(ORG_A);
    await pg.query('UPDATE voting_sessions SET status = $1 WHERE id = $2', ['active', a.sessionId]);

    await expect(voting.updateVotingOption(a.optionId, ORG_A, { text: 'Hijacked' } as never)).rejects.toThrow(/opened/);
    await expect(voting.updateVoterEligibility(a.eligibilityId, ORG_A, { isEligible: false } as never)).rejects.toThrow(/opened/);
    await expect(voting.setProxyVoter(a.sessionId, MEMBER_1, MEMBER_2, ORG_A)).rejects.toThrow(/opened/);

    expect((await rows('SELECT text FROM voting_options WHERE id = $1', [a.optionId]))[0].text).toBe('Yes');
    expect((await rows('SELECT is_eligible, delegated_to FROM voter_eligibility WHERE id = $1', [a.eligibilityId]))[0]).toMatchObject({
      is_eligible: true,
      delegated_to: null,
    });
  });
});

describe('GDPR requests and consents', () => {
  it('does not withdraw another organization consent or change another organization request', async () => {
    const [consent] = await db
      .insert(schema.userConsents)
      .values({ userId: USER, organizationId: ORG_A, consentType: 'marketing', status: 'granted', legalBasis: 'consent', processingPurpose: 'x', consentVersion: '1', consentText: 'I consent' } as never)
      .returning();
    const [request] = await db
      .insert(schema.gdprDataRequests)
      .values({ userId: USER, organizationId: ORG_A, requestType: 'access', status: 'pending', deadline: new Date('2026-12-01T00:00:00Z') } as never)
      .returning();

    expect(await gdpr.ConsentManager.withdrawConsent(USER, consent.id, ORG_B)).toBe(false);
    expect(await gdpr.GdprRequestManager.updateRequestStatus(request.id, ORG_B, 'completed', { processedBy: 'attacker' })).toBeUndefined();

    expect((await rows('SELECT status FROM user_consents WHERE id = $1', [consent.id]))[0].status).toBe('granted');
    expect((await rows('SELECT status, processed_by FROM gdpr_data_requests WHERE id = $1', [request.id]))[0]).toMatchObject({ status: 'pending', processed_by: null });

    expect(await gdpr.ConsentManager.withdrawConsent(USER, consent.id, ORG_A)).toBe(true);
    expect(await gdpr.GdprRequestManager.updateRequestStatus(request.id, ORG_A, 'completed', { processedBy: 'admin' })).toMatchObject({ status: 'completed' });
  });
});
