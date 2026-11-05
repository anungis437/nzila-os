import { describe, expect, it } from 'vitest';
import {
  assignExecution,
  closeDecision,
  communicateOutcome,
  establishQuorum,
  identifyAuthority,
  proposeDecision,
  recordExecution,
  recordVote,
  satisfyNotice,
  tallyVotes,
  verifyCompletion,
  type DecisionAuthority,
  type DecisionRecord,
  type DecisionResult,
} from '../decision-lifecycle';

const AT = new Date('2026-10-23T12:00:00Z');
const BOARD = ['a', 'b', 'c', 'd', 'e'];
const authority: DecisionAuthority = {
  bodyId: 'exec-board', sourceRef: 'Bylaw 9.2 (test fixture)', memberUserIds: BOARD, quorumRequired: 3, forVotesRequired: 3,
};

function unwrap(r: DecisionResult): DecisionRecord {
  if (!r.ok) throw new Error(`unexpected failure: ${r.error}`);
  return r.decision;
}

function inSession(): DecisionRecord {
  let d = proposeDecision({ id: 'd1', organizationId: 'org-a', title: 'Fixture decision', proposedBy: 'a', at: AT });
  d = unwrap(identifyAuthority(d, authority, 'sec', AT));
  d = unwrap(satisfyNotice(d, 'Notice 2026-10-16 (fixture)', 'sec', AT));
  return unwrap(establishQuorum(d, ['a', 'b', 'c', 'd'], ['d'], 'sec', AT));
}

function adopted(): DecisionRecord {
  let d = inSession();
  for (const u of ['a', 'b', 'c']) d = unwrap(recordVote(d, u, 'for'));
  return unwrap(tallyVotes(d, 'sec', AT));
}

describe('institutional decision lifecycle kernel', () => {
  it('walks every stage with a distinct authoritative state', () => {
    let d = adopted();
    expect(d.stage).toBe('ADOPTED');
    d = unwrap(assignExecution(d, 'owner', 'Delegation D-1 (fixture)', 'sec', AT));
    expect(d.stage).toBe('EXECUTION_ASSIGNED');
    d = unwrap(recordExecution(d, 'owner', ['evidence-1'], AT));
    expect(d.stage).toBe('EXECUTED');
    d = unwrap(verifyCompletion(d, 'trustee', AT));
    expect(d.stage).toBe('VERIFIED');
    d = unwrap(communicateOutcome(d, ['membership'], 'sec', AT));
    d = unwrap(closeDecision(d, ['file follow-up'], 'sec', AT));
    expect(d.stage).toBe('CLOSED');
    expect(d.outstandingObligations).toEqual(['file follow-up']);
    expect(d.history.map((h) => h.stage)).toEqual([
      'PROPOSED', 'AUTHORITY_IDENTIFIED', 'NOTICE_SATISFIED', 'QUORUM_ESTABLISHED',
      'ADOPTED', 'EXECUTION_ASSIGNED', 'EXECUTED', 'VERIFIED', 'COMMUNICATED', 'CLOSED',
    ]);
  });

  it('exposes no way to approve: a proposed decision cannot skip authority, notice, quorum or votes', () => {
    const proposed = proposeDecision({ id: 'd2', organizationId: 'org-a', title: 'x', proposedBy: 'a', at: AT });
    expect(tallyVotes(proposed, 'a', AT).ok).toBe(false);
    expect(assignExecution(proposed, 'a', 'D', 'a', AT).ok).toBe(false);
    expect(recordVote(proposed, 'a', 'for').ok).toBe(false);
    expect(establishQuorum(proposed, BOARD, [], 'a', AT).ok).toBe(false);
  });

  it('requires a governing-instrument reference and a coherent quorum and threshold', () => {
    const p = proposeDecision({ id: 'd3', organizationId: 'org-a', title: 'x', proposedBy: 'a', at: AT });
    expect(identifyAuthority(p, { ...authority, sourceRef: '  ' }, 'a', AT).ok).toBe(false);
    expect(identifyAuthority(p, { ...authority, quorumRequired: 0 }, 'a', AT).ok).toBe(false);
    expect(identifyAuthority(p, { ...authority, quorumRequired: 6 }, 'a', AT).ok).toBe(false);
    expect(identifyAuthority(p, { ...authority, forVotesRequired: 6 }, 'a', AT).ok).toBe(false);
    expect(identifyAuthority(p, { ...authority, memberUserIds: [] }, 'a', AT).ok).toBe(false);
  });

  it('does not establish quorum from non-members or insufficient attendance', () => {
    let d = proposeDecision({ id: 'd4', organizationId: 'org-a', title: 'x', proposedBy: 'a', at: AT });
    d = unwrap(identifyAuthority(d, authority, 's', AT));
    d = unwrap(satisfyNotice(d, 'notice', 's', AT));
    expect(establishQuorum(d, ['a', 'b', 'outsider1', 'outsider2'], [], 's', AT).ok).toBe(false);
    expect(establishQuorum(d, ['a', 'a', 'a'], [], 's', AT).ok).toBe(false);
  });

  it('allows only present, non-recused members to vote, once each', () => {
    const d = inSession();
    expect(recordVote(d, 'e', 'for').ok).toBe(false);
    expect(recordVote(d, 'outsider', 'for').ok).toBe(false);
    expect(recordVote(d, 'd', 'for').ok).toBe(false);
    const once = unwrap(recordVote(d, 'a', 'for'));
    expect(recordVote(once, 'a', 'against').ok).toBe(false);
  });

  it('rejects a decision that does not reach the adoption threshold; a rejection cannot be executed', () => {
    let d = inSession();
    d = unwrap(recordVote(d, 'a', 'for'));
    d = unwrap(recordVote(d, 'b', 'for'));
    d = unwrap(recordVote(d, 'c', 'against'));
    d = unwrap(tallyVotes(d, 's', AT));
    expect(d.stage).toBe('REJECTED');
    expect(assignExecution(d, 'owner', 'D', 's', AT).ok).toBe(false);
  });

  it('keeps adopted distinct from executed: execution needs the assigned owner and evidence', () => {
    const assigned = unwrap(assignExecution(adopted(), 'owner', 'D-1', 's', AT));
    expect(recordExecution(adopted(), 'owner', ['e'], AT).ok).toBe(false);
    expect(recordExecution(assigned, 'someone-else', ['e'], AT).ok).toBe(false);
    expect(recordExecution(assigned, 'owner', [], AT).ok).toBe(false);
    expect(assignExecution(adopted(), 'owner', ' ', 's', AT).ok).toBe(false);
  });

  it('requires independent verification and verification before communication or closure', () => {
    const executed = unwrap(recordExecution(unwrap(assignExecution(adopted(), 'owner', 'D-1', 's', AT)), 'owner', ['e'], AT));
    expect(verifyCompletion(executed, 'owner', AT).ok).toBe(false);
    expect(communicateOutcome(executed, ['membership'], 's', AT).ok).toBe(false);
    expect(closeDecision(executed, [], 's', AT).ok).toBe(false);
    const verified = unwrap(verifyCompletion(executed, 'trustee', AT));
    expect(communicateOutcome(verified, [], 's', AT).ok).toBe(false);
  });

  it('does not mutate the previous record', () => {
    const before = inSession();
    const snapshot = JSON.stringify(before);
    recordVote(before, 'a', 'for');
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});
