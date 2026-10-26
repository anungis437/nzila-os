import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyReferralEvent, evaluatePacket, grantUrgentException, newReferral } from '../src/referral.ts';
import type { Referral, ReferralEvent } from '../src/referral.ts';
import { asDecisionId, asReferralId } from '../src/ids.ts';
import { authorizeReferralView } from '../src/authorization.ts';
import { MEMBER_ID, NOW_ISO, ORG_A, ORG_B, ORG_WA, PRINCIPAL_1, REP_A, REP_B, SPEC_1, TEST_POLICY, VIEWER_A, completePacket, doc } from './helpers.ts';

const fresh = () => newReferral({ id: asReferralId('FAKE-REF-1'), organizationId: ORG_A, specialistOrganizationId: ORG_WA, memberId: MEMBER_ID });
const apply = (r: Referral, e: ReferralEvent, p = REP_A) => applyReferralEvent(r, e, { principal: p, now: NOW_ISO, policy: TEST_POLICY });
const must = <T>(r: { ok: boolean } & Record<string, unknown>): T => {
  assert.equal(r.ok, true, JSON.stringify(r));
  return (r as unknown as { value: T }).value;
};

describe('referral completeness', () => {
  it('[WA-T001] four forms + photo ID + all documents is document-complete for review only', () => {
    const e = evaluatePacket(completePacket(), TEST_POLICY);
    assert.equal(e.checklistState, 'DOCUMENT_COMPLETE_FOR_REVIEW');
    assert.equal(e.professionalSufficiency, 'NOT_ASSESSED');
    assert.equal(e.reviewRoute, 'STANDARD_REVIEW');
  });

  it('[WA-T002] omitted intake form is reported with a next-action owner and cannot be overridden by a frontend flag', () => {
    const packet = completePacket({ items: completePacket().items.filter((i) => i.code !== 'CLIENT_INTAKE_FORM') });
    const forged = { ...packet, isComplete: true, complete: true, checklistState: 'DOCUMENT_COMPLETE_FOR_REVIEW' };
    const e = evaluatePacket(forged as never, TEST_POLICY);
    assert.equal(e.checklistState, 'AWAITING_REQUIRED_ITEMS');
    const m = e.missing.find((x) => x.code === 'CLIENT_INTAKE_FORM');
    assert.ok(m);
    assert.equal(m.nextActionOwner, 'MEMBER');
  });

  for (const [id, code] of [
    ['WA-T003', 'MEDICAL_AUTHORIZATION'],
    ['WA-T004', 'RETAINER_AGREEMENT'],
    ['WA-T005', 'SHARE_INFORMATION_RELEASE'],
    ['WA-T006', 'GOVERNMENT_PHOTO_ID'],
  ] as const) {
    it(`[${id}] missing ${code} is flagged individually`, () => {
      const e = evaluatePacket(completePacket({ items: completePacket().items.filter((i) => i.code !== code) }), TEST_POLICY);
      assert.deepEqual(e.missing.map((m) => m.code), [code]);
      assert.equal(e.reviewRoute, 'NOT_REVIEWABLE_UNTIL_CORRECTED');
    });
  }

  it('[WA-T010] unreadable, unsigned, wrong-claim and duplicate uploads do not count as provided', () => {
    for (const status of ['UNREADABLE', 'UNSIGNED', 'WRONG_CLAIM', 'DUPLICATE'] as const) {
      const items = completePacket().items.map((i) => (i.code === 'MEDICAL_AUTHORIZATION' ? { ...i, status } : i));
      const e = evaluatePacket(completePacket({ items }), TEST_POLICY);
      const m = e.missing.find((x) => x.code === 'MEDICAL_AUTHORIZATION');
      assert.equal(m?.reason, status);
    }
  });

  it('undeclared claim history and missing counts are flagged', () => {
    const e = evaluatePacket(completePacket({ claimHistory: 'NOT_DECLARED', declaredClaimCount: 0 }), TEST_POLICY);
    assert.deepEqual(e.missing.map((m) => m.code).sort(), ['CLAIM_HISTORY_DECLARATION', 'WSIB_CLAIM_NUMBERS']);
  });

  it('every denial needs its letter, identified per decision', () => {
    const e = evaluatePacket(
      completePacket({
        decisions: [
          { decisionId: asDecisionId('A-D1'), outcome: 'DENIED', letterDocumentId: doc('L1') },
          { decisionId: asDecisionId('A-D2'), outcome: 'DENIED', letterDocumentId: null },
        ],
      }),
      TEST_POLICY,
    );
    assert.deepEqual(e.missing.map((m) => m.decisionId), [asDecisionId('A-D2')]);
  });
});

describe('urgent exception', () => {
  const incomplete = () => completePacket({ items: completePacket().items.filter((i) => i.code !== 'GOVERNMENT_PHOTO_ID') });

  it('[WA-T011][WA-T016] a granted exception routes to expedited review but never flips the checklist to complete', () => {
    const ex = must<Parameters<typeof evaluatePacket>[2] & object>(
      grantUrgentException(SPEC_1, TEST_POLICY, { reason: 'objection date review needed within days', waivedItems: ['GOVERNMENT_PHOTO_ID'], urgencyBasis: 'ITO date review' }),
    );
    const e = evaluatePacket(incomplete(), TEST_POLICY, ex);
    assert.equal(e.checklistState, 'AWAITING_REQUIRED_ITEMS');
    assert.equal(e.reviewRoute, 'EXPEDITED_PROFESSIONAL_REVIEW');
    assert.equal(e.exceptionApplied, true);
  });

  it('[WA-T004] items outside the policy waiver list cannot be waived; union reps cannot grant exceptions', () => {
    const bad = grantUrgentException(SPEC_1, TEST_POLICY, { reason: 'because we are in a hurry here', waivedItems: ['RETAINER_AGREEMENT'], urgencyBasis: 'urgent' });
    assert.equal(bad.ok, false);
    const union = grantUrgentException(REP_A, TEST_POLICY, { reason: 'because we are in a hurry here', waivedItems: ['GOVERNMENT_PHOTO_ID'], urgencyBasis: 'urgent' });
    assert.equal(union.ok, false);
    assert.equal((union as { code: string }).code, 'NOT_AUTHORIZED');
  });

  it('[WA-T076] urgent objection preparation is not forced to wait for missing evidence', () => {
    const ex = must<never>(grantUrgentException(SPEC_1, TEST_POLICY, { reason: 'objection window may be closing', waivedItems: ['GOVERNMENT_PHOTO_ID'], urgencyBasis: 'objection window' }));
    let r = must<Referral>(apply(fresh(), { type: 'UPDATE_PACKET', packet: incomplete() }));
    r = must<Referral>(apply(r, { type: 'OFFER', urgentException: ex }));
    assert.equal(r.state, 'OFFERED');
    assert.equal(r.urgentReview, 'PENDING');
    assert.equal(r.lastEvaluation?.checklistState, 'AWAITING_REQUIRED_ITEMS');
  });
});

describe('referral lifecycle', () => {
  const offered = () => {
    let r = must<Referral>(apply(fresh(), { type: 'UPDATE_PACKET', packet: completePacket() }));
    r = must<Referral>(apply(r, { type: 'OFFER' }));
    return r;
  };

  it('incomplete packet cannot be offered without a covering exception', () => {
    const r = must<Referral>(apply(fresh(), { type: 'UPDATE_PACKET', packet: completePacket({ items: [] }) }));
    const o = apply(r, { type: 'OFFER' });
    assert.equal(o.ok, false);
    assert.equal((o as { code: string }).code, 'PACKET_INCOMPLETE');
  });

  it('[WA-T012] return for correction keeps history and does not collapse into declined', () => {
    let r = offered();
    r = must<Referral>(apply(r, { type: 'RETURN_FOR_CORRECTION', reason: 'missing denial letter' }, SPEC_1));
    assert.equal(r.state, 'RETURNED_FOR_CORRECTION');
    assert.ok(r.history.length >= 3);
    r = must<Referral>(apply(r, { type: 'UPDATE_PACKET', packet: completePacket() }));
    r = must<Referral>(apply(r, { type: 'OFFER' }));
    assert.equal(r.state, 'OFFERED');
    assert.equal(r.packetVersion, 2);
  });

  it('clarification round-trips without leaving the specialist relationship', () => {
    let r = offered();
    r = must<Referral>(apply(r, { type: 'REQUEST_CLARIFICATION', question: 'Which employer for claim 2?' }, SPEC_1));
    assert.equal(r.state, 'CLARIFICATION_REQUESTED');
    r = must<Referral>(apply(r, { type: 'ANSWER_CLARIFICATION' }));
    assert.equal(r.state, 'OFFERED');
  });

  it('[WA-T013] acceptance is a professional act, separate from the checklist', () => {
    const r = offered();
    assert.equal(apply(r, { type: 'ACCEPT' }, REP_A).ok, false);
    const accepted = must<Referral>(apply(r, { type: 'ACCEPT' }, SPEC_1));
    assert.equal(accepted.state, 'ACCEPTED');
    assert.equal(accepted.acceptance?.acceptedBy, SPEC_1.userId);
    assert.equal(accepted.lastEvaluation?.professionalSufficiency, 'NOT_ASSESSED');
  });

  it('decline is professional, requires a reason, and is terminal', () => {
    let r = must<Referral>(apply(offered(), { type: 'DECLINE', reason: 'outside scope' }, SPEC_1));
    assert.equal(r.state, 'DECLINED');
    assert.equal(apply(r, { type: 'ACCEPT' }, SPEC_1).ok, false);
    assert.equal(apply(offered(), { type: 'DECLINE', reason: ' ' }, SPEC_1).ok, false);
    r = must<Referral>(apply(offered(), { type: 'DECLINE', reason: 'outside scope' }, PRINCIPAL_1));
    assert.equal(r.state, 'DECLINED');
  });

  it('[WA-ADV-16] returning a referral does not cancel a pending urgent review, and withdraw/decline are blocked until it is dispositioned', () => {
    const ex = must<never>(grantUrgentException(SPEC_1, TEST_POLICY, { reason: 'objection window may be closing', waivedItems: ['GOVERNMENT_PHOTO_ID'], urgencyBasis: 'objection window' }));
    let r = must<Referral>(apply(fresh(), { type: 'UPDATE_PACKET', packet: completePacket({ items: completePacket().items.filter((i) => i.code !== 'GOVERNMENT_PHOTO_ID') }) }));
    r = must<Referral>(apply(r, { type: 'OFFER', urgentException: ex }));
    r = must<Referral>(apply(r, { type: 'RETURN_FOR_CORRECTION', reason: 'unclear scan' }, SPEC_1));
    assert.equal(r.state, 'RETURNED_FOR_CORRECTION');
    assert.equal(r.urgentReview, 'PENDING');
    const withdraw = apply(r, { type: 'WITHDRAW' });
    assert.equal((withdraw as { code: string }).code, 'URGENT_REVIEW_PENDING');
    const decline = apply(r, { type: 'DECLINE', reason: 'cannot assist' }, SPEC_1);
    assert.equal((decline as { code: string }).code, 'URGENT_REVIEW_PENDING');
    const declined = must<Referral>(apply(r, { type: 'DECLINE', reason: 'cannot assist', urgentDisposition: 'URGENT_REVIEW_COMPLETED' }, SPEC_1));
    assert.equal(declined.urgentReview, 'COMPLETED');
  });

  it('re-applying the same packet update is deterministic', () => {
    const a = must<Referral>(apply(fresh(), { type: 'UPDATE_PACKET', packet: completePacket() }));
    assert.equal(a.id, fresh().id);
    assert.equal(a.state, 'PACKET_COMPLETE_FOR_REVIEW');
  });

  it('illegal transitions are refused', () => {
    assert.equal((apply(fresh(), { type: 'ACCEPT' }, SPEC_1) as { code: string }).code, 'ILLEGAL_TRANSITION');
    assert.equal((apply(fresh(), { type: 'OFFER' }) as { code: string }).code, 'ILLEGAL_TRANSITION');
  });
});

describe('referral isolation', () => {
  it('[WA-ADV-01] another union cannot act on or even see a referral', () => {
    const r = fresh();
    const res = apply(r, { type: 'UPDATE_PACKET', packet: completePacket() }, REP_B);
    assert.equal((res as { code: string }).code, 'NOT_FOUND');
    const view = authorizeReferralView(REP_B, r);
    assert.equal(view.allow, false);
    assert.equal((view as { publicOutcome: string }).publicOutcome, 'NOT_FOUND');
    assert.equal(authorizeReferralView(REP_A, r).allow, true);
    assert.equal(authorizeReferralView(SPEC_1, r).allow, true);
    assert.equal(authorizeReferralView(VIEWER_A, r).allow, true);
  });

  it('union-side actions by a specialist and specialist-side actions by a union are refused', () => {
    const r = fresh();
    assert.equal((apply(r, { type: 'UPDATE_PACKET', packet: completePacket() }, SPEC_1) as { code: string }).code, 'FORBIDDEN_ACTOR');
    const o = must<Referral>(apply(must<Referral>(apply(r, { type: 'UPDATE_PACKET', packet: completePacket() })), { type: 'OFFER' }));
    assert.equal((apply(o, { type: 'ACCEPT' }, REP_A) as { code: string }).code, 'FORBIDDEN_ACTOR');
  });
});
