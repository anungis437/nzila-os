import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ALLOWED_SUBMISSION_TRANSITIONS, SUBMISSION_STATES, applySubmissionEvent, createSubmission, isReceiptUnconfirmed, submissionCountsAsFiled } from '../src/submission.ts';
import type { Submission, SubmissionContext, SubmissionEvent, SubmissionState } from '../src/submission.ts';
import { asDecisionId, asIssueId, asMatterId, asObjectionId, asSubmissionId } from '../src/ids.ts';
import { CLAIM_X, MATTER_ID, PRINCIPAL_1, REP_A, SPEC_1, SPEC_2, allowDecision, policyForSubmissions, principal, submissionAt, ORG_WA } from './helpers.ts';

const ctx = (over: Partial<SubmissionContext> = {}): SubmissionContext => ({
  actor: { kind: 'USER', principal: SPEC_1 },
  now: '2026-10-23T15:00:00Z',
  professionalAuth: allowDecision,
  representativeAuth: allowDecision,
  policy: policyForSubmissions,
  gates: { arfReady: true, noaReady: true },
  ...over,
});
const code = (r: { ok: boolean }) => (r as { code?: string }).code;

describe('submission creation links', () => {
  it('[WA-T026] DOA and WRF are distinct typed submissions', () => {
    const doa = submissionAt('DRAFT', 'DOA');
    const wrf = submissionAt('DRAFT', 'WRF');
    assert.notEqual(doa.id, wrf.id);
    assert.equal(doa.kind, 'DOA');
    assert.equal(wrf.kind, 'WRF');
  });

  it('[WA-T027] an ITO must name claim, decision, objection and issues; there is no matter-wide ITO checkbox', () => {
    const base = { id: asSubmissionId('S'), matterId: MATTER_ID, kind: 'ITO' as const, version: 1, preparedBy: SPEC_1.userId };
    assert.equal(code(createSubmission(base)), 'MISSING_LINKS');
    assert.equal(code(createSubmission({ ...base, claimId: CLAIM_X })), 'MISSING_LINKS');
    assert.equal(createSubmission({ ...base, claimId: CLAIM_X, decisionId: asDecisionId('D'), objectionId: asObjectionId('O'), issueIds: [asIssueId('I')] }).ok, true);
  });

  it('[WA-T078] ARF approval is gated on attested readiness; a template existing is not a completed ARF', () => {
    const arf = submissionAt('REVIEWED', 'ARF');
    const blocked = applySubmissionEvent(arf, { type: 'APPROVE', claimedApprover: SPEC_1.userId }, ctx({ gates: { arfReady: false } }));
    assert.equal(code(blocked), 'GATE_NOT_SATISFIED');
    assert.equal(applySubmissionEvent(arf, { type: 'APPROVE', claimedApprover: SPEC_1.userId }, ctx()).ok, true);
  });

  it('[WA-T079] a WSIAT NOA cannot be approved ready-to-file without attested readiness', () => {
    const noa = submissionAt('REVIEWED', 'WSIAT_NOA');
    assert.equal(code(applySubmissionEvent(noa, { type: 'APPROVE', claimedApprover: SPEC_1.userId }, ctx({ gates: { noaReady: false } }))), 'GATE_NOT_SATISFIED');
    assert.equal(code(applySubmissionEvent(noa, { type: 'APPROVE', claimedApprover: SPEC_1.userId }, ctx({ gates: {} }))), 'GATE_NOT_SATISFIED');
  });
});

describe('forbidden transitions', () => {
  const eventsFor: Record<SubmissionState, SubmissionEvent> = {
    DRAFT: { type: 'REQUEST_REWORK' },
    REVIEWED: { type: 'REVIEW' },
    APPROVED: { type: 'APPROVE', claimedApprover: SPEC_1.userId },
    DISPATCHED: { type: 'DISPATCH', requestId: 'REQ-X', method: 'm' },
    DELIVERY_ACK: { type: 'ACK_DELIVERY', channel: 'c', providerRef: 'p' },
    RECEIPT_CONFIRMED: { type: 'CONFIRM_RECEIPT', method: 'PHONE_CALL', contactRef: 'FAKE CLERK', receivedAt: '2026-10-24T00:00:00Z' },
    REJECTED: { type: 'REJECT', reason: 'rejected by WSIB' },
    WITHDRAWN: { type: 'WITHDRAW', reason: 'no longer needed' },
    SUPERSEDED: { type: 'SUPERSEDE', reason: 'new version issued' },
  };
  const reach = (s: SubmissionState): Submission | null => {
    if (s === 'DRAFT' || s === 'REVIEWED' || s === 'APPROVED' || s === 'DISPATCHED' || s === 'DELIVERY_ACK' || s === 'RECEIPT_CONFIRMED') return submissionAt(s);
    const via = (from: Parameters<typeof submissionAt>[0], e: SubmissionEvent) => {
      const r = applySubmissionEvent(submissionAt(from), e, ctx());
      return r.ok ? r.value : null;
    };
    if (s === 'REJECTED') return via('DISPATCHED', eventsFor.REJECTED);
    if (s === 'WITHDRAWN') return via('DRAFT', eventsFor.WITHDRAWN);
    return via('DISPATCHED', eventsFor.SUPERSEDED);
  };

  it('[WA-T039][WA-T040] exhaustive matrix: every (from, to) pair behaves exactly as the allow-list says', () => {
    for (const from of SUBMISSION_STATES) {
      for (const to of SUBMISSION_STATES) {
        const sub = reach(from);
        assert.ok(sub, `could not reach ${from}`);
        const actor: SubmissionContext['actor'] = to === 'DELIVERY_ACK' ? { kind: 'SYSTEM', component: 'DISPATCH_PROVIDER' } : { kind: 'USER', principal: SPEC_1 };
        const r = applySubmissionEvent(sub, eventsFor[to], ctx({ actor }));
        const allowed = ALLOWED_SUBMISSION_TRANSITIONS[from].includes(to) || (from === 'DELIVERY_ACK' && to === 'DELIVERY_ACK');
        assert.equal(r.ok, allowed, `${from} -> ${to} expected ${allowed ? 'allowed' : 'forbidden'}: ${JSON.stringify(r)}`);
      }
    }
  });

  it('[WA-ADV-09] DRAFT/REVIEWED/APPROVED can never jump to DISPATCHED-adjacent receipt states', () => {
    for (const s of ['DRAFT', 'REVIEWED', 'APPROVED'] as const) {
      assert.equal(code(applySubmissionEvent(submissionAt(s), eventsFor.RECEIPT_CONFIRMED, ctx())), 'ILLEGAL_TRANSITION');
      assert.equal(code(applySubmissionEvent(submissionAt(s), eventsFor.DELIVERY_ACK, ctx({ actor: { kind: 'SYSTEM', component: 'DISPATCH_PROVIDER' } }))), 'ILLEGAL_TRANSITION');
    }
    assert.equal(code(applySubmissionEvent(submissionAt('DRAFT'), eventsFor.DISPATCHED, ctx())), 'ILLEGAL_TRANSITION');
    assert.equal(code(applySubmissionEvent(submissionAt('REVIEWED'), eventsFor.DISPATCHED, ctx())), 'ILLEGAL_TRANSITION');
  });

  it('terminal states stay terminal', () => {
    for (const s of ['WITHDRAWN', 'SUPERSEDED'] as const) {
      const sub = reach(s)!;
      for (const e of Object.values(eventsFor)) {
        const actor: SubmissionContext['actor'] = e.type === 'ACK_DELIVERY' ? { kind: 'SYSTEM', component: 'DISPATCH_PROVIDER' } : { kind: 'USER', principal: SPEC_1 };
        assert.equal(applySubmissionEvent(sub, e, ctx({ actor })).ok, false, `${s} must be terminal for ${e.type}`);
      }
    }
  });

  it('a rejected submission can only be superseded by a new version, never revived', () => {
    const rejected = reach('REJECTED')!;
    assert.equal(code(applySubmissionEvent(rejected, eventsFor.DISPATCHED, ctx())), 'ILLEGAL_TRANSITION');
    assert.equal(applySubmissionEvent(rejected, eventsFor.SUPERSEDED, ctx()).ok, true);
  });
});

describe('sending is not receipt; receipt is not acceptance', () => {
  it('[WA-T040] a provider acknowledgement never confirms WSIB receipt', () => {
    const acked = submissionAt('DELIVERY_ACK');
    assert.equal(acked.state, 'DELIVERY_ACK');
    assert.equal(acked.receipt, null);
    assert.equal(isReceiptUnconfirmed(acked), true);
    assert.equal(submissionCountsAsFiled(acked), false);
  });

  it('[WA-ADV-09] a dispatch whose receipt is never confirmed stays visibly unconfirmed forever', () => {
    const sent = submissionAt('DISPATCHED');
    assert.equal(isReceiptUnconfirmed(sent), true);
    assert.equal(submissionCountsAsFiled(sent), false);
  });

  it('only the dispatch provider may acknowledge delivery; humans and other systems cannot', () => {
    const sent = submissionAt('DISPATCHED');
    const ack: SubmissionEvent = { type: 'ACK_DELIVERY', channel: 'c', providerRef: 'p' };
    assert.equal(code(applySubmissionEvent(sent, ack, ctx())), 'SYSTEM_ACTOR_NOT_ALLOWED');
    assert.equal(code(applySubmissionEvent(sent, ack, ctx({ actor: { kind: 'SYSTEM', component: 'AUTHORITY_CASCADE' } }))), 'SYSTEM_ACTOR_NOT_ALLOWED');
  });

  it('[WA-T041] receipt confirmation requires a human, a recognized method, and a contact or evidence reference', () => {
    const sent = submissionAt('DISPATCHED');
    const at = '2026-10-24T14:00:00Z';
    assert.equal(code(applySubmissionEvent(sent, { type: 'CONFIRM_RECEIPT', method: 'PHONE_CALL', contactRef: 'FAKE CLERK', receivedAt: at }, ctx({ actor: { kind: 'SYSTEM', component: 'DISPATCH_PROVIDER' } }))), 'HUMAN_ACTOR_REQUIRED');
    assert.equal(code(applySubmissionEvent(sent, { type: 'CONFIRM_RECEIPT', method: 'EMAIL_PROVIDER_200', contactRef: 'x', receivedAt: at }, ctx())), 'INVALID_RECEIPT_METHOD');
    assert.equal(code(applySubmissionEvent(sent, { type: 'CONFIRM_RECEIPT', method: 'PHONE_CALL', receivedAt: at }, ctx())), 'RECEIPT_EVIDENCE_REQUIRED');
    assert.equal(code(applySubmissionEvent(sent, { type: 'CONFIRM_RECEIPT', method: 'PHONE_CALL', contactRef: '  ', evidenceRef: '', receivedAt: at }, ctx())), 'RECEIPT_EVIDENCE_REQUIRED');
    const done = applySubmissionEvent(sent, { type: 'CONFIRM_RECEIPT', method: 'WSIB_PORTAL_CONFIRMATION', evidenceRef: 'FAKE-PORTAL-REF-1', receivedAt: at }, ctx());
    assert.equal(done.ok, true);
    const v = (done as { value: Submission }).value;
    assert.equal(v.receipt?.confirmedBy, SPEC_1.userId);
    assert.equal(v.receipt?.recordedAt, '2026-10-23T15:00:00Z');
    assert.equal(submissionCountsAsFiled(v), true);
  });

  it('a union user cannot confirm receipt or dispatch', () => {
    const sent = submissionAt('DISPATCHED');
    assert.equal(code(applySubmissionEvent(sent, { type: 'CONFIRM_RECEIPT', method: 'PHONE_CALL', contactRef: 'x', receivedAt: 'z' }, ctx({ actor: { kind: 'USER', principal: REP_A } }))), 'NOT_PROFESSIONAL');
    assert.equal(code(applySubmissionEvent(submissionAt('APPROVED'), { type: 'DISPATCH', requestId: 'r', method: 'm' }, ctx({ actor: { kind: 'USER', principal: REP_A } }))), 'NOT_PROFESSIONAL');
  });

  it('[WA-T039] draft or approved documents have no dispatch record and start nothing', () => {
    for (const s of ['DRAFT', 'REVIEWED', 'APPROVED'] as const) assert.equal(submissionAt(s).dispatch, null);
  });

  it('a replayed dispatch with the same request id is idempotent; a second send under a new id is refused', () => {
    const sent = submissionAt('DISPATCHED');
    const replay = applySubmissionEvent(sent, { type: 'DISPATCH', requestId: 'REQ-1', method: 'FAX_RECORDED_MANUALLY' }, ctx());
    assert.equal(replay.ok && replay.created, false);
    assert.equal(code(applySubmissionEvent(sent, { type: 'DISPATCH', requestId: 'REQ-2', method: 'FAX_RECORDED_MANUALLY' }, ctx())), 'DUPLICATE_DISPATCH_DIFFERENT_REQUEST');
  });

  it('dispatching a representative document without live WSIB authority is refused, but DOA itself is dispatchable', () => {
    const ito = submissionAt('APPROVED', 'ITO');
    const denied = { allow: false as const, publicOutcome: 'FORBIDDEN' as const, reason: 'no DOA' };
    assert.equal(code(applySubmissionEvent(ito, { type: 'DISPATCH', requestId: 'r', method: 'm' }, ctx({ representativeAuth: denied }))), 'AUTHORITY_DENIED');
    const doa = submissionAt('APPROVED', 'DOA');
    assert.equal(applySubmissionEvent(doa, { type: 'DISPATCH', requestId: 'r', method: 'm' }, ctx({ representativeAuth: denied })).ok, true);
  });
});

describe('approval cannot be forged', () => {
  it('[WA-ADV-20] an asserted approver that differs from the authenticated principal is refused', () => {
    const rev = submissionAt('REVIEWED');
    assert.equal(code(applySubmissionEvent(rev, { type: 'APPROVE', claimedApprover: PRINCIPAL_1.userId }, ctx())), 'APPROVER_MISMATCH');
  });

  it('[WA-ADV-20] a union principal, an inactive session or a missing professional authorization cannot approve', () => {
    const rev = submissionAt('REVIEWED');
    assert.equal(code(applySubmissionEvent(rev, { type: 'APPROVE', claimedApprover: REP_A.userId }, ctx({ actor: { kind: 'USER', principal: REP_A } }))), 'NOT_PROFESSIONAL');
    const inactive = { ...SPEC_1, sessionActive: false };
    assert.equal(code(applySubmissionEvent(rev, { type: 'APPROVE', claimedApprover: SPEC_1.userId }, ctx({ actor: { kind: 'USER', principal: inactive } }))), 'NOT_PROFESSIONAL');
    const noAuth = { allow: false as const, publicOutcome: 'FORBIDDEN' as const, reason: 'no acceptance' };
    assert.equal(code(applySubmissionEvent(rev, { type: 'APPROVE', claimedApprover: SPEC_1.userId }, ctx({ professionalAuth: noAuth }))), 'AUTHORITY_DENIED');
    assert.equal(code(applySubmissionEvent(rev, { type: 'APPROVE', claimedApprover: SPEC_1.userId }, ctx({ professionalAuth: undefined }))), 'AUTHORITY_DENIED');
  });

  it('a system actor cannot approve, review or dispatch', () => {
    for (const e of [{ type: 'APPROVE', claimedApprover: 'system' }, { type: 'REVIEW' }, { type: 'DISPATCH', requestId: 'r', method: 'm' }] as SubmissionEvent[]) {
      assert.equal(code(applySubmissionEvent(submissionAt('REVIEWED'), e, ctx({ actor: { kind: 'SYSTEM', component: 'DISPATCH_PROVIDER' } }))), 'HUMAN_ACTOR_REQUIRED');
    }
  });

  it('the open decision about separate approvers is configurable, not assumed', () => {
    const rev = submissionAt('REVIEWED');
    const strict = ctx({ policy: { ...policyForSubmissions, approverMustDifferFromPreparer: true } });
    assert.equal(code(applySubmissionEvent(rev, { type: 'APPROVE', claimedApprover: SPEC_1.userId }, strict)), 'SEPARATE_APPROVER_REQUIRED');
    const other = principal('FAKE-WORKAID-STAFF-2', ORG_WA, ['WORKAID_SPECIALIST']);
    assert.equal(applySubmissionEvent(rev, { type: 'APPROVE', claimedApprover: other.userId }, { ...strict, actor: { kind: 'USER', principal: other } }).ok, true);
  });

  it('losing authority invalidates an approval back to REVIEWED (cascade actor only)', () => {
    const approved = submissionAt('APPROVED');
    const r = applySubmissionEvent(approved, { type: 'INVALIDATE_APPROVAL', reason: 'DOA revoked' }, ctx({ actor: { kind: 'SYSTEM', component: 'AUTHORITY_CASCADE' } }));
    assert.equal(r.ok, true);
    assert.equal((r as { value: Submission }).value.state, 'REVIEWED');
    assert.equal((r as { value: Submission }).value.approval, null);
  });
});

void SPEC_2;
void asMatterId;
