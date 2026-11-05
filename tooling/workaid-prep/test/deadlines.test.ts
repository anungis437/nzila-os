import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { confirmDeadline, confirmedExpiryMs, obligationStatus, recordDisposition, requiresManualRuleAffirmation, ruleAppliesToDate } from '../src/deadlines.ts';
import type { DeadlineObligation, RuleSource } from '../src/deadlines.ts';
import { dependencyStatus, openDependency, recordBatch } from '../src/dependency.ts';
import { asClaimId, asDecisionId, asDependencyId, asDocumentId, asIssueId, asUserId } from '../src/ids.ts';
import { MATTER_ID, REP_A, SPEC_1, submissionAt } from './helpers.ts';

const REVIEWER = asUserId('FAKE-WORKAID-PRINCIPAL');
const registry = (over: Partial<RuleSource> = {}): RuleSource[] => [
  { sourceId: 'SYNTH-RULE-A', label: 'Synthetic rule source A (not a statement of law)', effectiveFrom: '2026-01-01', effectiveTo: null, retrievedOn: '2026-10-23', reviewedBy: REVIEWER, ...over },
];
const obligation = (over: Partial<DeadlineObligation> = {}): DeadlineObligation => ({
  id: 'OBL-1',
  kind: 'WSIB_OBJECTION',
  claimId: asClaimId('A-CLAIM-X'),
  decisionId: asDecisionId('A-D1'),
  issueIds: [asIssueId('A-D1-I1')],
  letterDate: '2026-09-15',
  receivedDate: '2026-09-18',
  issueKinds: ['ENTITLEMENT'],
  matterTimeZone: 'America/Toronto',
  confirmations: [],
  disposition: null,
  ...over,
});
const confirm = (over: Partial<Parameters<typeof confirmDeadline>[0]> = {}) =>
  confirmDeadline({
    principal: SPEC_1,
    obligation: obligation(),
    registry: registry(),
    date: '2026-11-01',
    sourceDocumentId: asDocumentId('FAKE-DOC-L1'),
    ruleSourceId: 'SYNTH-RULE-A',
    reasoning: 'Decision letter dated 2026-09-15 read against the reviewed rule source.',
    now: '2026-10-23T15:00:00Z',
    ...over,
  });
const code = (r: { ok: boolean }) => (r as { code?: string }).code;

describe('human-confirmed deadline obligations', () => {
  it('[WA-T028][WA-T074] unconfirmed means unconfirmed: no universal timer, no computed date, never a "met" status', () => {
    const s = obligationStatus(obligation(), new Date('2027-06-01T00:00:00Z'));
    assert.equal(s.status, 'UNCONFIRMED_PROFESSIONAL_REVIEW_REQUIRED');
    assert.equal(JSON.stringify(s).toLowerCase().includes('met'), false);
    assert.equal(confirmedExpiryMs(obligation()), null);
  });

  it('[WA-T028] confirmation needs a professional, a source document, reasoning and a reviewed, effective rule source', () => {
    assert.equal(code(confirm({ principal: REP_A })), 'NOT_PROFESSIONAL');
    assert.equal(code(confirm({ sourceDocumentId: null })), 'SOURCE_DOCUMENT_REQUIRED');
    assert.equal(code(confirm({ reasoning: 'ok' })), 'REASONING_REQUIRED');
    assert.equal(code(confirm({ ruleSourceId: 'NOPE' })), 'RULE_SOURCE_UNKNOWN');
    assert.equal(code(confirm({ registry: registry({ reviewedBy: null }) })), 'RULE_SOURCE_UNREVIEWED');
    assert.equal(code(confirm({ registry: registry({ effectiveFrom: '2026-10-01' }) })), 'RULE_NOT_EFFECTIVE_FOR_DECISION_DATE');
    assert.equal(code(confirm({ date: '2026-13-40' })), 'BAD_DATE');
    assert.equal(code(confirm({ date: '2026-09-01' })), 'DATE_BEFORE_DECISION');
    assert.equal(confirm().ok, true);
  });

  it('[WA-T029] letter date and received date are both retained and neither is defaulted from upload time', () => {
    const o = (confirm() as { value: DeadlineObligation }).value;
    assert.equal(o.letterDate, '2026-09-15');
    assert.equal(o.receivedDate, '2026-09-18');
    assert.equal(obligation({ receivedDate: null }).receivedDate, null);
  });

  it('[WA-T030][WA-T074][WA-T075] mixed issue kinds and exception windows require explicit manual rule affirmation', () => {
    const mixed = obligation({ issueKinds: ['RETURN_TO_WORK', 'EARNINGS'] });
    const window = obligation({ issueKinds: ['TIME_LIMIT_EXCEPTION_WINDOW'] });
    assert.equal(requiresManualRuleAffirmation(mixed), true);
    assert.equal(requiresManualRuleAffirmation(window), true);
    assert.equal(requiresManualRuleAffirmation(obligation()), false);
    assert.equal(code(confirm({ obligation: mixed })), 'MANUAL_AFFIRMATION_REQUIRED');
    assert.equal(code(confirm({ obligation: window })), 'MANUAL_AFFIRMATION_REQUIRED');
    assert.equal(confirm({ obligation: mixed, manualRuleAffirmation: true }).ok, true);
  });

  it('[WA-T075][WA-T030] a rule source is only valid within its dated window; there is no blanket extension', () => {
    const windowed = registry({ effectiveFrom: '2025-03-01', effectiveTo: '2025-04-15' });
    assert.equal(ruleAppliesToDate(windowed[0]!, '2025-03-10'), true);
    assert.equal(ruleAppliesToDate(windowed[0]!, '2026-09-15'), false);
    assert.equal(code(confirm({ registry: windowed })), 'RULE_NOT_EFFECTIVE_FOR_DECISION_DATE');
  });

  it('re-confirmation is append-only: earlier confirmations are never erased', () => {
    const first = (confirm() as { value: DeadlineObligation }).value;
    const second = (confirm({ obligation: first, date: '2026-11-03', reasoning: 'Corrected after reviewing the amended decision letter.' }) as { value: DeadlineObligation }).value;
    assert.equal(second.confirmations.length, 2);
    assert.equal(second.confirmations[0]?.date, '2026-11-01');
    assert.equal(second.confirmations[1]?.date, '2026-11-03');
  });

  it('[WA-ADV-12] the confirmed date ends at local midnight in the matter zone, whatever zone the viewer is in', () => {
    const o = (confirm({ date: '2026-11-01' }) as { value: DeadlineObligation }).value; // DST ends this day in Toronto
    assert.equal(new Date(confirmedExpiryMs(o)!).toISOString(), '2026-11-02T05:00:00.000Z');
    const before = new Date('2026-11-02T04:59:59Z'); // 21:59 on Nov 1 in Vancouver, 23:59 EST in Toronto
    const at = new Date('2026-11-02T05:00:00Z');
    assert.equal(obligationStatus(o, before).status, 'CONFIRMED_OPEN');
    assert.equal(obligationStatus(o, at).status, 'CONFIRMED_DATE_PASSED_DISPOSITION_REQUIRED');
    assert.equal(obligationStatus(o, before).localDateInMatterZone, '2026-11-01');
    const summer = (confirm({ date: '2026-10-30' }) as { value: DeadlineObligation }).value;
    assert.equal(new Date(confirmedExpiryMs(summer)!).toISOString(), '2026-10-31T04:00:00.000Z');
  });

  it('a disposition needs a receipt-confirmed submission and a professional; sent or drafted is not enough', () => {
    const o = (confirm() as { value: DeadlineObligation }).value;
    assert.equal(code(recordDisposition(SPEC_1, o, submissionAt('DISPATCHED', 'ITO'), 'sent it', 'n')), 'SUBMISSION_NOT_RECEIPT_CONFIRMED');
    assert.equal(code(recordDisposition(SPEC_1, obligation(), submissionAt('RECEIPT_CONFIRMED', 'ITO'), 'receipt confirmed', 'n')), 'NOTHING_CONFIRMED');
    assert.equal(code(recordDisposition(REP_A, o, submissionAt('RECEIPT_CONFIRMED', 'ITO'), 'receipt confirmed', 'n')), 'NOT_PROFESSIONAL');
    const done = recordDisposition(SPEC_1, o, submissionAt('RECEIPT_CONFIRMED', 'ITO'), 'receipt confirmed by phone', 'n') as { value: DeadlineObligation };
    assert.equal(obligationStatus(done.value, new Date('2030-01-01T00:00:00Z')).status, 'PROFESSIONAL_DISPOSITION_RECORDED');
  });
});

describe('external dependencies', () => {
  const dep = () => {
    const r = openDependency({ id: asDependencyId('DEP-1'), matterId: MATTER_ID, claimId: asClaimId('A-CLAIM-X'), kind: 'WSIB_CLAIM_FILE', waitingSince: '2026-10-01', owner: SPEC_1.userId, expectedWindowDays: { min: 28, max: 42 } });
    return (r as { value: ReturnType<typeof recordBatch> }).value;
  };

  it('[WA-T031] 4-6 weeks is an operational expectation, never a legal deadline', () => {
    const within = dependencyStatus(dep(), new Date('2026-10-23T14:00:00Z'), 'America/Toronto');
    assert.equal(within.status, 'WAITING_WITHIN_EXPECTED_WINDOW');
    assert.equal(within.legalDeadline, false);
    const past = dependencyStatus(dep(), new Date('2026-12-01T14:00:00Z'), 'America/Toronto');
    assert.equal(past.status, 'WAITING_PAST_EXPECTED_WINDOW');
    assert.equal(past.legalDeadline, false);
    assert.equal(dependencyStatus({ ...dep(), expectedWindowDays: null }, new Date('2026-12-01T14:00:00Z'), 'America/Toronto').status, 'WAITING_NO_EXPECTATION_CONFIGURED');
  });

  it('an owner is required so a wait cannot go unowned', () => {
    const r = openDependency({ id: asDependencyId('D'), matterId: MATTER_ID, claimId: null, kind: 'ARO_DECISION', waitingSince: '2026-10-01', owner: '' as never, expectedWindowDays: null });
    assert.equal(code(r), 'OWNER_REQUIRED');
  });

  it('[WA-T032] receiving a file in batches does not mark it complete; completeness is a professional judgement', () => {
    let d = dep();
    d = recordBatch(d, { receivedOn: '2026-11-05', pageCount: 120, missingPagesNote: 'pages 44-51 missing' });
    d = recordBatch(d, { receivedOn: '2026-11-12', pageCount: 30, missingPagesNote: null });
    assert.equal(d.batches.length, 2);
    assert.equal(d.receivedAt, '2026-11-05');
    assert.equal(dependencyStatus(d, new Date('2026-11-20T14:00:00Z'), 'America/Toronto').status, 'RECEIVED_COMPLETENESS_UNASSESSED');
  });
});
