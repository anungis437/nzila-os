import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FX, MATTER, REF_ID, offered, stageMatter, withAngeloAccess, withDoc, withMember, world0, itoApproved, itoSent } from './scenario.ts';
import { act, decide, must, see } from './trace.ts';
import { assessTribunal, closeMatter, createOutbound, liftHold, openObligation, openWait, placeHold, readDocument, recordAroDecision, reassignResponsibility, reassignTaskOwner, referralEvent, releaseDocument, confirmObligation, assignSpecialist, grantMatterAccess, recordAuthorization, submissionEvent, attestReadiness, tick } from '../src/journey.ts';
import { supervisorView } from '../src/journey-views.ts';
import { asAuthorizationId, asDecisionId, asDependencyId, asDocumentId, asIssueId, asMatterGrantId, asSubmissionId } from '../src/ids.ts';
import type { DeadlineObligation } from '../src/deadlines.ts';
import { ADMIN_A, CLAIM_X, MEMBER_P, PRINCIPAL_1, REP_A, SPEC_1, SPEC_2 } from './helpers.ts';

const base = { fixture: FX.matter001, persona: 'ANGELO' as const, p: PRINCIPAL_1 };
const MIXED: DeadlineObligation = {
  id: 'OBL-MIXED',
  kind: 'WSIB_OBJECTION',
  claimId: CLAIM_X,
  decisionId: asDecisionId('A-D1'),
  issueIds: [asIssueId('A-D1-I1')],
  letterDate: '2026-09-15',
  receivedDate: '2026-09-18',
  issueKinds: ['RETURN_TO_WORK', 'EARNINGS'],
  matterTimeZone: 'America/Toronto',
  confirmations: [],
  disposition: null,
};
const REASONING = 'Read the decision letter against the reviewed synthetic rule source and the member file.';

describe('Journey B — Angelo / professional supervisor', () => {
  it('[WA-J-B] supervision of acceptance: only the policy role accepts; the referral queue is visible to the principal alone', () => {
    let w = offered(withMember(world0()));
    w = must(assignSpecialist(w, PRINCIPAL_1, { matterId: MATTER, userId: SPEC_1.userId }));
    w = must(grantMatterAccess(w, ADMIN_A, { grantId: asMatterGrantId('FAKE-MG-1'), matterId: MATTER, userId: SPEC_1.userId, sourceAuthorizationId: null, permissions: ['VIEW', 'VIEW_DOCUMENTS'] }));
    w = must(recordAuthorization(w, SPEC_1, { authorizationId: asAuthorizationId('FAKE-AUTH-DOA'), matterId: MATTER, type: 'WSIB_DOA' }));
    see(w, { ...base, id: 'B-01', op: 'principal reads the supervision view', expect: 'offered referral awaits acceptance', req: ['WA-REQ-008'], view: (x) => supervisorView(x, PRINCIPAL_1), check: (v) => assert.deepEqual(v?.pendingAcceptance, [REF_ID]) });
    see(w, { ...base, id: 'B-02', op: 'a specialist asks for the supervision view', p: SPEC_1, persona: 'DOMENIC', expect: 'no view', req: ['WA-REQ-008'], view: (x) => supervisorView(x, SPEC_1), check: (v) => assert.equal(v, null) });
    w = act(w, { ...base, id: 'B-03', op: 'specialist accepts representation', p: SPEC_1, persona: 'DOMENIC', expect: 'FORBIDDEN_ACTOR', req: ['WA-REQ-008'], find: ['WA-R1-05'], run: (x) => referralEvent(x, SPEC_1, REF_ID, { type: 'ACCEPT' }) });
    w = act(w, { ...base, id: 'B-04', op: 'principal accepts representation', expect: 'OK', audit: 'REFERRAL_ACCEPT', req: ['WA-REQ-008', 'WA-REQ-010'], find: ['WA-R1-05'], mx: ['WA-T013'], run: (x) => referralEvent(x, PRINCIPAL_1, REF_ID, { type: 'ACCEPT' }) });
    assert.equal(w.matters.find((m) => m.id === MATTER)?.acceptance?.acceptedBy, PRINCIPAL_1.userId);
  });

  it('[WA-J-B] holds and release: lifting a hold is the principal\'s; supervision does not bypass document access', () => {
    let w = withDoc(stageMatter(), 'FAKE-DOC-HELD', 'WSIB_CORRESPONDENCE');
    w = act(w, { ...base, id: 'B-05', op: 'specialist places a restriction hold', p: SPEC_1, persona: 'DOMENIC', expect: 'OK', audit: 'DOCUMENT_HOLD_PLACED', req: ['WA-REQ-062'], find: ['WA-R1-03'], run: (x) => placeHold(x, SPEC_1, asDocumentId('FAKE-DOC-HELD'), 'must remain restricted') });
    w = act(w, { ...base, id: 'B-06', op: 'specialist tries to lift the hold', p: SPEC_1, persona: 'DOMENIC', expect: 'NOT_AUTHORIZED', req: ['WA-REQ-062'], find: ['WA-R1-03'], run: (x) => liftHold(x, SPEC_1, asDocumentId('FAKE-DOC-HELD'), 'reviewed and releasing it now') });
    see(w, { ...base, id: 'B-07', op: 'principal sees the held document in the supervision view', expect: 'listed by id only', req: ['WA-REQ-062'], view: (x) => supervisorView(x, PRINCIPAL_1), check: (v) => {
      assert.deepEqual(v?.heldDocuments, [asDocumentId('FAKE-DOC-HELD')]);
      assert.equal(JSON.stringify(v).includes('letter.pdf'), false);
    } });
    w = act(w, { ...base, id: 'B-08', op: 'principal lifts the hold with a reason', expect: 'OK', audit: 'DOCUMENT_HOLD_LIFTED', req: ['WA-REQ-062'], find: ['WA-R1-03'], mx: ['WA-ADV-13'], run: (x) => liftHold(x, PRINCIPAL_1, asDocumentId('FAKE-DOC-HELD'), 'Reviewed with the member and counsel; release approved.') });
    w = act(w, { ...base, id: 'B-09', op: 'principal releases without being assigned or granted access', expect: 'NOT_FOUND', req: ['WA-REQ-061'], find: ['WA-R1-03'], run: (x) => releaseDocument(x, PRINCIPAL_1, { documentId: asDocumentId('FAKE-DOC-HELD'), audience: { kind: 'MEMBER', memberId: MEMBER_P.subjectMemberId! }, grantId: 'G-1', actions: ['VIEW'] }) });
    w = withAngeloAccess(w);
    w = act(w, { ...base, id: 'B-10', op: 'principal releases the correspondence to the member once granted access', expect: 'OK', audit: 'DOCUMENT_RELEASED', req: ['WA-REQ-061'], find: ['WA-R1-03'], run: (x) => releaseDocument(x, PRINCIPAL_1, { documentId: asDocumentId('FAKE-DOC-HELD'), audience: { kind: 'MEMBER', memberId: MEMBER_P.subjectMemberId! }, grantId: 'G-1', actions: ['VIEW'] }) });
    decide({ ...base, id: 'B-11', op: 'member opens the released correspondence', p: MEMBER_P, persona: 'MEMBER', expect: 'ALLOW', req: ['WA-REQ-061'], run: () => readDocument(w, MEMBER_P, asDocumentId('FAKE-DOC-HELD')) });
    const med = withDoc(w, 'FAKE-DOC-MED', 'MEDICAL');
    act(med, { ...base, id: 'B-12', op: 'release a medical document to the union', expect: 'FORBIDDEN', req: ['WA-REQ-061'], find: ['WA-R1-03'], mx: ['WA-T052'], run: (x) => releaseDocument(x, PRINCIPAL_1, { documentId: asDocumentId('FAKE-DOC-MED'), audience: { kind: 'UNION', organizationId: ADMIN_A.organizationId }, grantId: 'G-2', actions: ['VIEW'] }) });
  });

  it('[WA-J-B] escalations and reassignment: only the principal reassigns; the old owner\'s reminders are superseded', () => {
    let w = withAngeloAccess(itoSent(itoApproved(stageMatter())));
    w = act(w, { ...base, id: 'B-13', op: 'specialist reassigns a receipt task', p: SPEC_1, persona: 'DOMENIC', expect: 'NOT_AUTHORIZED', req: ['WA-REQ-045'], mx: ['WA-T048'], run: (x) => reassignTaskOwner(x, SPEC_1, { taskId: x.tasks[0]!.id, newOwner: SPEC_2.userId }) });
    w = must(assignSpecialist(w, PRINCIPAL_1, { matterId: MATTER, userId: SPEC_2.userId }));
    w = act(w, { ...base, id: 'B-14', op: 'principal reassigns a task to a specialist who has no matter access', expect: 'NEW_OWNER_NOT_AUTHORIZED', req: ['WA-REQ-045'], find: ['WA-R1-02'], mx: ['WA-T048'], run: (x) => reassignTaskOwner(x, PRINCIPAL_1, { taskId: x.tasks[0]!.id, newOwner: SPEC_2.userId }) });
    w = must(grantMatterAccess(w, ADMIN_A, { grantId: asMatterGrantId('FAKE-MG-2'), matterId: MATTER, userId: SPEC_2.userId, sourceAuthorizationId: null, permissions: ['VIEW', 'VIEW_DOCUMENTS'] }));
    w = act(w, { ...base, id: 'B-14b', op: 'principal reassigns the receipt task to an assigned, granted specialist', expect: 'OK', audit: 'TASK_REASSIGNED', req: ['WA-REQ-045'], find: ['WA-R4-06'], mx: ['WA-T048', 'WA-ADV-11'], run: (x) => reassignTaskOwner(x, PRINCIPAL_1, { taskId: x.tasks[0]!.id, newOwner: SPEC_2.userId }) });
    assert.equal(w.tasks[0]?.owner, SPEC_2.userId);
    assert.equal(w.tasks[0]?.ownerEpoch, 2);
  });

  it('[WA-J-B] uncertain statutory deadlines stay visible to the supervisor until a professional confirms them with a reviewed rule source', () => {
    let w = stageMatter();
    w = withAngeloAccess(w);
    w = must(openObligation(w, SPEC_1, { matterId: MATTER, obligation: MIXED }));
    see(w, { ...base, id: 'B-15', op: 'supervisor lists uncertain deadlines', expect: 'mixed-issue obligation listed as unconfirmed; no date shown anywhere', req: ['WA-REQ-050'], find: ['WA-R1-01', 'WA-R2-03'], mx: ['WA-T028', 'WA-T074'], view: (x) => supervisorView(x, PRINCIPAL_1), check: (v) => {
      assert.deepEqual(v?.uncertainDeadlines, [{ obligationId: 'OBL-MIXED', status: 'UNCONFIRMED_PROFESSIONAL_REVIEW_REQUIRED' }]);
    } });
    w = act(w, { ...base, id: 'B-16', op: 'specialist confirms a mixed-issue deadline without manual affirmation', p: SPEC_1, persona: 'DOMENIC', expect: 'MANUAL_AFFIRMATION_REQUIRED', req: ['WA-REQ-050'], find: ['WA-R1-01'], mx: ['WA-T074'], run: (x) => confirmObligation(x, SPEC_1, { matterId: MATTER, obligationId: 'OBL-MIXED', date: '2026-11-30', sourceDocumentId: asDocumentId('FAKE-DOC-L1'), ruleSourceId: 'SYNTH-RULE-A', reasoning: REASONING }) });
    w = act(w, { ...base, id: 'B-17', op: 'specialist cites a rule source that is not in the registry', p: SPEC_1, persona: 'DOMENIC', expect: 'RULE_SOURCE_UNKNOWN', req: ['WA-REQ-050'], find: ['WA-R2-03'], mx: ['WA-T028'], run: (x) => confirmObligation(x, SPEC_1, { matterId: MATTER, obligationId: 'OBL-MIXED', date: '2026-11-30', sourceDocumentId: asDocumentId('FAKE-DOC-L1'), ruleSourceId: 'NOT-IN-REGISTRY', reasoning: REASONING, manualRuleAffirmation: true }) });
    w = act(w, { ...base, id: 'B-18', op: 'specialist confirms with source document, reviewed rule source, reasoning and affirmation', p: SPEC_1, persona: 'DOMENIC', expect: 'OK', audit: 'DEADLINE_CONFIRMED', req: ['WA-REQ-050'], mx: ['WA-T028'], run: (x) => confirmObligation(x, SPEC_1, { matterId: MATTER, obligationId: 'OBL-MIXED', date: '2026-11-30', sourceDocumentId: asDocumentId('FAKE-DOC-L1'), ruleSourceId: 'SYNTH-RULE-A', reasoning: REASONING, manualRuleAffirmation: true }) });
    see(w, { ...base, id: 'B-19', op: 'supervisor lists uncertain deadlines after confirmation', expect: 'no longer uncertain while the confirmed date is in the future', req: ['WA-REQ-050'], view: (x) => supervisorView(x, PRINCIPAL_1), check: (v) => assert.deepEqual(v?.uncertainDeadlines, []) });
    const past = tick(w, '2026-12-05T14:00:00Z');
    see(past, { ...base, id: 'B-20', op: 'supervisor lists deadlines after the confirmed date passes', expect: 'returned for disposition; never reported as met', req: ['WA-REQ-050', 'WA-REQ-052'], find: ['WA-R1-01'], view: (x) => supervisorView(x, PRINCIPAL_1), check: (v) => assert.equal(v?.uncertainDeadlines[0]?.status, 'CONFIRMED_DATE_PASSED_DISPOSITION_REQUIRED') });
  });

  it('[WA-J-B] an adverse ARO decision opens a prompt for assessment, never a filing; no tribunal procedure is determined by the system', () => {
    let w = withAngeloAccess(stageMatter());
    w = must(openWait(w, SPEC_1, { id: asDependencyId('DEP-ARO'), matterId: MATTER, claimId: CLAIM_X, kind: 'ARO_DECISION', waitingSince: '2026-12-16', expectedWindowDays: null }));
    const obligationsBefore = w.obligations.length;
    w = act(w, { ...base, id: 'B-21', op: 'specialist records an adverse ARO decision', p: SPEC_1, persona: 'DOMENIC', expect: 'OK', audit: 'TRIBUNAL_ASSESSMENT_PROMPT_OPENED', req: ['WA-REQ-090', 'WA-REQ-091'], find: ['WA-R2-07', 'WA-R5-05'], mx: ['WA-T035'], run: (x) => recordAroDecision(x, SPEC_1, { id: asDependencyId('DEP-ARO'), receivedOn: '2027-02-01', outcome: 'ADVERSE', finalDecisionDocumentId: asDocumentId('FAKE-DOC-FINAL'), assessmentId: 'TA-1' }) });
    see(w, { ...base, id: 'B-22', op: 'supervisor sees the prompt', expect: 'one prompt awaiting professional assessment', req: ['WA-REQ-090', 'WA-REQ-091'], mx: ['WA-T035'], view: (x) => supervisorView(x, PRINCIPAL_1), check: (v) => assert.deepEqual(v?.tribunalPrompts, ['TA-1']) });
    w = act(w, { ...base, id: 'B-23', op: 'a tribunal notice is prepared before any assessment', p: SPEC_1, persona: 'DOMENIC', expect: 'NOT_PROCEEDING', req: ['WA-REQ-090', 'WA-REQ-091'], find: ['WA-R2-07', 'WA-R5-05'], mx: ['WA-T035', 'WA-T079'], run: (x) => createOutbound(x, SPEC_1, { submissionId: asSubmissionId('FAKE-SUB-NOA-1'), matterId: MATTER, kind: 'WSIAT_NOA', version: 1 }) });
    w = act(w, { ...base, id: 'B-24', op: 'specialist makes the tribunal assessment', p: SPEC_1, persona: 'DOMENIC', expect: 'NOT_AUTHORIZED', req: ['WA-REQ-090', 'WA-REQ-091'], find: ['WA-R6-02'], run: (x) => assessTribunal(x, SPEC_1, { assessmentId: 'TA-1', decision: 'ASSESSED_PROCEEDING', reasoning: REASONING }) });
    w = act(w, { ...base, id: 'B-25', op: 'principal assessment with a forged assessor identity', expect: 'ASSESSOR_MISMATCH', req: ['WA-REQ-090', 'WA-REQ-091'], find: ['WA-R1-17'], mx: ['WA-ADV-20'], run: (x) => assessTribunal(x, PRINCIPAL_1, { assessmentId: 'TA-1', decision: 'ASSESSED_PROCEEDING', reasoning: REASONING, claimedAssessor: SPEC_1.userId }) });
    w = act(w, { ...base, id: 'B-26', op: 'principal records "proceeding" with reasoning', expect: 'OK', audit: 'TRIBUNAL_ASSESSMENT_RECORDED', req: ['WA-REQ-090', 'WA-REQ-091'], mx: ['WA-T114'], run: (x) => assessTribunal(x, PRINCIPAL_1, { assessmentId: 'TA-1', decision: 'ASSESSED_PROCEEDING', reasoning: REASONING }) });
    assert.equal(w.assessments[0]?.timeLimit, null, 'the system states no tribunal time limit');
    assert.equal(w.obligations.length, obligationsBefore, 'no deadline obligation was created by an assessment');
    w = act(w, { ...base, id: 'B-27', op: 'specialist prepares the tribunal notice after an assessment of "proceeding"', p: SPEC_1, persona: 'DOMENIC', expect: 'OK', audit: 'SUBMISSION_CREATED', req: ['WA-REQ-090', 'WA-REQ-091'], mx: ['WA-T079'], run: (x) => createOutbound(x, SPEC_1, { submissionId: asSubmissionId('FAKE-SUB-NOA-1'), matterId: MATTER, kind: 'WSIAT_NOA', version: 1 }) });
    w = must(submissionEvent(w, SPEC_1, asSubmissionId('FAKE-SUB-NOA-1'), { type: 'REVIEW' }));
    w = act(w, { ...base, id: 'B-28', op: 'approve the tribunal notice before readiness is attested', p: SPEC_1, persona: 'DOMENIC', expect: 'GATE_NOT_SATISFIED', req: ['WA-REQ-090'], mx: ['WA-T079'], run: (x) => submissionEvent(x, SPEC_1, asSubmissionId('FAKE-SUB-NOA-1'), { type: 'APPROVE', claimedApprover: SPEC_1.userId }) });
    void attestReadiness;
  });

  it('[WA-J-B] approval boundaries: forged approvals and non-professional overrides are refused', () => {
    let w = withAngeloAccess(stageMatter());
    w = must(createOutbound(w, SPEC_1, { submissionId: asSubmissionId('FAKE-SUB-WRF-9'), matterId: MATTER, kind: 'WRF', version: 1, claimId: CLAIM_X }));
    w = must(submissionEvent(w, SPEC_1, asSubmissionId('FAKE-SUB-WRF-9'), { type: 'REVIEW' }));
    w = act(w, { ...base, id: 'B-29', op: 'approval request asserting a different approver', expect: 'APPROVER_MISMATCH', req: ['WA-REQ-033'], find: ['WA-R1-17'], mx: ['WA-ADV-20'], run: (x) => submissionEvent(x, PRINCIPAL_1, asSubmissionId('FAKE-SUB-WRF-9'), { type: 'APPROVE', claimedApprover: SPEC_1.userId }) });
    w = act(w, { ...base, id: 'B-30', op: 'union representative tries to approve', p: REP_A, persona: 'UNION_REP', expect: 'NOT_FOUND', req: ['WA-REQ-033'], mx: ['WA-ADV-20'], run: (x) => submissionEvent(x, REP_A, asSubmissionId('FAKE-SUB-WRF-9'), { type: 'APPROVE', claimedApprover: REP_A.userId }) });
    w = act(w, { ...base, id: 'B-31', op: 'union representative tries to reassign responsibility', p: REP_A, persona: 'UNION_REP', expect: 'FORBIDDEN', req: ['WA-REQ-045'], run: (x) => reassignResponsibility(x, REP_A, { matterId: MATTER, from: SPEC_1.userId, to: SPEC_2.userId }) });
    w = act(w, { ...base, id: 'B-32', op: 'specialist tries to close the matter', p: SPEC_1, persona: 'DOMENIC', expect: 'FORBIDDEN', req: ['WA-REQ-045'], run: (x) => closeMatter(x, SPEC_1, MATTER) });
    w = act(w, { ...base, id: 'B-33', op: 'principal closes the matter', expect: 'OK', audit: 'MATTER_CLOSED', req: ['WA-REQ-045'], mx: ['WA-ADV-18'], run: (x) => closeMatter(x, PRINCIPAL_1, MATTER) });
    w = act(w, { ...base, id: 'B-34', op: 'professional action on a closed matter', p: SPEC_1, persona: 'DOMENIC', expect: 'AUTHORITY_DENIED', req: ['WA-REQ-012'], mx: ['WA-ADV-18'], run: (x) => submissionEvent(x, SPEC_1, asSubmissionId('FAKE-SUB-WRF-9'), { type: 'APPROVE', claimedApprover: SPEC_1.userId }) });
    void referralEvent;
  });
});
