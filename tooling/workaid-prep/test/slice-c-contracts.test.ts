import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { memberStatusView, progressMisrepresentations, publishMemberStatus, unionMilestoneView } from '../src/publication.ts';
import type { MemberPublication, MemberStage } from '../src/publication.ts';
import { mayPrepareTribunalSubmission, openAssessmentIfIndicated, recordAssessment } from '../src/tribunal.ts';
import type { TribunalAssessment } from '../src/tribunal.ts';
import { asClaimId, asDependencyId, asDocumentId } from '../src/ids.ts';
import { openDependency, recordBatch } from '../src/dependency.ts';
import { MATTER_ID, MEMBER_P, NOW_ISO, PRINCIPAL_1, REP_A, SPEC_1, allowDecision, openMatter, submissionAt } from './helpers.ts';

const code = (r: { ok: boolean }) => (r as { code?: string }).code;
const val = <T>(r: { ok: boolean }) => (r as unknown as { value: T }).value;

const publish = (stage: MemberStage, text: string, over: Partial<Parameters<typeof publishMemberStatus>[0]> = {}) => {
  const evidence =
    stage === 'WSIB_RECEIPT_CONFIRMED'
      ? { kind: 'SUBMISSION' as const, submission: submissionAt('RECEIPT_CONFIRMED', 'WRF') }
      : stage === 'DOCUMENTS_SENT_TO_WSIB'
        ? { kind: 'SUBMISSION' as const, submission: submissionAt('DISPATCHED', 'WRF') }
        : stage === 'APPEAL_SENT_TO_WSIB'
          ? { kind: 'SUBMISSION' as const, submission: submissionAt('DISPATCHED', 'ARF') }
          : stage === 'AWAITING_WSIB_FILE'
            ? { kind: 'DEPENDENCY' as const, dependency: val<ReturnType<typeof recordBatch>>(openDependency({ id: asDependencyId('D'), matterId: MATTER_ID, claimId: null, kind: 'WSIB_CLAIM_FILE', waitingSince: '2026-10-01', owner: SPEC_1.userId, expectedWindowDays: null })) }
            : stage === 'ARO_DECISION_RECEIVED'
              ? { kind: 'DEPENDENCY' as const, dependency: recordBatch(val<ReturnType<typeof recordBatch>>(openDependency({ id: asDependencyId('D2'), matterId: MATTER_ID, claimId: null, kind: 'ARO_DECISION', waitingSince: '2026-10-01', owner: SPEC_1.userId, expectedWindowDays: null })), { receivedOn: '2027-01-10', pageCount: 3, missingPagesNote: null }) }
              : stage === 'REPRESENTATION_ACCEPTED'
                ? { kind: 'MATTER_ACCEPTANCE' as const }
                : { kind: 'NONE' as const };
  return publishMemberStatus({ principal: SPEC_1, matter: openMatter(), professionalAuth: allowDecision, stage, text, evidence, priorVersions: [], now: NOW_ISO, ...over });
};

describe('member status cannot misrepresent procedural progress', () => {
  it('[WA-T111] honest wording about a sent document passes; wording that claims receipt, filing or acceptance is refused', () => {
    assert.equal(publish('DOCUMENTS_SENT_TO_WSIB', 'Your documents were sent to WSIB. We are waiting for WSIB to confirm they arrived.').ok, true);
    for (const bad of ['WSIB has received your documents.', 'Your documents were received by WSIB.', 'Your objection was filed.', 'WSIB accepted your documents.', 'Your documents were successfully submitted.', 'Your objection was approved.']) {
      assert.equal(code(publish('DOCUMENTS_SENT_TO_WSIB', bad)), 'MISREPRESENTS_PROGRESS', bad);
    }
  });

  it('[WA-T111] receipt-confirmed wording may say received, but still never "filed", "valid" or "accepted"', () => {
    assert.equal(publish('WSIB_RECEIPT_CONFIRMED', 'WSIB has received your documents. WSIB has not yet made a decision.').ok, true);
    for (const bad of ['Your documents were filed.', 'Your objection is validly filed.', 'WSIB accepted your objection.', 'Your objection was successful.']) {
      assert.equal(code(publish('WSIB_RECEIPT_CONFIRMED', bad)), 'MISREPRESENTS_PROGRESS', bad);
    }
  });

  it('[WA-T111] a decision stage tells the member a decision arrived and who will explain it; it never states the outcome', () => {
    assert.equal(publish('ARO_DECISION_RECEIVED', 'A decision has arrived. Your representative will contact you to explain it.').ok, true);
    for (const bad of ['Your appeal was approved.', 'The decision was adverse.', 'WSIB denied your appeal.', 'Good news: favourable decision.']) {
      assert.equal(code(publish('ARO_DECISION_RECEIVED', bad)), 'MISREPRESENTS_PROGRESS', bad);
    }
  });

  it('[WA-T111] waiting stages cannot claim receipt; the three states a member must tell apart stay distinct', () => {
    assert.equal(code(publish('AWAITING_WSIB_FILE', 'WSIB has received our request and sent your file.')), 'MISREPRESENTS_PROGRESS');
    assert.equal(publish('AWAITING_WSIB_FILE', 'We have asked WSIB for your claim file and are waiting for it.').ok, true);
    const sent = val<MemberPublication>(publish('DOCUMENTS_SENT_TO_WSIB', 'Your documents were sent to WSIB.'));
    const confirmed = val<MemberPublication>(publish('WSIB_RECEIPT_CONFIRMED', 'WSIB has received your documents.'));
    const decided = val<MemberPublication>(publish('ARO_DECISION_RECEIVED', 'A decision has arrived. Your representative will contact you.'));
    assert.deepEqual([sent.stage, confirmed.stage, decided.stage], ['DOCUMENTS_SENT_TO_WSIB', 'WSIB_RECEIPT_CONFIRMED', 'ARO_DECISION_RECEIVED']);
  });

  it('[WA-T111] the lint is a backstop, not a gate on evidence: wording passing the lint still needs stage evidence', () => {
    assert.equal(code(publishMemberStatus({ principal: SPEC_1, matter: openMatter(), professionalAuth: allowDecision, stage: 'WSIB_RECEIPT_CONFIRMED', text: 'WSIB has received your documents.', evidence: { kind: 'SUBMISSION', submission: submissionAt('DISPATCHED', 'WRF') }, priorVersions: [], now: NOW_ISO })), 'EVIDENCE_DOES_NOT_SUPPORT_STAGE');
  });
});

describe('English / French content contract (no translation or accessibility claim)', () => {
  it('[WA-T112] French wording is linted with the same rules', () => {
    assert.deepEqual(progressMisrepresentations('DOCUMENTS_SENT_TO_WSIB', 'Vos documents ont été envoyés à la CSPAAT.', 'fr'), []);
    assert.ok(progressMisrepresentations('DOCUMENTS_SENT_TO_WSIB', 'Votre opposition a été acceptée.', 'fr').length > 0);
    assert.ok(progressMisrepresentations('DOCUMENTS_SENT_TO_WSIB', 'Vos documents ont été reçus par WSIB.', 'fr').length > 0);
    assert.ok(progressMisrepresentations('DOCUMENTS_SENT_TO_WSIB', 'Votre dossier a été déposé.', 'fr').length > 0);
    assert.equal(code(publish('DOCUMENTS_SENT_TO_WSIB', 'Your documents were sent to WSIB.', { textFr: 'Votre opposition a été acceptée.' })), 'MISREPRESENTS_PROGRESS');
  });

  it('[WA-T112] when policy requires French, an English-only publication is refused; otherwise nothing is assumed', () => {
    assert.equal(code(publish('DOCUMENTS_SENT_TO_WSIB', 'Your documents were sent to WSIB.', { bilingualRequired: true })), 'FR_TEXT_REQUIRED');
    assert.equal(publish('DOCUMENTS_SENT_TO_WSIB', 'Your documents were sent to WSIB.').ok, true);
    assert.equal(publish('DOCUMENTS_SENT_TO_WSIB', 'Your documents were sent to WSIB.', { bilingualRequired: true, textFr: 'Vos documents ont été envoyés à WSIB.' }).ok, true);
  });

  it('[WA-T112] a French text is recorded UNREVIEWED: the system claims no translation quality', () => {
    const p = val<MemberPublication>(publish('DOCUMENTS_SENT_TO_WSIB', 'Your documents were sent to WSIB.', { textFr: 'Vos documents ont été envoyés à WSIB.' }));
    assert.equal(p.translationStatus, 'UNREVIEWED');
    assert.equal(val<MemberPublication>(publish('DOCUMENTS_SENT_TO_WSIB', 'Your documents were sent to WSIB.')).translationStatus, 'NOT_PROVIDED');
  });

  it('[WA-T112] the member sees French only if it exists; otherwise English is shown and labelled as English', () => {
    const en = val<MemberPublication>(publish('DOCUMENTS_SENT_TO_WSIB', 'Your documents were sent to WSIB.'));
    assert.deepEqual([memberStatusView(MEMBER_P, openMatter(), [en], 'fr')?.locale, memberStatusView(MEMBER_P, openMatter(), [en], 'fr')?.text], ['en', 'Your documents were sent to WSIB.']);
    const both = val<MemberPublication>(publish('DOCUMENTS_SENT_TO_WSIB', 'Your documents were sent to WSIB.', { textFr: 'Vos documents ont été envoyés à WSIB.' }));
    assert.equal(memberStatusView(MEMBER_P, openMatter(), [both], 'fr')?.locale, 'fr');
    assert.equal(memberStatusView(MEMBER_P, openMatter(), [both], 'en')?.text, 'Your documents were sent to WSIB.');
  });
});

describe('union sees only approved milestones', () => {
  it('[WA-T113] publications are union-invisible by default; only an explicitly union-visible, non-withdrawn milestone appears, with no extra fields', () => {
    const hidden = val<MemberPublication>(publish('DOCUMENTS_SENT_TO_WSIB', 'Your documents were sent to WSIB.'));
    assert.deepEqual(unionMilestoneView([hidden], MATTER_ID), []);
    const visible = { ...hidden, unionVisible: true, textFr: 'Texte FR interne' };
    const v = unionMilestoneView([visible], MATTER_ID);
    assert.deepEqual(Object.keys(v[0]!).sort(), ['publishedAt', 'stage', 'text', 'version']);
    assert.deepEqual(unionMilestoneView([{ ...visible, withdrawnAt: NOW_ISO }], MATTER_ID), []);
  });
});

describe('tribunal assessment records a professional decision and states no procedure', () => {
  const claim = asClaimId('A-CLAIM-X');
  const open = (outcome: Parameters<typeof openAssessmentIfIndicated>[0]['aroOutcome'], doc: string | null = 'FAKE-DOC-FINAL') =>
    openAssessmentIfIndicated({ id: 'TA-1', matterId: MATTER_ID, claimId: claim, aroOutcome: outcome, finalDecisionDocumentId: doc ? asDocumentId(doc) : null, now: NOW_ISO });
  const roles = ['WORKAID_PRINCIPAL' as const];
  const assess = (a: TribunalAssessment, over: Partial<Parameters<typeof recordAssessment>[0]> = {}) =>
    recordAssessment({ principal: PRINCIPAL_1, claimedAssessor: PRINCIPAL_1.userId, roles, professionalAuth: allowDecision, assessment: a, decision: 'ASSESSED_PROCEEDING', finalDecisionDocumentId: null, reasoning: 'Reviewed the final decision and the evidence on file with the member.', now: NOW_ISO, ...over });

  it('[WA-T114] a non-favourable or unknown outcome opens a prompt for professional assessment, never a filing; a favourable one opens nothing', () => {
    for (const o of ['ADVERSE', 'MIXED', 'UNKNOWN'] as const) {
      const a = val<TribunalAssessment>(open(o));
      assert.equal(a.status, 'NEEDS_PROFESSIONAL_ASSESSMENT');
      assert.equal(a.timeLimit, null);
    }
    assert.equal(code(open('FAVOURABLE')), 'NO_ASSESSMENT_NEEDED');
  });

  it('[WA-T114] only a permitted role can assess, the assessor must be the authenticated principal, and reasoning plus the final decision document are required', () => {
    const a = val<TribunalAssessment>(open('ADVERSE'));
    assert.equal(code(assess(a, { principal: SPEC_1, claimedAssessor: SPEC_1.userId })), 'NOT_AUTHORIZED');
    assert.equal(code(assess(a, { principal: REP_A, claimedAssessor: REP_A.userId })), 'NOT_AUTHORIZED');
    assert.equal(code(assess(a, { claimedAssessor: SPEC_1.userId })), 'ASSESSOR_MISMATCH');
    assert.equal(code(assess(a, { professionalAuth: { allow: false, publicOutcome: 'FORBIDDEN', reason: 'x' } })), 'AUTHORITY_DENIED');
    assert.equal(code(assess(val<TribunalAssessment>(open('ADVERSE', null)))), 'FINAL_DECISION_DOCUMENT_REQUIRED');
    assert.equal(code(assess(a, { reasoning: 'short' })), 'REASONING_REQUIRED');
    assert.equal(assess(a).ok, true);
  });

  it('[WA-T114] tribunal submission preparation needs a recorded "proceeding" assessment; not-proceeding, more-information and unassessed do not qualify', () => {
    const a = val<TribunalAssessment>(open('ADVERSE'));
    assert.equal(code(mayPrepareTribunalSubmission(undefined)), 'NOT_PROCEEDING');
    assert.equal(code(mayPrepareTribunalSubmission(a)), 'NOT_PROCEEDING');
    assert.equal(code(mayPrepareTribunalSubmission(val<TribunalAssessment>(assess(a, { decision: 'ASSESSED_NOT_PROCEEDING' })))), 'NOT_PROCEEDING');
    assert.equal(code(mayPrepareTribunalSubmission(val<TribunalAssessment>(assess(a, { decision: 'ASSESSED_NEEDS_MORE_INFORMATION' })))), 'NOT_PROCEEDING');
    assert.equal(mayPrepareTribunalSubmission(val<TribunalAssessment>(assess(a))).ok, true);
  });

  it('[WA-T114] an assessment is recorded once; revisiting needs a new prompt, and the record states no time limit', () => {
    const done = val<TribunalAssessment>(assess(val<TribunalAssessment>(open('ADVERSE'))));
    assert.equal(code(assess(done)), 'ALREADY_ASSESSED');
    assert.equal(done.timeLimit, null);
    assert.equal(done.assessedBy, PRINCIPAL_1.userId);
  });
});
