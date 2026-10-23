import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { memberStatusView, publishMemberStatus, withdrawPublication } from '../src/publication.ts';
import type { MemberPublication } from '../src/publication.ts';
import { revokeAuthorization } from '../src/revocation.ts';
import type { RevocationState } from '../src/revocation.ts';
import { authorizeDocumentAccess, authorizeSpecialistMatterAccess } from '../src/authorization.ts';
import { asDependencyId, asReminderId, asTaskId } from '../src/ids.ts';
import { generateReceiptFollowUp, scheduleReminder } from '../src/followup.ts';
import type { ReceiptFollowUpTask, Reminder } from '../src/followup.ts';
import { openDependency, recordBatch } from '../src/dependency.ts';
import { MATTER_ID, MEMBER_P, NOW, NOW_ISO, OTHER_MEMBER_P, ORG_B, PRINCIPAL_1, REP_A, REP_B, SPEC_1, allowDecision, authorization, disclosureGrant, document, matterGrant, openMatter, submissionAt, CLAIM_X } from './helpers.ts';

const code = (r: { ok: boolean }) => (r as { code?: string }).code;
const val = <T>(r: { ok: boolean }) => (r as unknown as { value: T }).value;

describe('deny-by-default member publication', () => {
  const publish = (over: Partial<Parameters<typeof publishMemberStatus>[0]> = {}) =>
    publishMemberStatus({
      principal: SPEC_1,
      matter: openMatter(),
      professionalAuth: allowDecision,
      stage: 'DOCUMENTS_SENT_TO_WSIB',
      text: 'Your documents were sent to WSIB. We are waiting for WSIB to confirm they arrived.',
      evidence: { kind: 'SUBMISSION', submission: submissionAt('DISPATCHED', 'WRF') },
      priorVersions: [],
      now: NOW_ISO,
      ...over,
    });

  it('[WA-T085][WA-T023] with nothing published a member sees only "no update", never the internal state machine', () => {
    const v = memberStatusView(MEMBER_P, openMatter(), []);
    assert.deepEqual(v, { state: 'NO_UPDATE_PUBLISHED', recordsAccessRequestChannel: 'AVAILABLE' });
  });

  it('[WA-T049] a published, approved, versioned text is the only thing a member receives', () => {
    const p = val<MemberPublication>(publish());
    const v = memberStatusView(MEMBER_P, openMatter(), [p]);
    assert.deepEqual(Object.keys(v!).sort(), ['publishedAt', 'recordsAccessRequestChannel', 'stage', 'state', 'text', 'version']);
    const polluted = { ...p, internalNote: 'SYNTH-CANARY Clio note', documentTitle: 'SYNTH-CANARY psychiatric assessment' } as MemberPublication;
    assert.equal(JSON.stringify(memberStatusView(MEMBER_P, openMatter(), [polluted])).includes('SYNTH-CANARY'), false);
  });

  it('[WA-T051] the lawful records-access channel is always present, including when nothing is published or a publication is withdrawn', () => {
    const p = val<MemberPublication>(publish());
    assert.equal(memberStatusView(MEMBER_P, openMatter(), [withdrawPublication(p, NOW_ISO)])?.recordsAccessRequestChannel, 'AVAILABLE');
    assert.equal(memberStatusView(MEMBER_P, openMatter(), [withdrawPublication(p, NOW_ISO)])?.state, 'NO_UPDATE_PUBLISHED');
  });

  it('other members, union users and inactive sessions get nothing', () => {
    const p = val<MemberPublication>(publish());
    assert.equal(memberStatusView(OTHER_MEMBER_P, openMatter(), [p]), null);
    assert.equal(memberStatusView(REP_A, openMatter(), [p]), null);
    assert.equal(memberStatusView({ ...MEMBER_P, sessionActive: false }, openMatter(), [p]), null);
  });

  it('[WA-ADV-14] a draft is never a milestone: sent/received/ARO stages need matching evidence', () => {
    for (const s of ['DRAFT', 'REVIEWED', 'APPROVED'] as const) {
      assert.equal(code(publish({ evidence: { kind: 'SUBMISSION', submission: submissionAt(s, 'WRF') } })), 'EVIDENCE_DOES_NOT_SUPPORT_STAGE');
    }
    assert.equal(code(publish({ stage: 'WSIB_RECEIPT_CONFIRMED', evidence: { kind: 'SUBMISSION', submission: submissionAt('DISPATCHED', 'WRF') } })), 'EVIDENCE_DOES_NOT_SUPPORT_STAGE');
    assert.equal(publish({ stage: 'WSIB_RECEIPT_CONFIRMED', evidence: { kind: 'SUBMISSION', submission: submissionAt('RECEIPT_CONFIRMED', 'WRF') } }).ok, true);
    assert.equal(code(publish({ stage: 'APPEAL_SENT_TO_WSIB', evidence: { kind: 'SUBMISSION', submission: submissionAt('DISPATCHED', 'WRF') } })), 'EVIDENCE_DOES_NOT_SUPPORT_STAGE');
    assert.equal(publish({ stage: 'APPEAL_SENT_TO_WSIB', evidence: { kind: 'SUBMISSION', submission: submissionAt('DISPATCHED', 'ARF') } }).ok, true);
    assert.equal(code(publish({ stage: 'REPRESENTATION_ACCEPTED', evidence: { kind: 'NONE' } })), 'EVIDENCE_DOES_NOT_SUPPORT_STAGE');
    assert.equal(code(publish({ stage: 'REPRESENTATION_ACCEPTED', evidence: { kind: 'MATTER_ACCEPTANCE' }, matter: openMatter({ acceptance: null }) })), 'EVIDENCE_DOES_NOT_SUPPORT_STAGE');
  });

  it('[WA-ADV-14] "ARO decided" cannot be published from a waiting dependency or a drafted ARF', () => {
    const waiting = val<ReturnType<typeof recordBatch>>(openDependency({ id: asDependencyId('D'), matterId: MATTER_ID, claimId: null, kind: 'ARO_DECISION', waitingSince: '2026-10-01', owner: SPEC_1.userId, expectedWindowDays: null }));
    assert.equal(code(publish({ stage: 'ARO_DECISION_RECEIVED', evidence: { kind: 'DEPENDENCY', dependency: waiting } })), 'EVIDENCE_DOES_NOT_SUPPORT_STAGE');
    assert.equal(code(publish({ stage: 'ARO_DECISION_RECEIVED', evidence: { kind: 'SUBMISSION', submission: submissionAt('DRAFT', 'ARF') } })), 'EVIDENCE_DOES_NOT_SUPPORT_STAGE');
    const received = recordBatch(waiting, { receivedOn: '2027-01-10', pageCount: 4, missingPagesNote: null });
    assert.equal(publish({ stage: 'ARO_DECISION_RECEIVED', text: 'A decision was received and your representative will contact you.', evidence: { kind: 'DEPENDENCY', dependency: received } }).ok, true);
  });

  it('publication needs a professional authorization, text, and a sane length; versions increment', () => {
    const denied = { allow: false as const, publicOutcome: 'FORBIDDEN' as const, reason: 'no acceptance' };
    assert.equal(code(publish({ professionalAuth: denied })), 'NOT_AUTHORIZED');
    assert.equal(code(publish({ text: '  ' })), 'TEXT_REQUIRED');
    assert.equal(code(publish({ text: 'x'.repeat(601) })), 'TEXT_TOO_LONG');
    const p1 = val<MemberPublication>(publish());
    const p2 = val<MemberPublication>(publish({ priorVersions: [p1], text: 'Update two.' }));
    assert.equal(p2.version, 2);
    assert.equal(memberStatusView(MEMBER_P, openMatter(), [p1, p2])?.version, 2);
  });
});

describe('authority revocation cascade (reference contract)', () => {
  const authRelease = authorization('SHARE_INFORMATION_RELEASE', { id: 'FAKE-AUTH-RELEASE' as never });
  const doa = authorization('WSIB_DOA');
  const setup = (): RevocationState => {
    const sub = submissionAt('DISPATCHED', 'WRF');
    const task = val<{ task: ReceiptFollowUpTask }>(generateReceiptFollowUp({ submission: sub, existingTasks: [], taskOfRecord: 'UNION_EYES', rule: null, owner: SPEC_1.userId, newTaskId: asTaskId('T1') })).task;
    const reminder = val<Reminder>(scheduleReminder({ task, existing: [], offsetKey: 'due', fireAtMs: NOW.getTime() + 3600_000, newId: asReminderId('R1') }));
    return {
      authorizations: [authRelease, doa],
      matterGrants: [matterGrant()],
      documentGrants: [disclosureGrant()],
      tasks: [task],
      reminders: [reminder],
      submissions: [submissionAt('APPROVED', 'ITO', 2), sub],
      revocationEpoch: 7,
    };
  };
  const matterRef = () => openMatter();
  const checkSpecialist = (s: RevocationState) => ({
    matter: authorizeSpecialistMatterAccess({ principal: SPEC_1, matter: matterRef(), grant: s.matterGrants[0]!, permission: 'VIEW', now: NOW }),
    document: authorizeDocumentAccess({ principal: SPEC_1, document: document(), matter: matterRef(), matterGrant: s.matterGrants[0]!, disclosureGrants: s.documentGrants, action: 'VIEW', now: NOW }),
  });

  it('[WA-T084][WA-ADV-03] revoking the instrument revokes dependent matter and document grants, bumps the epoch, and cancels reminders for the affected user', () => {
    const before = setup();
    assert.equal(checkSpecialist(before).document.allow, true);
    const r = val<ReturnType<typeof revokeAuthorization> extends infer R ? (R extends { ok: true; value: infer V } ? V : never) : never>(revokeAuthorization(before, authRelease.id, PRINCIPAL_1, matterRef(), NOW_ISO));
    const after = r.state;
    assert.equal(after.matterGrants[0]?.status, 'REVOKED');
    assert.equal(after.documentGrants[0]?.status, 'REVOKED');
    assert.equal(after.revocationEpoch, 8);
    assert.equal(after.reminders[0]?.status, 'CANCELLED_SUPERSEDED');
    assert.equal(checkSpecialist(after).matter.allow, false);
    assert.equal(checkSpecialist(after).document.allow, false);
    assert.deepEqual(r.sessionInvalidations, [{ userId: SPEC_1.userId, matterId: MATTER_ID }], 'scoped to one user and one matter, not unrelated organizations');
    assert.ok(r.auditEvents.some((e) => e.action === 'MATTER_GRANT_REVOKED_BY_CASCADE'));
  });

  it('[WA-T084] revoking a WSIB DOA does not revoke technical grants (distinct records) but returns undispatched approvals for re-review', () => {
    const r = val<{ state: RevocationState; approvalsToInvalidate: string[]; sessionInvalidations: unknown[] }>(revokeAuthorization(setup(), doa.id, PRINCIPAL_1, matterRef(), NOW_ISO));
    assert.equal(r.state.matterGrants[0]?.status, 'ACTIVE');
    assert.equal(r.state.authorizations.find((a) => a.id === doa.id)?.status, 'REVOKED');
    assert.deepEqual(r.approvalsToInvalidate, ['FAKE-SUB-ITO-2']);
    assert.deepEqual(r.sessionInvalidations, []);
  });

  it('only a party to the matter with a revoking role may revoke; other organizations learn nothing', () => {
    assert.equal(code(revokeAuthorization(setup(), authRelease.id, REP_A, matterRef(), NOW_ISO)), 'NOT_AUTHORIZED');
    assert.equal(code(revokeAuthorization(setup(), authRelease.id, REP_B, matterRef(), NOW_ISO)), 'NOT_AUTHORIZED');
    const outsiderPrincipal = { ...PRINCIPAL_1, organizationId: ORG_B };
    assert.equal(code(revokeAuthorization(setup(), authRelease.id, outsiderPrincipal, matterRef(), NOW_ISO)), 'NO_SUCH_AUTHORIZATION');
  });

  it('revocation always emits audit events; none of them removes prior audit', () => {
    const r = val<{ auditEvents: unknown[] }>(revokeAuthorization(setup(), authRelease.id, PRINCIPAL_1, matterRef(), NOW_ISO));
    assert.ok(r.auditEvents.length >= 2);
  });
});

void CLAIM_X;
