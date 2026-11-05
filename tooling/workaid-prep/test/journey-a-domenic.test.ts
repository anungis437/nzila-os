import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FX, MATTER, REF_ID, SUB_ITO, PDF, offered, accepted, itoApproved, stageMatter, stageSent, withClaims, withMember, withObjection, world0 } from './scenario.ts';
import { act, decide, must, see } from './trace.ts';
import { assignSpecialist, createOutbound, determineFiling, grantMatterAccess, outboundClaimReferences, proposeGroups, readDocument, recordWaitBatch, referralEvent, openWait, publishStatus, requestInfo, runReminderWorker, attestReadiness, submissionEvent, uploadDocument, classifyDocument, prepareObjection, createReferral, tick } from '../src/journey.ts';
import { specialistView } from '../src/journey-views.ts';
import { asDecisionId, asDependencyId, asDocumentId, asIssueId, asMatterGrantId, asObjectionId, asSubmissionId } from '../src/ids.ts';
import { CLAIM_X, CLAIM_Y, MEMBER_ID, ORG_WA, PRINCIPAL_1, REP_A, SPEC_1, SPEC_2, ADMIN_A, completePacket } from './helpers.ts';
import { filingView } from '../src/filing.ts';

const DOMENIC = 'DOMENIC' as const;
const base = { fixture: FX.matter001, persona: DOMENIC, p: SPEC_1 };

describe('Journey A — Domenic / WorkAid specialist', () => {
  it('[WA-J-A] referral intake: missing items, return, clarification, and no acceptance without the policy role', () => {
    let w = withMember(world0());
    // the union submits an incomplete packet without a valid exception; Domenic sees what is missing
    w = must(createReferral(w, REP_A, { referralId: REF_ID, memberId: MEMBER_ID, specialistOrganizationId: ORG_WA }));
    w = must(referralEvent(w, REP_A, REF_ID, { type: 'UPDATE_PACKET', packet: completePacket({ items: completePacket().items.filter((i) => i.code !== 'MEDICAL_AUTHORIZATION') }) }));
    w = act(w, { ...base, id: 'A-01', op: 'union offers an incomplete packet with no exception', p: REP_A, persona: 'UNION_REP', expect: 'PACKET_INCOMPLETE', req: ['WA-REQ-002', 'WA-REQ-006'], mx: ['WA-T003'], run: (x) => referralEvent(x, REP_A, REF_ID, { type: 'OFFER' }) });
    see(w, { ...base, id: 'A-02', op: 'specialist reads the referral queue', expect: 'missing item reported individually; nothing marked complete', req: ['WA-REQ-002'], mx: ['WA-T003'], view: (x) => specialistView(x, SPEC_1), check: (v) => {
      assert.deepEqual(v?.referrals.map((r) => r.missing), [['MEDICAL_AUTHORIZATION']]);
      assert.equal(v?.referrals[0]?.state, 'AWAITING_REQUIRED_ITEMS');
    } });
    w = must(referralEvent(w, REP_A, REF_ID, { type: 'UPDATE_PACKET', packet: completePacket() }));
    w = must(referralEvent(w, REP_A, REF_ID, { type: 'OFFER' }));
    w = act(w, { ...base, id: 'A-03', op: 'specialist requests clarification about claim history', expect: 'OK', audit: 'REFERRAL_REQUEST_CLARIFICATION', req: ['WA-REQ-007'], mx: ['WA-T012'], run: (x) => referralEvent(x, SPEC_1, REF_ID, { type: 'REQUEST_CLARIFICATION', question: 'Which employer is claim 2 with?' }) });
    w = must(referralEvent(w, REP_A, REF_ID, { type: 'ANSWER_CLARIFICATION' }));
    w = act(w, { ...base, id: 'A-04', op: 'specialist tries to accept representation (policy reserves it to the principal)', expect: 'FORBIDDEN_ACTOR', req: ['WA-REQ-008'], find: ['WA-R1-05'], run: (x) => referralEvent(x, SPEC_1, REF_ID, { type: 'ACCEPT' }) });
    assert.equal(w.matters.find((m) => m.id === MATTER)?.acceptance, null);
  });

  it('[WA-J-A] a technical grant and recorded instruments are not acceptance: no professional action before the principal accepts', () => {
    let w = offered(withMember(world0()));
    w = must(assignSpecialist(w, PRINCIPAL_1, { matterId: MATTER, userId: SPEC_1.userId }));
    w = must(grantMatterAccess(w, ADMIN_A, { grantId: asMatterGrantId('FAKE-MG-1'), matterId: MATTER, userId: SPEC_1.userId, sourceAuthorizationId: null, permissions: ['VIEW', 'VIEW_DOCUMENTS'] }));
    w = act(w, { ...base, id: 'A-05', op: 'create a WRF with a view grant but no professional acceptance', expect: 'FORBIDDEN', req: ['WA-REQ-010'], find: ['WA-R1-05', 'WA-R3-007'], mx: ['WA-T016', 'WA-T083'], run: (x) => createOutbound(x, SPEC_1, { submissionId: asSubmissionId('FAKE-SUB-WRF-1'), matterId: MATTER, kind: 'WRF', version: 1, claimId: CLAIM_X }) });
    assert.equal(w.submissions.length, 0);
  });

  it('[WA-J-A] multiple claims: objections attach to the right claim; historical other-employer numbers stay out of outbound references', () => {
    let w = withClaims(accepted(offered(withMember(world0()))));
    w = act(w, { ...base, id: 'A-06', op: 'prepare an objection on the wrong claim', expect: 'WRONG_CLAIM', req: ['WA-REQ-020'], find: ['WA-R1-06'], mx: ['WA-T008'], run: (x) => prepareObjection(x, SPEC_1, { matterId: MATTER, objectionId: asObjectionId('O-X'), requestId: 'R-X', claimId: CLAIM_Y, decisionId: asDecisionId('A-D1'), issueIds: [asIssueId('A-D1-I1')] }) });
    w = act(w, { ...base, id: 'A-07', op: 'prepare an objection on claim X decision A-D2 issue 1', expect: 'OK', audit: 'OBJECTION_PREPARED', req: ['WA-REQ-020', 'WA-REQ-022'], run: (x) => prepareObjection(x, SPEC_1, { matterId: MATTER, objectionId: asObjectionId('O-2'), requestId: 'R-2', claimId: CLAIM_X, decisionId: asDecisionId('A-D2'), issueIds: [asIssueId('A-D2-I1')] }) });
    w = act(w, { ...base, id: 'A-08', op: 'the same objection request replayed', expect: 'OK', req: ['WA-REQ-022'], find: ['WA-R4-05'], run: (x) => prepareObjection(x, SPEC_1, { matterId: MATTER, objectionId: asObjectionId('O-2-retry'), requestId: 'R-2', claimId: CLAIM_X, decisionId: asDecisionId('A-D2'), issueIds: [asIssueId('A-D2-I1')] }) });
    assert.equal(w.graph.objections.length, 1, 'replay did not create a second objection');
    see(w, { ...base, id: 'A-09', op: 'claim references allowed on an outbound ITO for claim X', expect: 'target claim only; employer-Y claim excluded', req: ['WA-REQ-024'], find: ['WA-R2-01', 'WA-R5-02'], mx: ['WA-T071'], view: (x) => outboundClaimReferences(x, CLAIM_X), check: (r) => {
      assert.equal(r.ok, true);
      assert.deepEqual(r.ok && r.value.included, ['FAKE-WSIB-000011']);
    } });
    see(w, { ...base, id: 'A-10', op: 'ITO grouping within a claim', expect: 'undecided: no default strategy is invented', req: ['WA-REQ-023'], find: ['WA-R2-02'], view: (x) => proposeGroups(x, x.policy.groupingStrategy), check: (r) => assert.equal(!r.ok && r.code, 'GROUPING_STRATEGY_UNDECIDED') });
  });

  it('[WA-J-A] dispatch to receipt: contextual task without retyping; no reminder through an invented default', () => {
    let w = itoApproved(withObjection(withClaims(accepted(offered(withMember(world0()))))));
    w = act(w, { ...base, id: 'A-11', op: 'attempt dispatch', expect: 'OK', audit: 'SUBMISSION_ATTEMPT_DISPATCH', req: ['WA-REQ-031'], run: (x) => submissionEvent(x, SPEC_1, SUB_ITO, { type: 'ATTEMPT_DISPATCH', requestId: 'REQ-1', method: 'FAX_RECORDED_MANUALLY' }) });
    assert.equal(w.tasks.length, 0, 'an attempt creates no follow-up');
    w = act(w, { ...base, id: 'A-12', op: 'confirm dispatch with a transmission reference', expect: 'OK', audit: 'RECEIPT_TASK_GENERATED', req: ['WA-REQ-031', 'WA-REQ-040'], mx: ['WA-T037', 'WA-T102'], run: (x) => submissionEvent(x, SPEC_1, SUB_ITO, { type: 'CONFIRM_DISPATCH', requestId: 'REQ-1', transmissionRef: 'FAKE-TX-0001' }) });
    see(w, { ...base, id: 'A-13', op: 'task context', expect: 'member label, claim number, form kind and version already on the task', req: ['WA-REQ-040'], mx: ['WA-T037'], view: (x) => specialistView(x, SPEC_1), check: (v) => {
      assert.equal(v?.tasks.length, 1);
      assert.deepEqual({ m: v?.tasks[0]?.memberLabel, c: v?.tasks[0]?.claimNumber, k: v?.tasks[0]?.submissionKind, n: v?.tasks[0]?.submissionVersion }, { m: 'FAKE Member One', c: 'FAKE-WSIB-000011', k: 'ITO', n: 1 });
      assert.equal(v?.tasks[0]?.authoritative, false, 'task-of-record is unresolved');
      assert.equal(v?.tasks[0]?.dueDate, null, 'no due-date rule is configured, so none is invented');
    } });
    const later = runReminderWorker(tick(w, '2030-01-01T14:00:00Z'), 'worker-1');
    assert.equal(later.outbox.length, 0, 'no reminder is delivered while task-of-record is unresolved');
    assert.equal(later.reminders.length, 0);
    decide({ ...base, id: 'A-14', op: 'reminders after years of waiting under UNRESOLVED task-of-record', expect: 'ALLOW', req: ['WA-REQ-041'], find: ['WA-R1-10'], run: () => ({ allow: later.outbox.length === 0 && later.reminders.length === 0 }) });
  });

  it('[WA-J-A] receipt is confirmed by a human with evidence; it does not become a valid filing', () => {
    let w = stageSent();
    w = act(w, { ...base, id: 'A-15', op: 'confirm receipt with a provider-style method', expect: 'INVALID_RECEIPT_METHOD', req: ['WA-REQ-032'], find: ['WA-R1-04'], mx: ['WA-T040'], run: (x) => submissionEvent(x, SPEC_1, SUB_ITO, { type: 'CONFIRM_RECEIPT', method: 'EMAIL_PROVIDER_200', contactRef: 'x', receivedAt: '2026-10-24T14:00:00Z' }) });
    w = act(w, { ...base, id: 'A-16', op: 'confirm receipt by phone with a named contact', expect: 'OK', audit: 'RECEIPT_TASK_COMPLETED', req: ['WA-REQ-032', 'WA-REQ-043'], mx: ['WA-T041'], run: (x) => submissionEvent(x, SPEC_1, SUB_ITO, { type: 'CONFIRM_RECEIPT', method: 'PHONE_CALL', contactRef: 'FAKE WSIB CLERK', receivedAt: '2026-10-24T14:00:00Z' }) });
    see(w, { ...base, id: 'A-17', op: 'filing status after receipt', expect: 'UNDETERMINED, receipt documented, timeliness not asserted', req: ['WA-REQ-100'], find: ['WA-C-001'], mx: ['WA-T103'], view: (x) => filingView(x.submissions[0]!, x.filings[0]!), check: (v) => {
      assert.equal(v.status, 'UNDETERMINED');
      assert.equal(v.receiptDocumented, true);
      assert.equal(v.timeliness, 'NOT_ASSERTED');
    } });
    w = act(w, { ...base, id: 'A-18', op: 'determine the filing valid with one element unattested', expect: 'INCOMPLETE_ATTESTATIONS', req: ['WA-REQ-100'], find: ['WA-C-001'], mx: ['WA-T105'], run: (x) => determineFiling(x, SPEC_1, { submissionId: SUB_ITO, sourceId: 'SYNTH-REQ-ITO', attestations: [{ code: 'SYNTH-EL-SIGNED', evidenceRef: 'FAKE-DOC#1' }], reasoning: 'Reviewed against the synthetic requirement source element by element.' }) });
    w = act(w, { ...base, id: 'A-19', op: 'determine the filing valid with every element attested and evidenced', expect: 'OK', audit: 'FILING_DETERMINED_VALID', req: ['WA-REQ-100'], find: ['WA-C-001'], mx: ['WA-T107'], run: (x) => determineFiling(x, SPEC_1, { submissionId: SUB_ITO, sourceId: 'SYNTH-REQ-ITO', attestations: [{ code: 'SYNTH-EL-SIGNED', evidenceRef: 'FAKE-DOC#1' }, { code: 'SYNTH-EL-ISSUES', evidenceRef: 'FAKE-DOC#2' }], reasoning: 'Reviewed against the synthetic requirement source element by element.' }) });
    assert.equal(filingView(w.submissions[0]!, w.filings[0]!).status, 'PROFESSIONALLY_DETERMINED_VALID');
  });

  it('[WA-J-A] evidence gathering, ARF, and waiting for the ARO without invented dates or milestones', () => {
    let w = stageSent();
    w = must(submissionEvent(w, SPEC_1, SUB_ITO, { type: 'CONFIRM_RECEIPT', method: 'PHONE_CALL', contactRef: 'FAKE WSIB CLERK', receivedAt: '2026-10-24T14:00:00Z' }));
    w = act(w, { ...base, id: 'A-20', op: 'request a medical report from the member', expect: 'OK', audit: 'INFO_REQUESTED', req: ['WA-REQ-053'], run: (x) => requestInfo(x, SPEC_1, { requestId: 'REQ-INFO-1', matterId: MATTER, addressedTo: 'MEMBER', code: 'MEDICAL_REPORT' }) });
    w = act(w, { ...base, id: 'A-21', op: 'start waiting for the claim file with the partner-reported 4-6 week expectation', expect: 'OK', audit: 'DEPENDENCY_OPENED', req: ['WA-REQ-053'], find: ['WA-R2-09'], mx: ['WA-T031'], run: (x) => openWait(x, SPEC_1, { id: asDependencyId('DEP-FILE'), matterId: MATTER, claimId: CLAIM_X, kind: 'WSIB_CLAIM_FILE', waitingSince: '2026-10-24', expectedWindowDays: { min: 28, max: 42 } }) });
    const aged = tick(w, '2026-12-15T14:00:00Z');
    see(aged, { ...base, id: 'A-22', op: 'queue after the expected window passes', expect: 'past expected window and never a legal deadline', req: ['WA-REQ-053'], find: ['WA-R2-09', 'WA-R5-10'], mx: ['WA-T031'], view: (x) => specialistView(x, SPEC_1), check: (v) => {
      assert.equal(v?.waits[0]?.status, 'WAITING_PAST_EXPECTED_WINDOW');
      assert.equal(v?.waits[0]?.legalDeadline, false);
    } });
    w = must(recordWaitBatch(aged, SPEC_1, { id: asDependencyId('DEP-FILE'), receivedOn: '2026-12-15', pageCount: 120, missingPagesNote: 'pages 44-51 missing' }));
    // a second claim decision needs its own objection and an ARF
    w = must(prepareObjection(w, SPEC_1, { matterId: MATTER, objectionId: asObjectionId('FAKE-OBJ-2'), requestId: 'REQ-O2', claimId: CLAIM_X, decisionId: asDecisionId('A-D2'), issueIds: [asIssueId('A-D2-I1')] }));
    const ARF = asSubmissionId('FAKE-SUB-ARF-1');
    w = must(createOutbound(w, SPEC_1, { submissionId: ARF, matterId: MATTER, kind: 'ARF', version: 1, claimId: CLAIM_X, decisionId: asDecisionId('A-D2'), objectionId: asObjectionId('FAKE-OBJ-2') }));
    w = must(submissionEvent(w, SPEC_1, ARF, { type: 'REVIEW' }));
    w = act(w, { ...base, id: 'A-23', op: 'approve an ARF before readiness is attested', expect: 'GATE_NOT_SATISFIED', req: ['WA-REQ-033'], find: ['WA-R2-06'], mx: ['WA-T078'], run: (x) => submissionEvent(x, SPEC_1, ARF, { type: 'APPROVE', claimedApprover: SPEC_1.userId }) });
    w = must(attestReadiness(w, SPEC_1, { submissionId: ARF, gate: 'arfReady' }));
    w = act(w, { ...base, id: 'A-24', op: 'approve the ARF after attested readiness', expect: 'OK', audit: 'SUBMISSION_APPROVE', req: ['WA-REQ-033'], mx: ['WA-T078'], run: (x) => submissionEvent(x, SPEC_1, ARF, { type: 'APPROVE', claimedApprover: SPEC_1.userId }) });
    w = must(submissionEvent(w, SPEC_1, ARF, { type: 'ATTEMPT_DISPATCH', requestId: 'REQ-ARF', method: 'FAX_RECORDED_MANUALLY' }));
    w = act(w, { ...base, id: 'A-25', op: 'publish "appeal sent" from an ARF only attempted, not confirmed sent', expect: 'EVIDENCE_DOES_NOT_SUPPORT_STAGE', req: ['WA-REQ-063'], find: ['WA-R1-14'], mx: ['WA-T085'], run: (x) => publishStatus(x, SPEC_1, { matterId: MATTER, stage: 'APPEAL_SENT_TO_WSIB', text: 'Your appeal was sent to WSIB.', evidence: { kind: 'SUBMISSION', submissionId: ARF } }) });
    w = must(submissionEvent(w, SPEC_1, ARF, { type: 'CONFIRM_DISPATCH', requestId: 'REQ-ARF', transmissionRef: 'FAKE-TX-ARF' }));
    w = act(w, { ...base, id: 'A-26', op: 'publish "appeal sent" once dispatch is confirmed', expect: 'OK', audit: 'STATUS_PUBLISHED', req: ['WA-REQ-063'], find: ['WA-R1-14'], run: (x) => publishStatus(x, SPEC_1, { matterId: MATTER, stage: 'APPEAL_SENT_TO_WSIB', text: 'Your appeal was sent to WSIB.', evidence: { kind: 'SUBMISSION', submissionId: ARF } }) });
    w = act(w, { ...base, id: 'A-27', op: 'wait for the ARO decision', expect: 'OK', audit: 'DEPENDENCY_OPENED', req: ['WA-REQ-053'], find: ['WA-R4-08'], run: (x) => openWait(x, SPEC_1, { id: asDependencyId('DEP-ARO'), matterId: MATTER, claimId: CLAIM_X, kind: 'ARO_DECISION', waitingSince: '2026-12-16', expectedWindowDays: null }) });
    see(w, { ...base, id: 'A-28', op: 'queue while waiting for the ARO', expect: 'no expectation configured, no date invented, no obligation created', req: ['WA-REQ-053'], find: ['WA-R4-08'], view: (x) => specialistView(x, SPEC_1), check: (v) => {
      assert.equal(v?.waits.find((d) => d.kind === 'ARO_DECISION')?.status, 'WAITING_NO_EXPECTATION_CONFIGURED');
      assert.equal(w.obligations.length, 0);
    } });
  });

  it('[WA-J-A] a configured task-of-record produces a reminder only when due, to the synthetic sink, with generic text; Clio as record produces none', () => {
    const cal = { timeZone: 'America/Toronto', holidays: [] };
    const sent = stageSent({ taskOfRecord: 'UNION_EYES', dueRule: { kind: 'NEXT_BUSINESS_DAY', calendar: cal } });
    assert.equal(sent.tasks[0]?.authoritative, true);
    assert.equal(sent.reminders.length, 1);
    const early = runReminderWorker(tick(sent, '2026-10-23T18:00:00Z'), 'w1');
    decide({ ...base, id: 'A-29', op: 'worker runs before the due time', expect: 'ALLOW', req: ['WA-REQ-044'], mx: ['WA-T038'], run: () => ({ allow: early.outbox.length === 0 }) });
    const due = runReminderWorker(tick(sent, '2026-10-26T14:00:00Z'), 'w1');
    const again = runReminderWorker(due, 'w2');
    decide({ ...base, id: 'A-30', op: 'worker runs at 09:00 local on the due date, then a second worker runs', expect: 'ALLOW', req: ['WA-REQ-044'], find: ['WA-R1-07'], mx: ['WA-T038', 'WA-ADV-10'], run: () => ({ allow: due.outbox.length === 1 && again.outbox.length === 1 && due.outbox[0]!.sent === false && !JSON.stringify(due.outbox[0]).includes('FAKE Member One') }) });
    const clio = stageSent({ taskOfRecord: 'CLIO' });
    decide({ ...base, id: 'A-31', op: 'Clio is the task-of-record', expect: 'ALLOW', req: ['WA-REQ-041'], find: ['WA-R1-10'], mx: ['WA-T056'], run: () => ({ allow: clio.tasks.length === 0 && clio.reminders.length === 0 }) });
  });

  it('[WA-J-A] the specialist cannot reach what is not theirs', () => {
    const w = stageMatter();
    const other = asDocumentId('FAKE-DOC-X');
    let cur = must(uploadDocument(w, REP_A, { documentId: other, matterId: MATTER, filename: 'denial.pdf', declaredMime: 'application/pdf', header: PDF, sizeBytes: 3000 }));
    cur = must(classifyDocument(cur, SPEC_1, { documentId: other, dataClass: 'WSIB_CORRESPONDENCE' }));
    see(cur, { ...base, id: 'A-32', op: 'unassigned specialist reads the queue', p: SPEC_2, expect: 'nothing: not assigned and no grant', req: ['WA-REQ-013'], find: ['WA-R1-02', 'WA-R3-004'], mx: ['WA-T089'], view: (x) => specialistView(x, SPEC_2), check: (v) => {
      assert.deepEqual(v?.tasks, []);
      assert.deepEqual(v?.infoRequests, []);
    } });
    const granted = { ...cur, disclosureGrants: [...cur.disclosureGrants, { id: 'FAKE-DG-SPEC-A33' as never, documentId: other, audience: { kind: 'SPECIALIST' as const, userId: SPEC_1.userId }, actions: ['VIEW' as const], approvedBy: ADMIN_A.userId, status: 'ACTIVE' as const, expiresAt: null, revokedAt: null, matterGrantId: null }] };
    decide({ ...base, id: 'A-33a', op: 'control: the assigned specialist with a live document grant opens the same document', expect: 'ALLOW', req: ['WA-REQ-013'], find: ['WA-R1-02'], run: () => readDocument(granted, SPEC_1, other) });
    decide({ ...base, id: 'A-33', op: 'unassigned specialist opens a document', p: SPEC_2, expect: 'NOT_FOUND', req: ['WA-REQ-013'], find: ['WA-R1-02'], run: () => readDocument(granted, SPEC_2, other) });
    cur = act(cur, { ...base, id: 'A-34', op: 'unassigned specialist classifies a document', p: SPEC_2, expect: 'NOT_FOUND', req: ['WA-REQ-013'], run: (x) => classifyDocument(x, SPEC_2, { documentId: other, dataClass: 'MEDICAL' }) });
    void PRINCIPAL_1;
  });
});
