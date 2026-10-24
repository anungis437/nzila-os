import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FX, MATTER, REF_ID, PDF, POLICY, SUB_ITO, accepted, itoApproved, itoSent, offered, stageMatter, stageSent, withAngeloAccess, withClaims, withDoc, withMember, withObjection, world0 } from './scenario.ts';
import { act, decide, must, see } from './trace.ts';
import {
  clioReport, closeMatter, createOutbound, grantMatterAccess, openObligation, openWait, outboundClaimReferences, publishStatus, readDocument, reassignResponsibility, recordAroDecision, referralEvent, registerMember, requestInfo, revoke,
  runReminderWorker, setWorkContext, submissionEvent, supplyInfo, tick, uploadDocument, placeHold, releaseDocument, grantMatterAccess as grant2, createReferral, assignSpecialist, recordAuthorization, withdrawStatus, determineFiling,
} from '../src/journey.ts';
import { memberView, specialistView, supervisorView, unionView } from '../src/journey-views.ts';
import type { World } from '../src/journey.ts';
import { grantUrgentException } from '../src/referral.ts';
import { buildNotification } from '../src/authorization.ts';
import { asAuthorizationId, asDecisionId, asDependencyId, asDocumentId, asIssueId, asMatterGrantId, asMemberId, asSubmissionId } from '../src/ids.ts';
import type { DeadlineObligation } from '../src/deadlines.ts';
import { ADMIN_A, ADMIN_B, CLAIM_X, CLAIM_Y, MEMBER_ID, MEMBER_P, ORG_A, ORG_B, ORG_WA, OTHER_MEMBER_P, PRINCIPAL_1, REP_A, REP_B, SPEC_1, SPEC_2, completePacket } from './helpers.ts';

const x = { fixture: FX.matter001 };
const views = (w: World) => ({
  domenic: JSON.stringify(specialistView(w, SPEC_1)),
  angelo: JSON.stringify(supervisorView(w, PRINCIPAL_1)),
  union: JSON.stringify(unionView(w, REP_A, REF_ID)),
  member: JSON.stringify(memberView(w, MEMBER_P)),
});
type V = ReturnType<typeof views>;
const changed = (a: V, b: V) => ({ domenic: a.domenic !== b.domenic, angelo: a.angelo !== b.angelo, union: a.union !== b.union, member: a.member !== b.member });

describe('Cross-persona propagation: an event changes only the views it is permitted to change', () => {
  it('[WA-J-X] dispatch, publication, receipt and information requests reach only the personas entitled to them', () => {
    const cal = { timeZone: 'America/Toronto', holidays: [] };
    let w = withAngeloAccess(itoApproved(stageMatter()));
    let before = views(w);
    w = must(submissionEvent(w, SPEC_1, SUB_ITO, { type: 'ATTEMPT_DISPATCH', requestId: 'REQ-1', method: 'FAX_RECORDED_MANUALLY' }));
    w = must(submissionEvent(w, SPEC_1, SUB_ITO, { type: 'CONFIRM_DISPATCH', requestId: 'REQ-1', transmissionRef: 'FAKE-TX-0001' }));
    let after = views(w);
    see(w, { ...x, id: 'X-01', persona: 'SYSTEM', p: null, op: 'confirmed dispatch propagates', expect: 'specialist and supervisor see the unconfirmed receipt; union and member see nothing new', req: ['WA-REQ-040', 'WA-REQ-063'], find: ['WA-R1-04', 'WA-R1-14'], mx: ['WA-T037', 'WA-T085'], view: () => changed(before, after), check: (c) => assert.deepEqual(c, { domenic: true, angelo: true, union: false, member: false }) });
    before = after;
    w = must(publishStatus(w, SPEC_1, { matterId: MATTER, stage: 'DOCUMENTS_SENT_TO_WSIB', text: 'Your documents were sent to WSIB.', evidence: { kind: 'SUBMISSION', submissionId: SUB_ITO } }));
    after = views(w);
    see(w, { ...x, id: 'X-02', persona: 'SYSTEM', p: null, op: 'a member-only publication propagates', expect: 'only the member view changes', req: ['WA-REQ-063'], find: ['WA-R1-14'], view: () => changed(before, after), check: (c) => assert.deepEqual(c, { domenic: false, angelo: false, union: false, member: true }) });
    before = after;
    w = must(publishStatus(w, SPEC_1, { matterId: MATTER, stage: 'GENERAL_UPDATE', text: 'Your documents are being prepared.', unionVisible: true, evidence: { kind: 'NONE' } }));
    after = views(w);
    see(w, { ...x, id: 'X-03', persona: 'SYSTEM', p: null, op: 'a union-visible publication propagates', expect: 'member and union views change; professional views do not', req: ['WA-REQ-063'], find: ['WA-R1-14'], view: () => changed(before, after), check: (c) => assert.deepEqual(c, { domenic: false, angelo: false, union: true, member: true }) });
    before = after;
    w = must(submissionEvent(w, SPEC_1, SUB_ITO, { type: 'CONFIRM_RECEIPT', method: 'PHONE_CALL', contactRef: 'FAKE WSIB CLERK', receivedAt: '2026-10-24T14:00:00Z' }));
    after = views(w);
    see(w, { ...x, id: 'X-04', persona: 'SYSTEM', p: null, op: 'documented receipt propagates', expect: 'professional views change; member and union are told nothing until a professional publishes', req: ['WA-REQ-032', 'WA-REQ-063'], find: ['WA-R1-04', 'WA-C-001'], mx: ['WA-T040', 'WA-T103'], view: () => changed(before, after), check: (c) => assert.deepEqual(c, { domenic: true, angelo: true, union: false, member: false }) });
    before = after;
    w = must(requestInfo(w, SPEC_1, { requestId: 'REQ-UNION-1', matterId: MATTER, addressedTo: 'UNION', code: 'EMPLOYER_NAME' }));
    after = views(w);
    see(w, { ...x, id: 'X-05', persona: 'SYSTEM', p: null, op: 'an information request addressed to the union propagates', expect: 'specialist and union change; supervisor and member do not', req: ['WA-REQ-053'], view: () => changed(before, after), check: (c) => assert.deepEqual(c, { domenic: true, angelo: false, union: true, member: false }) });
    void cal;
  });
});

describe('Cross-persona challenges on one synthetic matter', () => {
  it('[WA-J-X] multiple claims for one worker: only professionals see claim numbers; historical other-employer claims stay private', () => {
    let w = withAngeloAccess(stageMatter());
    w = must(openWait(w, SPEC_1, { id: asDependencyId('DEP-1'), matterId: MATTER, claimId: CLAIM_X, kind: 'WSIB_CLAIM_FILE', waitingSince: '2026-10-24', expectedWindowDays: null }));
    w = must(publishStatus(w, SPEC_1, { matterId: MATTER, stage: 'GENERAL_UPDATE', text: 'Your file is being prepared.', unionVisible: true, evidence: { kind: 'NONE' } }));
    assert.equal(w.graph.claims.length, 2);
    for (const [id, who, json] of [['X-06', 'union', JSON.stringify(unionView(w, REP_A, REF_ID))], ['X-07', 'member', JSON.stringify(memberView(w, MEMBER_P))]] as const) {
      see(w, { ...x, id, persona: who === 'union' ? 'UNION_REP' : 'MEMBER', p: who === 'union' ? REP_A : MEMBER_P, op: `${who} view with two claims on file`, expect: 'no claim number, employer or decision anywhere', req: ['WA-REQ-024', 'WA-REQ-063'], find: ['WA-R4-01', 'WA-R2-01'], mx: ['WA-T007', 'WA-T071'], view: () => json, check: (j) => { for (const b of ['FAKE-WSIB', 'EMPLOYER-', 'A-CLAIM', 'A-D1']) assert.equal(j.includes(b), false, b); } });
    }
    see(w, { ...x, id: 'X-08', persona: 'DOMENIC', p: SPEC_1, op: 'specialist outbound references for claim X with historical claim Y on file', expect: 'target claim only', req: ['WA-REQ-024'], find: ['WA-R2-01', 'WA-R5-02'], mx: ['WA-T071'], view: () => outboundClaimReferences(w, CLAIM_X), check: (r) => assert.deepEqual(r.ok && r.value.included, ['FAKE-WSIB-000011']) });
    w = act(w, { ...x, id: 'X-09', persona: 'DOMENIC', p: SPEC_1, op: 'validate work context for the historical other-employer claim', expect: 'OK', audit: 'WORK_CONTEXT_VALIDATED', req: ['WA-REQ-024'], run: (s) => setWorkContext(s, SPEC_1, { matterId: MATTER, claimId: CLAIM_Y, reason: 'confirmed against the decision letter that this is the same worksite' }) });
    see(w, { ...x, id: 'X-10', persona: 'DOMENIC', p: SPEC_1, op: 'references after a work-context validation for a different-employer claim', expect: 'still excluded: validation never overrides an employer mismatch', req: ['WA-REQ-024'], find: ['WA-R2-01', 'WA-R5-02'], mx: ['WA-T071', 'WA-T072'], view: () => outboundClaimReferences(w, CLAIM_X), check: (r) => assert.deepEqual(r.ok && r.value.included, ['FAKE-WSIB-000011']) });
  });

  it('[WA-J-X] revoked specialist authority: access, reminders and approvals stop; other personas see no leak and no change they are not entitled to', () => {
    const cal = { timeZone: 'America/Toronto', holidays: [] };
    let w = stageMatter();
    w = withDoc(w, 'FAKE-DOC-CORR', 'WSIB_CORRESPONDENCE');
    // Setup, not a recorded step: the specialist holds a live per-document grant tied to the matter grant, so the read before revocation is a real ALLOW.
    w = { ...w, disclosureGrants: [...w.disclosureGrants, { id: 'FAKE-DG-SPEC-1' as never, documentId: asDocumentId('FAKE-DOC-CORR'), audience: { kind: 'SPECIALIST', userId: SPEC_1.userId }, actions: ['VIEW'], approvedBy: ADMIN_A.userId, status: 'ACTIVE', expiresAt: null, revokedAt: null, matterGrantId: asMatterGrantId('FAKE-MG-1') }] };
    w = must(createOutbound(w, SPEC_1, { submissionId: asSubmissionId('FAKE-SUB-WRF-2'), matterId: MATTER, kind: 'WRF', version: 1, claimId: CLAIM_X }));
    w = must(submissionEvent(w, SPEC_1, asSubmissionId('FAKE-SUB-WRF-2'), { type: 'REVIEW' }));
    w = must(submissionEvent(w, SPEC_1, asSubmissionId('FAKE-SUB-WRF-2'), { type: 'APPROVE', claimedApprover: SPEC_1.userId }));
    const before = views(w);
    decide({ ...x, id: 'X-11', persona: 'DOMENIC', p: SPEC_1, op: 'specialist reads a document before revocation', expect: 'ALLOW', req: ['WA-REQ-012'], run: () => readDocument(w, SPEC_1, asDocumentId('FAKE-DOC-CORR')) });
    w = act(w, { ...x, id: 'X-12', persona: 'UNION_REP', p: REP_A, op: 'a union referral representative revokes the release authorization', expect: 'NOT_AUTHORIZED', req: ['WA-REQ-015'], find: ['WA-R3-008'], run: (s) => revoke(s, REP_A, { matterId: MATTER, authorizationId: asAuthorizationId('FAKE-AUTH-RELEASE') }) });
    w = act(w, { ...x, id: 'X-13', persona: 'UNION_REP', p: ADMIN_A, op: 'the union administrator revokes the release authorization', expect: 'OK', audit: 'AUTHORIZATION_REVOKED', req: ['WA-REQ-015'], find: ['WA-R1-13', 'WA-R3-008', 'WA-R3-015', 'WA-R4-09'], mx: ['WA-T084', 'WA-T018'], run: (s) => revoke(s, ADMIN_A, { matterId: MATTER, authorizationId: asAuthorizationId('FAKE-AUTH-RELEASE') }) });
    assert.deepEqual(w.sessionInvalidations, [{ userId: SPEC_1.userId, matterId: MATTER }], 'invalidation is scoped to one user and one matter');
    assert.equal(w.revocationEpoch, 1);
    decide({ ...x, id: 'X-14', persona: 'DOMENIC', p: SPEC_1, op: 'specialist reads the document after revocation', expect: 'NOT_FOUND', req: ['WA-REQ-015'], find: ['WA-R1-13', 'WA-R3-008'], mx: ['WA-T018', 'WA-T084'], run: () => readDocument(w, SPEC_1, asDocumentId('FAKE-DOC-CORR')) });
    see(w, { ...x, id: 'X-15', persona: 'DOMENIC', p: SPEC_1, op: 'specialist queue after revocation', expect: 'empty: the matter is no longer reachable', req: ['WA-REQ-015'], find: ['WA-R1-13'], mx: ['WA-T084', 'WA-T100'], view: (s) => specialistView(s, SPEC_1), check: (v) => assert.deepEqual([v?.tasks, v?.receiptUnconfirmed, v?.infoRequests], [[], [], []]) });
    w = act(w, { ...x, id: 'X-16', persona: 'DOMENIC', p: SPEC_1, op: 'specialist dispatches a previously approved document after revocation', expect: 'NOT_FOUND', req: ['WA-REQ-015'], find: ['WA-R3-008'], run: (s) => submissionEvent(s, SPEC_1, asSubmissionId('FAKE-SUB-WRF-2'), { type: 'ATTEMPT_DISPATCH', requestId: 'R', method: 'm' }) });
    see(w, { ...x, id: 'X-17', persona: 'MEMBER', p: MEMBER_P, op: 'member view after the specialist lost access', expect: 'unchanged: revocation of a specialist is not a member event', req: ['WA-REQ-063'], view: (s) => views(s), check: (v) => assert.equal(v.member, before.member) });
    // revoking the DOA is a different record: technical access stays, but an approved, unsent submission goes back for review
    let w2 = withAngeloAccess(stageMatter());
    w2 = must(createOutbound(w2, SPEC_1, { submissionId: asSubmissionId('FAKE-SUB-WRF-3'), matterId: MATTER, kind: 'WRF', version: 1, claimId: CLAIM_X }));
    w2 = must(submissionEvent(w2, SPEC_1, asSubmissionId('FAKE-SUB-WRF-3'), { type: 'REVIEW' }));
    w2 = must(submissionEvent(w2, SPEC_1, asSubmissionId('FAKE-SUB-WRF-3'), { type: 'APPROVE', claimedApprover: SPEC_1.userId }));
    w2 = act(w2, { ...x, id: 'X-18', persona: 'DOMENIC', p: PRINCIPAL_1, op: 'the principal revokes the WSIB DOA', expect: 'OK', audit: 'AUTHORIZATION_REVOKED', req: ['WA-REQ-015'], find: ['WA-R4-09'], mx: ['WA-T084', 'WA-T017'], run: (s) => revoke(s, PRINCIPAL_1, { matterId: MATTER, authorizationId: asAuthorizationId('FAKE-AUTH-DOA') }) });
    assert.equal(w2.submissions.find((s) => s.id === asSubmissionId('FAKE-SUB-WRF-3'))?.state, 'REVIEWED', 'approval was invalidated');
    assert.equal(w2.matterGrants.find((g) => g.userId === SPEC_1.userId)?.status, 'ACTIVE', 'technical access is a separate record and is unchanged');
    w2 = act(w2, { ...x, id: 'X-19', persona: 'DOMENIC', p: SPEC_1, op: 'dispatch as WSIB representative without a live DOA', expect: 'AUTHORITY_DENIED', req: ['WA-REQ-010', 'WA-REQ-011'], find: ['WA-R4-09', 'WA-R2-05'], mx: ['WA-T017'], run: (s) => {
      const rev = must(submissionEvent(s, SPEC_1, asSubmissionId('FAKE-SUB-WRF-3'), { type: 'APPROVE', claimedApprover: SPEC_1.userId }));
      return submissionEvent(rev, SPEC_1, asSubmissionId('FAKE-SUB-WRF-3'), { type: 'ATTEMPT_DISPATCH', requestId: 'R', method: 'm' });
    } });
    void cal;
  });

  it('[WA-J-X] incomplete urgent referral and missing professional acceptance: exceptions never become completeness or acceptance', () => {
    const noPhoto = completePacket({ items: completePacket().items.filter((i) => i.code !== 'GOVERNMENT_PHOTO_ID') });
    let w = withMember(world0());
    w = must(createReferral(w, REP_A, { referralId: REF_ID, memberId: MEMBER_ID, specialistOrganizationId: ORG_WA }));
    w = must(referralEvent(w, REP_A, REF_ID, { type: 'UPDATE_PACKET', packet: noPhoto }));
    const ex = must(grantUrgentException(SPEC_1, POLICY.referral, { reason: 'objection date review needed within days', waivedItems: ['GOVERNMENT_PHOTO_ID'], urgencyBasis: 'objection date review' }) as never) as never;
    w = act(w, { ...x, fixture: FX.urgent, id: 'X-20', persona: 'UNION_REP', p: REP_A, op: 'offer under a granted urgent exception', expect: 'OK', audit: 'REFERRAL_OFFER', req: ['WA-REQ-006'], find: ['WA-R1-16', 'WA-R2-04', 'WA-R4-03'], mx: ['WA-T011', 'WA-T076'], run: (s) => referralEvent(s, REP_A, REF_ID, { type: 'OFFER', urgentException: ex }) });
    see(w, { ...x, fixture: FX.urgent, id: 'X-21', persona: 'DOMENIC', p: SPEC_1, op: 'specialist sees the urgent referral', expect: 'missing photo ID still reported; urgent review pending', req: ['WA-REQ-006'], find: ['WA-R1-16'], mx: ['WA-T016'], view: (s) => specialistView(s, SPEC_1), check: (v) => assert.deepEqual([v?.referrals[0]?.missing, v?.referrals[0]?.urgentReview], [['GOVERNMENT_PHOTO_ID'], 'PENDING']) });
    see(w, { ...x, fixture: FX.urgent, id: 'X-22', persona: 'UNION_REP', p: REP_A, op: 'union sees the same referral', expect: 'urgent review pending; the packet is NOT shown as complete', req: ['WA-REQ-006'], find: ['WA-R1-16'], view: (s) => unionView(s, REP_A, REF_ID), check: (v) => {
      assert.equal(v?.urgentReviewPending, true);
      assert.equal(v?.outstanding.length, 1);
    } });
    w = must(referralEvent(w, SPEC_1, REF_ID, { type: 'RETURN_FOR_CORRECTION', reason: 'scan unreadable' }));
    w = act(w, { ...x, fixture: FX.urgent, id: 'X-23', persona: 'UNION_REP', p: REP_A, op: 'union withdraws while the urgent review is pending', expect: 'URGENT_REVIEW_PENDING', req: ['WA-REQ-007'], find: ['WA-R1-16'], mx: ['WA-ADV-16'], run: (s) => referralEvent(s, REP_A, REF_ID, { type: 'WITHDRAW' }) });
    w = act(w, { ...x, fixture: FX.urgent, id: 'X-24', persona: 'DOMENIC', p: SPEC_1, op: 'specialist declines without disposing of the urgent review', expect: 'URGENT_REVIEW_PENDING', req: ['WA-REQ-007'], find: ['WA-R1-16'], mx: ['WA-ADV-16'], run: (s) => referralEvent(s, SPEC_1, REF_ID, { type: 'DECLINE', reason: 'outside scope' }) });
    // acceptance is separate
    let w2 = offered(withMember(world0()));
    w2 = must(assignSpecialist(w2, PRINCIPAL_1, { matterId: MATTER, userId: SPEC_1.userId }));
    w2 = must(grantMatterAccess(w2, ADMIN_A, { grantId: asMatterGrantId('FAKE-MG-1'), matterId: MATTER, userId: SPEC_1.userId, sourceAuthorizationId: null, permissions: ['VIEW', 'VIEW_DOCUMENTS'] }));
    w2 = must(recordAuthorization(w2, SPEC_1, { authorizationId: asAuthorizationId('FAKE-AUTH-DOA'), matterId: MATTER, type: 'WSIB_DOA' }));
    w2 = act(w2, { ...x, id: 'X-25', persona: 'DOMENIC', p: SPEC_1, op: 'publish "representation accepted" with a grant and a DOA but no acceptance', expect: 'FORBIDDEN', req: ['WA-REQ-010', 'WA-REQ-063'], find: ['WA-R1-05', 'WA-R3-007'], mx: ['WA-T083'], run: (s) => publishStatus(s, SPEC_1, { matterId: MATTER, stage: 'REPRESENTATION_ACCEPTED', text: 'WorkAid has agreed to act for you.', evidence: { kind: 'MATTER_ACCEPTANCE' } }) });
    see(w2, { ...x, id: 'X-26', persona: 'UNION_REP', p: REP_A, op: 'union view before acceptance', expect: 'OFFERED, not ACCEPTED', req: ['WA-REQ-008'], view: (s) => unionView(s, REP_A, REF_ID), check: (v) => assert.equal(v?.referralState, 'OFFERED') });
    see(w2, { ...x, id: 'X-27', persona: 'MEMBER', p: MEMBER_P, op: 'member view before acceptance', expect: 'no update', req: ['WA-REQ-063'], view: (s) => memberView(s, MEMBER_P), check: (v) => assert.equal(v?.status.state, 'NO_UPDATE_PUBLISHED') });
  });

  it('[WA-J-X] unconfirmed receipt, conflicting Clio and Union Eyes tasks, and an unknown filing deadline: nothing is inferred and nothing is written back', () => {
    let w = withAngeloAccess(stageSent({ taskOfRecord: 'UNION_EYES', dueRule: { kind: 'NEXT_BUSINESS_DAY', calendar: { timeZone: 'America/Toronto', holidays: [] } } }));
    see(w, { ...x, id: 'X-28', persona: 'ANGELO', p: PRINCIPAL_1, op: 'supervisor lists dispatched-but-unconfirmed submissions', expect: 'the ITO is listed; filing is undetermined', req: ['WA-REQ-032'], find: ['WA-R1-04'], mx: ['WA-T040', 'WA-ADV-09'], view: (s) => supervisorView(s, PRINCIPAL_1), check: (v) => assert.deepEqual(v?.receiptUnconfirmed, [SUB_ITO]) });
    w = act(w, { ...x, id: 'X-29', persona: 'DOMENIC', p: SPEC_1, op: 'publish "receipt confirmed" while receipt is unconfirmed', expect: 'EVIDENCE_DOES_NOT_SUPPORT_STAGE', req: ['WA-REQ-063'], find: ['WA-R1-04', 'WA-R1-14'], mx: ['WA-ADV-09'], run: (s) => publishStatus(s, SPEC_1, { matterId: MATTER, stage: 'WSIB_RECEIPT_CONFIRMED', text: 'WSIB has received your documents.', evidence: { kind: 'SUBMISSION', submissionId: SUB_ITO } }) });
    const key = `receipt-followup:${SUB_ITO}:v1`;
    const tasksBefore = JSON.stringify(w.tasks);
    const beforeViews = views(w);
    w = clioReport(w, { submissionKey: key, status: 'SNOOZED_WITH_REASON' });
    decide({ ...x, id: 'X-30', persona: 'SYSTEM', p: null, op: 'Clio reports a snoozed task while the Union Eyes task is open', expect: 'ALLOW', req: ['WA-REQ-071'], find: ['WA-R1-10', 'WA-R4-10'], mx: ['WA-T056', 'WA-ADV-15'], run: () => ({ allow: w.reconciliation.length === 1 && JSON.stringify(w.tasks) === tasksBefore }) });
    w = clioReport(w, { submissionKey: key, status: 'RECEIPT_CONFIRMED' });
    decide({ ...x, id: 'X-31', persona: 'SYSTEM', p: null, op: 'Clio reports "receipt confirmed"; Union Eyes has no receipt record', expect: 'ALLOW', req: ['WA-REQ-071'], find: ['WA-R1-10'], mx: ['WA-ADV-15'], run: () => ({ allow: /not WSIB receipt evidence/.test(w.reconciliation.at(-1)?.reason ?? '') && w.submissions[0]?.receipt === null && w.submissions[0]?.state === 'DISPATCHED' }) });
    see(w, { ...x, id: 'X-32', persona: 'ANGELO', p: PRINCIPAL_1, op: 'who is told about the conflict', expect: 'supervisor and specialist see exceptions; union and member views unchanged', req: ['WA-REQ-071'], find: ['WA-R1-10'], view: (s) => ({ a: supervisorView(s, PRINCIPAL_1)?.reconciliationExceptions, d: specialistView(s, SPEC_1)?.reconciliationExceptions, v: views(s) }), check: (r) => {
      assert.deepEqual([r.a, r.d], [2, 2]);
      assert.equal(r.v.union, beforeViews.union);
      assert.equal(r.v.member, beforeViews.member);
    } });
    // an unknown deadline
    const obl: DeadlineObligation = { id: 'OBL-UNK', kind: 'WSIB_OBJECTION', claimId: CLAIM_X, decisionId: asDecisionId('A-D1'), issueIds: [asIssueId('A-D1-I1')], letterDate: '2026-09-15', receivedDate: null, issueKinds: ['TIME_LIMIT_EXCEPTION_WINDOW'], matterTimeZone: 'America/Toronto', confirmations: [], disposition: null };
    w = must(openObligation(w, SPEC_1, { matterId: MATTER, obligation: obl }));
    see(w, { ...x, id: 'X-33', persona: 'ANGELO', p: PRINCIPAL_1, op: 'every persona\'s view with a disputed filing deadline open', expect: 'supervisor lists it as uncertain; no persona shows any date or timer', req: ['WA-REQ-050'], find: ['WA-R1-01', 'WA-R2-03', 'WA-R5-09'], mx: ['WA-T028', 'WA-T030'], view: (s) => ({ sup: supervisorView(s, PRINCIPAL_1), all: Object.values(views(s)).join('|') }), check: (r) => {
      assert.deepEqual(r.sup?.uncertainDeadlines.map((d) => d.status), ['UNCONFIRMED_PROFESSIONAL_REVIEW_REQUIRED']);
      assert.equal(/\b(deadline|due by|time limit|expires)\b/i.test(r.all.replace(/dueDate|dueDateState|uncertainDeadlines/g, '')), false);
    } });
    w = act(w, { ...x, id: 'X-34a', persona: 'DOMENIC', p: SPEC_1, op: 'determine a valid filing when receipt has not been documented', expect: 'RECEIPT_NOT_DOCUMENTED', req: ['WA-REQ-100'], find: ['WA-C-001'], mx: ['WA-T105', 'WA-T103'], run: (s) => determineFiling(s, SPEC_1, { submissionId: SUB_ITO, sourceId: 'SYNTH-REQ-ITO', attestations: [{ code: 'SYNTH-EL-SIGNED', evidenceRef: 'D#1' }, { code: 'SYNTH-EL-ISSUES', evidenceRef: 'D#2' }], reasoning: 'Reviewed against the synthetic requirement source element by element.' }) });
    w = must(submissionEvent(w, SPEC_1, SUB_ITO, { type: 'CONFIRM_RECEIPT', method: 'PHONE_CALL', contactRef: 'FAKE WSIB CLERK', receivedAt: '2026-10-24T14:00:00Z' }));
    w = act(w, { ...x, id: 'X-34', persona: 'DOMENIC', p: SPEC_1, op: 'determine a valid filing with no reviewed requirement source for the form', expect: 'REQUIREMENT_SOURCE_UNKNOWN', req: ['WA-REQ-100'], find: ['WA-C-001'], mx: ['WA-T105'], run: (s) => determineFiling(s, SPEC_1, { submissionId: SUB_ITO, sourceId: 'NOT-IN-REGISTRY', attestations: [], reasoning: 'Reviewed against the synthetic requirement source element by element.' }) });
  });

  it('[WA-J-X] reassigned responsibility: the old owner loses the task and access, reminders move with the task, and nothing is delivered to the wrong person', () => {
    const rule = { kind: 'NEXT_BUSINESS_DAY' as const, calendar: { timeZone: 'America/Toronto', holidays: [] } };
    let w = withAngeloAccess(stageSent({ taskOfRecord: 'UNION_EYES', dueRule: rule }));
    w = must(assignSpecialist(w, PRINCIPAL_1, { matterId: MATTER, userId: SPEC_2.userId }));
    w = act(w, { ...x, id: 'X-35', persona: 'ANGELO', p: PRINCIPAL_1, op: 'principal reassigns responsibility from Domenic to a second specialist', expect: 'OK', audit: 'REMINDER_SCHEDULED', req: ['WA-REQ-045'], find: ['WA-R4-06', 'WA-R1-13'], mx: ['WA-T048', 'WA-ADV-11'], run: (s) => reassignResponsibility(s, PRINCIPAL_1, { matterId: MATTER, from: SPEC_1.userId, to: SPEC_2.userId }) });
    see(w, { ...x, id: 'X-36', persona: 'DOMENIC', p: SPEC_1, op: 'former specialist reads their queue', expect: 'empty: task and access moved', req: ['WA-REQ-045'], find: ['WA-R1-13'], mx: ['WA-T100'], view: (s) => specialistView(s, SPEC_1), check: (v) => assert.deepEqual(v?.tasks, []) });
    see(w, { ...x, id: 'X-37', persona: 'DOMENIC', p: SPEC_2, op: 'successor reads their queue before the union has granted matter access', expect: 'empty: assignment alone shows nothing without a live grant', req: ['WA-REQ-045'], find: ['WA-R4-09'], view: (s) => specialistView(s, SPEC_2), check: (v) => assert.deepEqual(v?.tasks ?? [], []) });
    const due = runReminderWorker(tick(w, '2026-10-26T14:00:00Z'), 'w1');
    decide({ ...x, id: 'X-38', persona: 'SYSTEM', p: null, op: 'reminder worker runs at the due time with the successor not yet granted access', expect: 'ALLOW', req: ['WA-REQ-044'], find: ['WA-R4-06'], mx: ['WA-ADV-11'], run: () => ({ allow: due.outbox.length === 0 && due.outbox.every((o) => o.to !== SPEC_1.userId) }) });
    let w3 = must(grantMatterAccess(w, ADMIN_A, { grantId: asMatterGrantId('FAKE-MG-2'), matterId: MATTER, userId: SPEC_2.userId, sourceAuthorizationId: null, permissions: ['VIEW', 'VIEW_DOCUMENTS'] }));
    const due2 = runReminderWorker(tick(w3, '2026-10-26T14:00:00Z'), 'w1');
    decide({ ...x, id: 'X-39', persona: 'SYSTEM', p: null, op: 'reminder worker runs after the union grants the successor access', expect: 'ALLOW', req: ['WA-REQ-044'], find: ['WA-R4-06'], mx: ['WA-T048', 'WA-ADV-10'], run: () => ({ allow: due2.outbox.length === 1 && due2.outbox[0]!.to === SPEC_2.userId && runReminderWorker(due2, 'w2').outbox.length === 1 }) });
    w3 = due2;
    see(w3, { ...x, id: 'X-40', persona: 'MEMBER', p: MEMBER_P, op: 'member and union views through the reassignment', expect: 'unchanged', req: ['WA-REQ-063'], view: (s) => views(s), check: (v) => assert.equal(v.member, views(stageSent({ taskOfRecord: 'UNION_EYES', dueRule: rule })).member) });
  });

  it('[WA-J-X] withheld medical evidence stays withheld across every persona, notification and release path', () => {
    let w = withAngeloAccess(withDoc(stageMatter(), 'FAKE-DOC-MED', 'MEDICAL', 'SYNTH-CANARY psychiatric assessment.pdf'));
    w = act(w, { ...x, id: 'X-41', persona: 'DOMENIC', p: SPEC_1, op: 'professional notes the document must remain restricted', expect: 'OK', audit: 'DOCUMENT_HOLD_PLACED', req: ['WA-REQ-062'], find: ['WA-R1-03'], mx: ['WA-ADV-13'], run: (s) => placeHold(s, SPEC_1, asDocumentId('FAKE-DOC-MED'), 'must remain restricted') });
    for (const [id, who, p] of [['X-42', 'UNION_REP', REP_A], ['X-43', 'MEMBER', MEMBER_P]] as const) {
      decide({ ...x, id, persona: who, p, op: `${who} opens the held medical document`, expect: 'NOT_FOUND', req: ['WA-REQ-061'], find: ['WA-R1-03'], mx: ['WA-T019'], run: () => readDocument(w, p, asDocumentId('FAKE-DOC-MED')) });
    }
    w = act(w, { ...x, id: 'X-44', persona: 'DOMENIC', p: SPEC_1, op: 'release the held medical document to the member', expect: 'FORBIDDEN', req: ['WA-REQ-062'], find: ['WA-R1-03'], mx: ['WA-ADV-13'], run: (s) => releaseDocument(s, SPEC_1, { documentId: asDocumentId('FAKE-DOC-MED'), audience: { kind: 'MEMBER', memberId: MEMBER_P.subjectMemberId! }, grantId: 'G', actions: ['VIEW'] }) });
    const n = buildNotification({ kind: 'DOCUMENT_UPDATED', opaqueMatterRef: 'm_1', document: w.documents.find((d) => d.id === asDocumentId('FAKE-DOC-MED')), approvedPreview: { text: 'A new psychiatric assessment was added.', approvedBy: SPEC_1.userId } });
    decide({ ...x, id: 'X-45', persona: 'SYSTEM', p: null, op: 'the update notification for the held document', expect: 'ALLOW', req: ['WA-REQ-064'], find: ['WA-R1-22', 'WA-R3-010'], mx: ['WA-T053', 'WA-T091'], run: () => ({ allow: !/SYNTH-CANARY|psychiatric/.test(JSON.stringify(n)) }) });
    see(w, { ...x, id: 'X-46', persona: 'UNION_REP', p: REP_A, op: 'every non-professional view while the evidence is withheld', expect: 'no title, class or hold anywhere', req: ['WA-REQ-061'], find: ['WA-R1-03'], view: (s) => [views(s).union, views(s).member].join('|'), check: (j) => { for (const b of ['SYNTH-CANARY', 'psychiatric', 'MEDICAL', 'FAKE-DOC-MED']) assert.equal(j.includes(b), false, b); } });
  });

  it('[WA-J-X] a delayed ARO decision: waiting is visible, no date is invented, nothing reaches the member until a professional publishes', () => {
    let w = withAngeloAccess(stageSent());
    w = must(openWait(w, SPEC_1, { id: asDependencyId('DEP-ARO'), matterId: MATTER, claimId: CLAIM_X, kind: 'ARO_DECISION', waitingSince: '2026-10-24', expectedWindowDays: null }));
    const aged = tick(w, '2027-06-01T14:00:00Z');
    see(aged, { ...x, id: 'X-47', persona: 'DOMENIC', p: SPEC_1, op: 'specialist queue seven months into the ARO wait', expect: 'waiting, no expectation configured, not a legal deadline', req: ['WA-REQ-053'], find: ['WA-R4-08', 'WA-R5-10'], mx: ['WA-T031'], view: (s) => specialistView(s, SPEC_1), check: (v) => assert.deepEqual([v?.waits[0]?.status, v?.waits[0]?.legalDeadline], ['WAITING_NO_EXPECTATION_CONFIGURED', false]) });
    see(aged, { ...x, id: 'X-48', persona: 'ANGELO', p: PRINCIPAL_1, op: 'supervisor view during the wait', expect: 'no tribunal prompt and no obligation until a decision is recorded', req: ['WA-REQ-090'], find: ['WA-R2-07'], view: (s) => supervisorView(s, PRINCIPAL_1), check: (v) => assert.deepEqual([v?.tribunalPrompts, aged.obligations], [[], []]) });
    see(aged, { ...x, id: 'X-49', persona: 'MEMBER', p: MEMBER_P, op: 'member view during the wait', expect: 'no update published; no invented decision date', req: ['WA-REQ-063'], find: ['WA-R4-08', 'WA-R1-14'], mx: ['WA-T085'], view: (s) => memberView(s, MEMBER_P), check: (v) => assert.equal(v?.status.state, 'NO_UPDATE_PUBLISHED') });
    void [recordAroDecision, closeMatter, withdrawStatus, grant2, itoApproved, itoSent, accepted, withClaims, withObjection, requestInfo, uploadDocument, supplyInfo, PDF];
  });

  it('[WA-J-X] cross-tenant attempts on every surface fail without disclosure and are logged only on the attacker\'s own organization', () => {
    let w = withAngeloAccess(stageSent());
    w = withDoc(w, 'FAKE-DOC-CORR', 'WSIB_CORRESPONDENCE');
    w = must(registerMember(w, REP_B, { memberId: asMemberId('FAKE-MEMBER-B1'), displayName: 'FAKE Member Other', birthYear: 1975 }));
    const trailBefore = w.audit.length;
    const attempts: [string, () => ReturnType<typeof publishStatus>][] = [
      ['X-50', () => publishStatus(w, REP_B, { matterId: MATTER, stage: 'GENERAL_UPDATE', text: 'x', evidence: { kind: 'NONE' } })],
      ['X-51', () => requestInfo(w, REP_B, { requestId: 'R', matterId: MATTER, addressedTo: 'MEMBER', code: 'C' })],
      ['X-52', () => grantMatterAccess(w, ADMIN_B, { grantId: asMatterGrantId('G-B'), matterId: MATTER, userId: SPEC_2.userId, sourceAuthorizationId: null, permissions: ['VIEW'] })],
      ['X-53', () => revoke(w, ADMIN_B, { matterId: MATTER, authorizationId: asAuthorizationId('FAKE-AUTH-DOA') })],
      ['X-54', () => uploadDocument(w, REP_B, { documentId: asDocumentId('B1'), matterId: MATTER, filename: 'x.pdf', declaredMime: 'application/pdf', header: PDF, sizeBytes: 10 })],
      ['X-55', () => referralEvent(w, REP_B, REF_ID, { type: 'WITHDRAW' })],
      ['X-56', () => setWorkContext(w, REP_B, { matterId: MATTER, claimId: CLAIM_X, reason: 'a long enough reason to pass' })],
    ];
    for (const [id, run] of attempts) w = act(w, { ...x, id, persona: 'ADVERSARY', p: id === 'X-52' || id === 'X-53' ? ADMIN_B : REP_B, op: `union B attempt ${id}`, expect: 'NOT_FOUND', req: ['WA-REQ-013'], find: ['WA-R1-02', 'WA-R3-004'], mx: ['WA-T020', 'WA-ADV-01'], run });
    decide({ ...x, id: 'X-57', persona: 'ADVERSARY', p: REP_B, op: 'union B reads a document of union A', expect: 'NOT_FOUND', req: ['WA-REQ-013'], find: ['WA-R1-02'], mx: ['WA-T019'], run: () => readDocument(w, REP_B, asDocumentId('FAKE-DOC-CORR')) });
    see(w, { ...x, id: 'X-58', persona: 'ADVERSARY', p: REP_B, op: 'union B and a union B member request views of union A', expect: 'no views at all', req: ['WA-REQ-013'], find: ['WA-R1-02'], mx: ['WA-T020'], view: (s) => [unionView(s, REP_B, REF_ID), memberView(s, OTHER_MEMBER_P), specialistView(s, { ...REP_B })], check: (v) => assert.deepEqual(v, [null, null, null]) });
    assert.equal(w.audit.length, trailBefore, 'no refusal wrote into the target organization\'s audit trail');
    assert.deepEqual([...new Set(w.denied.map((d) => d.organizationId))], [ORG_B]);
    assert.equal(w.audit.every((e) => e.organizationId === ORG_A || e.organizationId === ORG_B), true);
    void [ORG_WA, ORG_A, SPEC_1, MEMBER_ID];
  });

  it('[WA-J-X] source of truth: every matter event is audited on the OWNING union\'s trail with the actor, never with content', () => {
    let w = withAngeloAccess(stageSent());
    w = must(publishStatus(w, SPEC_1, { matterId: MATTER, stage: 'DOCUMENTS_SENT_TO_WSIB', text: 'Your documents were sent to WSIB.', evidence: { kind: 'SUBMISSION', submissionId: SUB_ITO } }));
    const matterEvents = w.audit.filter((e) => e.matterId === MATTER);
    see(w, { ...x, id: 'X-59', persona: 'SYSTEM', p: null, op: 'audit trail of one matter worked by union, specialist, principal and system', expect: 'all events on union A\'s trail; actor recorded; details are short codes', req: ['WA-REQ-065'], find: ['WA-R1-08', 'WA-R3-014'], mx: ['WA-T066'], view: () => matterEvents, check: (evs) => {
      assert.ok(evs.length > 10);
      assert.equal(evs.every((e) => e.organizationId === ORG_A), true);
      assert.ok(new Set(evs.map((e) => e.actor)).size >= 3, 'multiple actors are recorded');
      const text = JSON.stringify(evs);
      for (const banned of ['FAKE Member One', 'FAKE-WSIB', 'Your documents were sent', 'SYNTH-CANARY']) assert.equal(text.includes(banned), false, banned);
    } });
    void [closeMatter, openObligation, withdrawStatus, ADMIN_A, accepted, offered, grantMatterAccess];
  });
});
