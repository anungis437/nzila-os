import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { consistencyProblems, determineFilingDefective, determineFilingValid, filingView, newFilingRecord, recordAuthorityResponse } from '../src/filing.ts';
import type { AssessInput, FilingIntent, FilingRecord, RequirementSource } from '../src/filing.ts';
import { applySubmissionEvent, SUBMISSION_STATES } from '../src/submission.ts';
import type { Submission, SubmissionEvent } from '../src/submission.ts';
import { asDecisionId, asDocumentId, asIssueId, asMatterId, asUserId } from '../src/ids.ts';
import { CLAIM_X, CLAIM_Y, MATTER_ID, PRINCIPAL_1, REP_A, SPEC_1, MEMBER_P, allowDecision, policyForSubmissions, submissionAt } from './helpers.ts';

const REVIEWER = asUserId('FAKE-WORKAID-PRINCIPAL');
const NOW = '2026-10-26T15:00:00Z';
const code = (r: { ok: boolean }) => (r as { code?: string }).code;
const val = <T>(r: { ok: boolean }) => (r as unknown as { value: T }).value;

const itoSource = (over: Partial<RequirementSource> = {}): RequirementSource => ({
  sourceId: 'SYNTH-REQ-ITO',
  label: 'Synthetic requirement source for an ITO (not a statement of any authority requirement)',
  formKind: 'ITO',
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  retrievedOn: '2026-10-23',
  reviewedBy: REVIEWER,
  elements: [
    { code: 'SYNTH-EL-SIGNED', description: 'signature present (synthetic element)' },
    { code: 'SYNTH-EL-ISSUES', description: 'disputed issues stated (synthetic element)' },
  ],
  ...over,
});
const attest = (...codes: string[]) => codes.map((c) => ({ code: c, evidenceRef: `FAKE-DOC-EVIDENCE#${c}` }));
const FULL = attest('SYNTH-EL-SIGNED', 'SYNTH-EL-ISSUES');

const received = (kind: Submission['kind'] = 'ITO') => submissionAt('RECEIPT_CONFIRMED', kind);
const intentFor = (s: Submission, over: Partial<FilingIntent> = {}): FilingIntent => ({ matterId: s.matterId, claimId: s.claimId, decisionId: s.decisionId, issueIds: s.issueIds, kind: s.kind, ...over });

const input = (over: Partial<AssessInput> = {}): AssessInput => {
  const submission = over.submission ?? received();
  return {
    principal: SPEC_1,
    claimedAssessor: SPEC_1.userId,
    professionalAuth: allowDecision,
    submission,
    currentVersion: submission.version,
    record: newFilingRecord(submission),
    intent: intentFor(submission),
    registry: [itoSource()],
    sourceId: 'SYNTH-REQ-ITO',
    attestations: FULL,
    reasoning: 'Reviewed the sent document against the reviewed requirement source, element by element.',
    now: NOW,
    ...over,
  };
};

describe('receipt is never a valid filing (WA-C-001)', () => {
  it('[WA-T103] no submission state, with or without a receipt record, yields a valid-filing status without a professional determination', () => {
    const reachable: Submission[] = [
      submissionAt('DRAFT', 'ITO'),
      submissionAt('REVIEWED', 'ITO'),
      submissionAt('APPROVED', 'ITO'),
      submissionAt('DISPATCH_ATTEMPTED', 'ITO'),
      submissionAt('DISPATCHED', 'ITO'),
      submissionAt('DELIVERY_ACK', 'ITO'),
      submissionAt('RECEIPT_CONFIRMED', 'ITO'),
    ];
    for (const s of reachable) {
      const v = filingView(s, newFilingRecord(s));
      assert.equal(v.status, 'UNDETERMINED', s.state);
      assert.equal(v.timeliness, 'NOT_ASSERTED');
    }
    assert.equal(SUBMISSION_STATES.length, 11);
    const documented = filingView(received(), newFilingRecord(received()));
    assert.equal(documented.receiptDocumented, true);
    assert.equal(documented.status, 'UNDETERMINED');
    assert.equal(documented.unresolvedReason, 'NO_PROFESSIONAL_DETERMINATION');
  });

  it('[WA-T103] the unresolved reason distinguishes "not sent", "sent, no receipt" and "receipt, no determination"', () => {
    assert.equal(filingView(submissionAt('APPROVED', 'ITO'), newFilingRecord(submissionAt('APPROVED', 'ITO'))).unresolvedReason, 'NOT_CONFIRMED_SENT');
    assert.equal(filingView(submissionAt('DELIVERY_ACK', 'ITO'), newFilingRecord(submissionAt('DELIVERY_ACK', 'ITO'))).unresolvedReason, 'RECEIPT_NOT_DOCUMENTED');
  });

  it('[WA-T103] an authority response cannot be fabricated from receipt: it needs the authority document and a professional', () => {
    const s = received();
    const base = { principal: SPEC_1, claimedRecorder: SPEC_1.userId, professionalAuth: allowDecision, submission: s, currentVersion: 1, record: newFilingRecord(s), outcome: 'ACCEPTED' as const, method: 'WSIB_WRITTEN_CONFIRMATION', receivedAt: NOW, now: NOW };
    assert.equal(code(recordAuthorityResponse({ ...base, evidenceDocumentId: null })), 'EVIDENCE_REQUIRED');
    assert.equal(code(recordAuthorityResponse({ ...base, evidenceDocumentId: asDocumentId('D'), principal: REP_A, claimedRecorder: REP_A.userId })), 'NOT_PROFESSIONAL');
    assert.equal(code(recordAuthorityResponse({ ...base, evidenceDocumentId: asDocumentId('D'), submission: submissionAt('APPROVED', 'ITO') })), 'DISPATCH_NOT_CONFIRMED');
  });

  it('[WA-T103] receipt itself carries no filing field: the receipt record has no validity or acceptance property', () => {
    const keys = Object.keys(received().receipt!).sort();
    assert.deepEqual(keys, ['confirmedBy', 'contactRef', 'evidenceRef', 'method', 'receivedAt', 'recordedAt']);
  });

  it('[WA-T103] with every other input perfect, only a documented receipt in a live state can be assessed valid; no status named VALIDLY_FILED exists', () => {
    const accepted: string[] = [];
    for (const state of SUBMISSION_STATES) {
      const s = submissionAt(state, 'ITO');
      const r = determineFilingValid(input({ submission: s, currentVersion: s.version, record: newFilingRecord(s), intent: intentFor(s) }));
      if (r.ok) accepted.push(state);
    }
    assert.deepEqual(accepted, ['RECEIPT_CONFIRMED']);
    const reachable = new Set<string>();
    for (const state of SUBMISSION_STATES) {
      const s = submissionAt(state, 'ITO');
      reachable.add(filingView(s, newFilingRecord(s)).status);
    }
    const s = received();
    const valid = val<FilingRecord>(determineFilingValid(input()));
    reachable.add(filingView(s, valid).status);
    assert.equal(reachable.has('VALIDLY_FILED'), false);
    assert.deepEqual([...reachable].sort(), ['PROFESSIONALLY_DETERMINED_VALID', 'UNDETERMINED', 'VOID_SUBMISSION_CLOSED']);
  });
});

describe('unauthorized determinations are refused', () => {
  it('[WA-T104] union user, member, inactive session, forged assessor, missing authorization', () => {
    assert.equal(code(determineFilingValid(input({ principal: REP_A, claimedAssessor: REP_A.userId }))), 'NOT_PROFESSIONAL');
    assert.equal(code(determineFilingValid(input({ principal: MEMBER_P, claimedAssessor: MEMBER_P.userId }))), 'NOT_PROFESSIONAL');
    assert.equal(code(determineFilingValid(input({ principal: { ...SPEC_1, sessionActive: false } }))), 'NOT_PROFESSIONAL');
    assert.equal(code(determineFilingValid(input({ claimedAssessor: PRINCIPAL_1.userId }))), 'ASSESSOR_MISMATCH');
    assert.equal(code(determineFilingValid(input({ professionalAuth: { allow: false, publicOutcome: 'FORBIDDEN', reason: 'no acceptance' } }))), 'AUTHORITY_DENIED');
  });

  it('[WA-T104] a closed or superseded submission, or a stale version, cannot be assessed', () => {
    const superseded = val<Submission>(applySubmissionEvent(received(), { type: 'SUPERSEDE', reason: 'new version issued' } as SubmissionEvent, { actor: { kind: 'USER', principal: SPEC_1 }, now: NOW, professionalAuth: allowDecision, policy: policyForSubmissions }));
    assert.equal(code(determineFilingValid(input({ submission: superseded, record: newFilingRecord(superseded) }))), 'SUBMISSION_CLOSED');
    assert.equal(code(determineFilingValid(input({ currentVersion: 2 }))), 'STALE_VERSION');
    const s = received();
    assert.equal(code(determineFilingValid(input({ record: { ...newFilingRecord(s), submissionVersion: 9 } }))), 'STALE_VERSION');
    assert.equal(code(determineFilingDefective({ ...input({ principal: REP_A, claimedAssessor: REP_A.userId }), defects: ['x'] })), 'NOT_PROFESSIONAL');
  });
});

describe('incomplete determinations are refused', () => {
  it('[WA-T105] sent without documented receipt, or never sent, cannot be a valid filing', () => {
    assert.equal(code(determineFilingValid(input({ submission: submissionAt('DISPATCHED', 'ITO') }))), 'RECEIPT_NOT_DOCUMENTED');
    assert.equal(code(determineFilingValid(input({ submission: submissionAt('DELIVERY_ACK', 'ITO') }))), 'RECEIPT_NOT_DOCUMENTED');
    assert.equal(code(determineFilingValid(input({ submission: submissionAt('DISPATCH_ATTEMPTED', 'ITO') }))), 'DISPATCH_NOT_CONFIRMED');
    assert.equal(code(determineFilingValid(input({ submission: submissionAt('APPROVED', 'ITO') }))), 'DISPATCH_NOT_CONFIRMED');
  });

  it('[WA-T105] with no reviewed, applicable requirement source the status stays explicitly undetermined', () => {
    assert.equal(code(determineFilingValid(input({ registry: [] }))), 'REQUIREMENT_SOURCE_UNKNOWN');
    assert.equal(code(determineFilingValid(input({ registry: [itoSource({ reviewedBy: null })] }))), 'REQUIREMENT_SOURCE_UNREVIEWED');
    assert.equal(code(determineFilingValid(input({ registry: [itoSource({ formKind: 'ARF' })] }))), 'REQUIREMENT_SOURCE_WRONG_FORM');
    assert.equal(code(determineFilingValid(input({ registry: [itoSource({ effectiveFrom: '2026-12-01' })] }))), 'REQUIREMENT_SOURCE_NOT_EFFECTIVE');
    assert.equal(code(determineFilingValid(input({ registry: [itoSource({ effectiveFrom: '2025-01-01', effectiveTo: '2025-12-31' })] }))), 'REQUIREMENT_SOURCE_NOT_EFFECTIVE');
    assert.equal(code(determineFilingValid(input({ registry: [itoSource({ elements: [] })] }))), 'INCOMPLETE_ATTESTATIONS');
    const s = received();
    assert.equal(filingView(s, newFilingRecord(s)).status, 'UNDETERMINED');
  });

  it('[WA-T105] every element of the source must be attested with a non-empty evidence reference', () => {
    assert.equal(code(determineFilingValid(input({ attestations: attest('SYNTH-EL-SIGNED') }))), 'INCOMPLETE_ATTESTATIONS');
    assert.equal(code(determineFilingValid(input({ attestations: [] }))), 'INCOMPLETE_ATTESTATIONS');
    assert.equal(code(determineFilingValid(input({ attestations: [{ code: 'SYNTH-EL-SIGNED', evidenceRef: '  ' }, ...attest('SYNTH-EL-ISSUES')] }))), 'INCOMPLETE_ATTESTATIONS');
    assert.equal(code(determineFilingValid(input({ attestations: attest('SYNTH-EL-SIGNED', 'SOMETHING-ELSE') }))), 'INCOMPLETE_ATTESTATIONS');
    assert.equal(code(determineFilingValid(input({ reasoning: 'ok' }))), 'REASONING_REQUIRED');
  });
});

describe('malformed and misdirected submissions cannot become a valid filing', () => {
  const s = () => received();

  it('[WA-T106] wrong claim, wrong decision, different issues, wrong matter', () => {
    assert.equal(code(determineFilingValid(input({ intent: intentFor(s(), { claimId: CLAIM_Y }) }))), 'MISDIRECTED');
    assert.equal(code(determineFilingValid(input({ intent: intentFor(s(), { decisionId: asDecisionId('B-D1') }) }))), 'MISDIRECTED');
    assert.equal(code(determineFilingValid(input({ intent: intentFor(s(), { issueIds: [asIssueId('A-D2-I1')] }) }))), 'MISDIRECTED');
    assert.equal(code(determineFilingValid(input({ intent: intentFor(s(), { matterId: asMatterId('OTHER-MATTER') }) }))), 'MISDIRECTED');
  });

  it('[WA-T106] wrong form kind and a tampered recipient (a record corrupted after creation)', () => {
    assert.equal(code(determineFilingValid(input({ intent: intentFor(s(), { kind: 'ARF' }) }))), 'MALFORMED');
    const tampered = { ...s(), recipient: 'WSIAT' as const };
    assert.equal(code(determineFilingValid(input({ submission: tampered, record: newFilingRecord(tampered), intent: intentFor(tampered) }))), 'MISDIRECTED');
  });

  it('[WA-T106] a missing required link makes it malformed even when receipt was acknowledged', () => {
    const noObjection = { ...s(), objectionId: null };
    assert.equal(consistencyProblems(noObjection, intentFor(noObjection)).some((p) => p.code === 'MALFORMED'), true);
    assert.equal(code(determineFilingValid(input({ submission: noObjection, record: newFilingRecord(noObjection), intent: intentFor(noObjection) }))), 'MALFORMED');
    const noIssues = { ...s(), issueIds: [] };
    assert.equal(code(determineFilingValid(input({ submission: noIssues, record: newFilingRecord(noIssues), intent: intentFor(noIssues) }))), 'MALFORMED');
  });

  it('[WA-T106] a refused determination changes nothing: the status stays UNDETERMINED', () => {
    const sub = s();
    const record = newFilingRecord(sub);
    const refused = determineFilingValid(input({ submission: sub, record, intent: intentFor(sub, { claimId: CLAIM_Y }) }));
    assert.equal(refused.ok, false);
    assert.equal(filingView(sub, record).status, 'UNDETERMINED');
    assert.equal(record.determinations.length, 0);
  });
});

describe('what a professional may legitimately record', () => {
  it('[WA-T107] with every gate satisfied a named professional can record a valid determination; timeliness is still not asserted', () => {
    const sub = received();
    const r = determineFilingValid(input({ submission: sub }));
    assert.equal(r.ok, true);
    const record = val<FilingRecord>(r);
    assert.equal(record.determinations.length, 1);
    assert.equal(record.determinations[0]?.by, SPEC_1.userId);
    assert.equal(record.determinations[0]?.sourceId, 'SYNTH-REQ-ITO');
    assert.equal(record.determinations[0]?.attestations.length, 2);
    const view = filingView(sub, record);
    assert.equal(view.status, 'PROFESSIONALLY_DETERMINED_VALID');
    assert.equal(view.timeliness, 'NOT_ASSERTED');
  });

  it('[WA-T107] the authority response is separate: acceptance and rejection need its own document and neither asserts timeliness', () => {
    const sub = received();
    const valid = val<FilingRecord>(determineFilingValid(input({ submission: sub })));
    const base = { principal: SPEC_1, claimedRecorder: SPEC_1.userId, professionalAuth: allowDecision, submission: sub, currentVersion: 1, record: valid, evidenceDocumentId: asDocumentId('FAKE-DOC-AUTH-RESP'), method: 'WSIB_WRITTEN_CONFIRMATION', receivedAt: '2026-11-02T00:00:00Z', now: NOW };
    const rejected = val<FilingRecord>(recordAuthorityResponse({ ...base, outcome: 'REJECTED' }));
    assert.equal(filingView(sub, rejected).status, 'AUTHORITY_REJECTED');
    assert.equal(rejected.determinations.length, 1, 'the professional determination is kept, not erased');
    const accepted = val<FilingRecord>(recordAuthorityResponse({ ...base, outcome: 'ACCEPTED' }));
    assert.equal(filingView(sub, accepted).status, 'AUTHORITY_ACCEPTED');
    assert.equal(filingView(sub, accepted).timeliness, 'NOT_ASSERTED');
  });

  it('[WA-T107] an authority acceptance recorded without any professional determination does not create one', () => {
    const sub = received();
    const resp = val<FilingRecord>(recordAuthorityResponse({ principal: SPEC_1, claimedRecorder: SPEC_1.userId, professionalAuth: allowDecision, submission: sub, currentVersion: 1, record: newFilingRecord(sub), outcome: 'ACCEPTED', evidenceDocumentId: asDocumentId('D'), method: 'WSIB_WRITTEN_CONFIRMATION', receivedAt: NOW, now: NOW }));
    assert.equal(resp.determinations.length, 0);
    assert.equal(filingView(sub, resp).status, 'AUTHORITY_ACCEPTED');
  });

  it('[WA-T107] a determination is void once the submission is superseded; a new version needs its own', () => {
    const sub = received();
    const valid = val<FilingRecord>(determineFilingValid(input({ submission: sub })));
    const superseded = val<Submission>(applySubmissionEvent(sub, { type: 'SUPERSEDE', reason: 'corrected and re-sent' }, { actor: { kind: 'USER', principal: SPEC_1 }, now: NOW, professionalAuth: allowDecision, policy: policyForSubmissions }));
    assert.equal(filingView(superseded, valid).status, 'VOID_SUBMISSION_CLOSED');
    const v2 = submissionAt('RECEIPT_CONFIRMED', 'ITO', 2);
    assert.equal(filingView(v2, newFilingRecord(v2)).status, 'UNDETERMINED');
    assert.equal(filingView(v2, valid).status, 'VOID_SUBMISSION_CLOSED', 'a record for another version cannot validate this one');
  });

  it('[WA-T108] a professional can record a defect on a sent submission without receipt; it needs concrete defects and reasoning', () => {
    const sub = submissionAt('DISPATCHED', 'ITO');
    const base = { ...input({ submission: sub }), defects: ['SYNTH-EL-SIGNED missing'] };
    const r = determineFilingDefective(base);
    assert.equal(r.ok, true);
    assert.equal(filingView(sub, val<FilingRecord>(r)).status, 'PROFESSIONALLY_DETERMINED_DEFECTIVE');
    assert.equal(code(determineFilingDefective({ ...base, defects: [] })), 'DEFECTS_REQUIRED');
    assert.equal(code(determineFilingDefective({ ...base, defects: [' '] })), 'DEFECTS_REQUIRED');
    assert.equal(code(determineFilingDefective({ ...base, reasoning: 'bad' })), 'REASONING_REQUIRED');
    assert.equal(code(determineFilingDefective({ ...base, submission: submissionAt('APPROVED', 'ITO') })), 'DISPATCH_NOT_CONFIRMED');
  });

  it('[WA-T108] determinations are append-only: a later defect finding supersedes a valid one without erasing it', () => {
    const sub = received();
    const valid = val<FilingRecord>(determineFilingValid(input({ submission: sub })));
    const later = val<FilingRecord>(determineFilingDefective({ ...input({ submission: sub, record: valid }), defects: ['found on re-read'] }));
    assert.equal(later.determinations.length, 2);
    assert.equal(filingView(sub, later).status, 'PROFESSIONALLY_DETERMINED_DEFECTIVE');
  });
});

void MATTER_ID;
void CLAIM_X;
