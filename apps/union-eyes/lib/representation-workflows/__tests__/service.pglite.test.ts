/**
 * Representation workflows against PGlite running the real platform migration 0091 SQL (append-only, withdraw-only and
 * same-organization triggers). The authority kernel decision and the canonical audit writer are stubbed; the rest is production
 * code. RLS itself (scoped 0064) is proven by db/__tests__/representation-workflows.postgres.test.ts.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';

const state = vi.hoisted(() => ({ db: null as unknown, deny: new Map<string, 'read' | 'action'>(), audits: [] as Array<{ action: string; outcome: string }> }));

vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (...a: unknown[]) => {
    const db = state.db as { transaction: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown> };
    return db.transaction((tx) => (a[a.length - 1] as (tx: unknown) => Promise<unknown>)(tx));
  },
}));
vi.mock('@/lib/audit/atomic-audit', () => ({
  persistAtomicAudit: vi.fn(async (_tx: unknown, entry: { action: string }, outcome = 'success') => {
    state.audits.push({ action: entry.action, outcome });
  }),
}));
vi.mock('@/lib/authority/store/route-adapter', () => ({
  decideCase: vi.fn(async (_tx: unknown, input: { caseId: string; action: string }) => {
    const denied = state.deny.get(input.caseId);
    if (denied === 'read') return { effect: 'deny' };
    if (denied === 'action' && input.action !== 'case:read') return { effect: 'deny' };
    return { effect: 'allow' };
  }),
}));

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';
const GROUP = 'aaaaaaaa-0000-4000-8000-000000000001';
const SINGLE = 'aaaaaaaa-0000-4000-8000-000000000002';
const OTHER_ORG = 'bbbbbbbb-0000-4000-8000-000000000001';
const DEADLINE_MISSED = 'dddddddd-0000-4000-8000-000000000001';
const DEADLINE_FUTURE = 'dddddddd-0000-4000-8000-000000000002';
const steward = { userId: 'steward-1', organizationId: ORG_A };
const president = { userId: 'president-1', organizationId: ORG_A };
const vicePresident = { userId: 'vp-1', organizationId: ORG_A };
const secondPresident = { userId: 'president-2', organizationId: ORG_A };

let pg: PGlite;

beforeAll(async () => {
  const { createTableDatabase } = await import('@/app/api/__tests__/support/pglite-tables');
  const created = await createTableDatabase([], [
    'CREATE TABLE organizations (id uuid primary key)',
    'CREATE TABLE grievances (id uuid primary key, organization_id uuid not null references organizations(id), is_group_grievance boolean default false, status text default \'filed\')',
    'CREATE TABLE organization_members (organization_id uuid, user_id text, role text, status text, deleted_at timestamptz)',
    'CREATE TABLE grievance_deadlines (id uuid primary key, grievance_id uuid not null, due_date timestamptz not null, status text not null)',
  ]);
  pg = created.pg;
  state.db = created.db;
  const file = path.resolve(__dirname, '../../../db/migrations-platform/0091_representation_workflows.sql');
  for (const s of readFileSync(file, 'utf8').split('--> statement-breakpoint').map((x) => x.trim()).filter(Boolean)) await pg.exec(s);
  await pg.exec(`INSERT INTO organizations VALUES ('${ORG_A}'), ('${ORG_B}');
    INSERT INTO grievances (id, organization_id, is_group_grievance) VALUES ('${GROUP}', '${ORG_A}', true), ('${SINGLE}', '${ORG_A}', false), ('${OTHER_ORG}', '${ORG_B}', true);
    INSERT INTO organization_members VALUES
      ('${ORG_A}', 'steward-1', 'steward', 'active', null), ('${ORG_A}', 'president-1', 'president', 'active', null),
      ('${ORG_A}', 'vp-1', 'vice_president', 'active', null), ('${ORG_A}', 'president-2', 'president', 'active', null),
      ('${ORG_A}', 'm1', 'member', 'active', null), ('${ORG_A}', 'm2', 'member', 'active', null), ('${ORG_A}', 'm3', 'member', 'active', null),
      ('${ORG_A}', 'gone', 'member', 'inactive', null), ('${ORG_B}', 'b1', 'member', 'active', null);
    INSERT INTO grievance_deadlines VALUES ('${DEADLINE_MISSED}', '${GROUP}', now() - interval '3 days', 'pending'), ('${DEADLINE_FUTURE}', '${GROUP}', now() + interval '3 days', 'pending');`);
});

afterAll(async () => {
  await pg.close();
});

beforeEach(async () => {
  state.deny.clear();
  state.audits.length = 0;
  await pg.exec(`ALTER TABLE grievance_group_participants DISABLE TRIGGER USER; ALTER TABLE grievance_representation_records DISABLE TRIGGER USER;
    DELETE FROM grievance_group_participants; DELETE FROM grievance_representation_records;
    ALTER TABLE grievance_group_participants ENABLE TRIGGER USER; ALTER TABLE grievance_representation_records ENABLE TRIGGER USER;`);
});

const consent = (memberUserId: string, employerPortionRef = 'portion-north') => ({
  memberUserId,
  employerPortionRef,
  consentForm: 'written_signature' as const,
  consentEvidenceRef: `doc-${memberUserId}`,
  consentedAt: '2027-03-01T15:00:00Z',
});

describe('group grievance consent and withdrawal', () => {
  it('is not ready to file until two members have consented, each with their own consent record', async () => {
    const svc = await import('../service');
    expect(await svc.addGroupParticipant(steward, GROUP, consent('m1'))).toMatchObject({ readyToFile: false, reasons: ['fewer_than_two_consenting_participants'] });
    expect(await svc.addGroupParticipant(steward, GROUP, { ...consent('m2'), consentForm: 'alternate_compliant_form' })).toMatchObject({ readyToFile: true, activeParticipants: 2, employerPortion: 'portion-north' });
  });

  it('refuses a member from another portion of the employer administration, and records the refusal', async () => {
    const svc = await import('../service');
    await svc.addGroupParticipant(steward, GROUP, consent('m1'));
    await expect(svc.addGroupParticipant(steward, GROUP, consent('m2', 'portion-south'))).rejects.toMatchObject({ code: 'CONFLICT', details: { code: 'incompatible_cohort' } });
    expect(state.audits.at(-1)).toEqual({ action: 'grievance_group.participant.add', outcome: 'failure' });
  });

  it('refuses participants on a non-group grievance, a non-member, an inactive member and a duplicate', async () => {
    const svc = await import('../service');
    await expect(svc.addGroupParticipant(steward, SINGLE, consent('m1'))).rejects.toMatchObject({ details: { code: 'not_a_group_grievance' } });
    await expect(svc.addGroupParticipant(steward, GROUP, consent('b1'))).rejects.toMatchObject({ details: { code: 'not_an_active_member' } });
    await expect(svc.addGroupParticipant(steward, GROUP, consent('gone'))).rejects.toMatchObject({ details: { code: 'not_an_active_member' } });
    await svc.addGroupParticipant(steward, GROUP, consent('m1'));
    await expect(svc.addGroupParticipant(steward, GROUP, consent('m1'))).rejects.toMatchObject({ details: { code: 'already_participating' } });
  });

  it('one withdrawal leaves the matter, the other participants and the withdrawn consent history intact', async () => {
    const svc = await import('../service');
    const first = await svc.addGroupParticipant(steward, GROUP, consent('m1'));
    await svc.addGroupParticipant(steward, GROUP, consent('m2'));
    await svc.addGroupParticipant(steward, GROUP, consent('m3'));
    const out = await svc.withdrawGroupParticipant(steward, GROUP, first.participantId, { reason: 'member asked to withdraw', evidenceRef: 'doc-w1' });
    expect(out).toMatchObject({ withdrawn: true, readyToFile: true, activeParticipants: 2, withdrawnParticipants: 1 });
    const view = await svc.readGroupParticipants(steward, GROUP);
    expect(view.participants).toHaveLength(3);
    expect((await pg.query(`SELECT status FROM grievances WHERE id = '${GROUP}'`)).rows).toEqual([{ status: 'filed' }]);
    await expect(svc.withdrawGroupParticipant(steward, GROUP, first.participantId, { reason: 'again, twice', evidenceRef: null })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(pg.exec(`UPDATE grievance_group_participants SET consent_evidence_ref = 'x' WHERE id = '${first.participantId}'`)).rejects.toThrow(/withdrawal is final/);
    await expect(pg.exec(`DELETE FROM grievance_group_participants`)).rejects.toThrow(/append-only/);
  });

  it('withdrawing below two participants makes the matter not ready to file again', async () => {
    const svc = await import('../service');
    const a = await svc.addGroupParticipant(steward, GROUP, consent('m1'));
    await svc.addGroupParticipant(steward, GROUP, consent('m2'));
    expect(await svc.withdrawGroupParticipant(steward, GROUP, a.participantId, { reason: 'member asked to withdraw', evidenceRef: null })).toMatchObject({ readyToFile: false });
  });
});

describe('filing paths and approvals', () => {
  it('keeps the employer case identifier and the arrival form of an employer-initiated filing', async () => {
    const svc = await import('../service');
    await svc.recordRepresentation(steward, GROUP, 'employer_initiated_filing', {
      employerRef: 'employer-1', employerCaseRef: 'EMP-2027-0042', receivedOnDay: '2027-03-01', form: 'alternate_compliant_form', employerAcknowledgementRef: null, summary: 'Employer-initiated matter',
    }, null);
    const view = await svc.readRepresentationRecords(steward, GROUP);
    expect(view.records[0].payload).toMatchObject({ employerCaseRef: 'EMP-2027-0042', form: 'alternate_compliant_form' });
  });

  it('a policy filing is approved only by two people in two different executive offices, neither the requester', async () => {
    const svc = await import('../service');
    const filing = await svc.recordRepresentation(steward, GROUP, 'policy_filing', { routeToFinalLevel: true, requiredApprovals: 2, summary: 'Policy matter, all members' }, null);
    expect(filing.approvals).toEqual([{ recordId: filing.recordId, required: 2, approvals: 0, distinctOffices: 0, approved: false }]);
    const approve = { decision: 'approve', note: null };
    await expect(svc.recordRepresentation(steward, GROUP, 'filing_approval', approve, filing.recordId)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await svc.recordRepresentation(president, GROUP, 'filing_approval', approve, filing.recordId);
    await expect(svc.recordRepresentation(president, GROUP, 'filing_approval', approve, filing.recordId)).rejects.toMatchObject({ details: { code: 'already_approved' } });
    await expect(svc.recordRepresentation(secondPresident, GROUP, 'filing_approval', approve, filing.recordId)).rejects.toMatchObject({ details: { code: 'office_already_approved' } });
    const done = await svc.recordRepresentation(vicePresident, GROUP, 'filing_approval', approve, filing.recordId);
    expect(done.approvals[0]).toMatchObject({ approvals: 2, distinctOffices: 2, approved: true });
  });

  it('the requester cannot approve their own filing even when holding an office', async () => {
    const svc = await import('../service');
    const filing = await svc.recordRepresentation(president, GROUP, 'policy_filing', { routeToFinalLevel: true, requiredApprovals: 2, summary: 'Policy matter, all members' }, null);
    await expect(svc.recordRepresentation(president, GROUP, 'filing_approval', { decision: 'approve', note: null }, filing.recordId)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('final-level handoff', () => {
  const handoff = { signedOnDay: '2027-05-01', receivingComponentRef: 'national-component', packetDocumentRefs: ['doc-1', 'doc-2'], summary: 'Referred to the final level' };

  it('is signed by an executive office holder and acknowledged by someone else, once', async () => {
    const svc = await import('../service');
    await expect(svc.recordRepresentation(steward, GROUP, 'final_level_handoff', handoff, null)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const h = await svc.recordRepresentation(president, GROUP, 'final_level_handoff', handoff, null);
    await expect(svc.recordRepresentation(president, GROUP, 'handoff_receipt', { receivedOnDay: '2027-05-02', note: null }, h.recordId)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await svc.recordRepresentation(steward, GROUP, 'handoff_receipt', { receivedOnDay: '2027-05-02', note: null }, h.recordId);
    await expect(svc.recordRepresentation(vicePresident, GROUP, 'handoff_receipt', { receivedOnDay: '2027-05-03', note: null }, h.recordId)).rejects.toMatchObject({ details: { code: 'already_received' } });
    expect((await svc.readRepresentationRecords(steward, GROUP)).handoffs).toEqual([{ recordId: h.recordId, received: true }]);
  });

  it('a handoff packet needs at least one document', async () => {
    const svc = await import('../service');
    await expect(svc.recordRepresentation(president, GROUP, 'final_level_handoff', { ...handoff, packetDocumentRefs: [] }, null)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

describe('abandonment and beyond-control exceptions', () => {
  it('records a missed-escalation finding only against a past, unmet deadline of the grievance, and never closes the grievance', async () => {
    const svc = await import('../service');
    const base = { basis: 'missed_escalation_finding', evidenceRef: 'doc-a', note: 'No escalation within the period' };
    await expect(svc.recordRepresentation(steward, GROUP, 'abandonment', { ...base, missedDeadlineId: DEADLINE_FUTURE }, null)).rejects.toMatchObject({ details: { code: 'deadline_not_missed' } });
    await expect(svc.recordRepresentation(steward, GROUP, 'abandonment', { ...base, missedDeadlineId: null }, null)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await svc.recordRepresentation(steward, GROUP, 'abandonment', { ...base, missedDeadlineId: DEADLINE_MISSED }, null);
    await svc.recordRepresentation(steward, GROUP, 'beyond_control_exception', { reason: 'Member hospitalised during the period', evidenceRef: 'doc-b', affectedDeadlineId: DEADLINE_MISSED }, null);
    expect((await pg.query(`SELECT status FROM grievances WHERE id = '${GROUP}'`)).rows).toEqual([{ status: 'filed' }]);
    await expect(pg.exec(`UPDATE grievance_representation_records SET payload = '{}'::jsonb`)).rejects.toThrow(/append-only/);
    await expect(pg.exec(`DELETE FROM grievance_representation_records`)).rejects.toThrow(/append-only/);
  });

  it('refuses a parent on a record that takes none, and a missing parent on one that needs it', async () => {
    const svc = await import('../service');
    await expect(svc.recordRepresentation(steward, GROUP, 'filing_approval', { decision: 'approve', note: null }, null)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(svc.recordRepresentation(steward, GROUP, 'beyond_control_exception', { reason: 'Member hospitalised', evidenceRef: 'd', affectedDeadlineId: null }, DEADLINE_MISSED)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

describe('tenant and authority negatives', () => {
  it("another organization's grievance answers 404 and nothing is written", async () => {
    const svc = await import('../service');
    await expect(svc.addGroupParticipant(steward, OTHER_ORG, consent('m1'))).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(svc.readRepresentationRecords(steward, OTHER_ORG)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect((await pg.query('SELECT 1 FROM grievance_group_participants')).rows).toHaveLength(0);
  });

  it('the database refuses a row whose organization is not the grievance organization', async () => {
    await expect(pg.exec(`INSERT INTO grievance_group_participants (organization_id, grievance_id, member_user_id, employer_portion_ref, consent_form, consent_evidence_ref, consented_at, recorded_by)
      VALUES ('${ORG_A}', '${OTHER_ORG}', 'm1', 'p', 'written_signature', 'd', now(), 'x')`)).rejects.toThrow(/is not in organization/);
  });

  it('kernel: cannot read → 404, may read but not act → 403', async () => {
    const svc = await import('../service');
    state.deny.set(GROUP, 'read');
    await expect(svc.readGroupParticipants(steward, GROUP)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    state.deny.set(GROUP, 'action');
    await expect(svc.addGroupParticipant(steward, GROUP, consent('m1'))).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(svc.recordRepresentation(president, GROUP, 'policy_filing', { routeToFinalLevel: true, requiredApprovals: 2, summary: 'Policy matter' }, null)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
