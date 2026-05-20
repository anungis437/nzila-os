/**
 * Case Lifecycle FSM — SLA + reverse-transition guard tests
 *
 * Covers PR-022/023 acceptance criteria:
 *  - Server-side enforcement of role hierarchy on every transition
 *  - SLA breach warnings surface on the validateTransition path
 *  - "closed" state only reopenable by system_admin (audit-only reverse path)
 *  - Cooling-off / minimum-time guards prevent premature closure
 */

import { describe, expect, it } from 'vitest';

import {
  getAllowedTransitions,
  getSLADeadlineHours,
  validateTransition,
  type TransitionContext,
} from '../case-lifecycle';

function ctx(overrides: Partial<TransitionContext>): TransitionContext {
  return {
    actorRole: 'steward',
    caseId: 'case-1',
    currentState: 'submitted',
    targetState: 'triage',
    priority: 'medium',
    statusChangedAt: new Date(),
    hasRequiredDocumentation: true,
    hasUnresolvedCriticalSignals: false,
    ...overrides,
  };
}

describe('case-lifecycle FSM — role hierarchy', () => {
  it('rejects member from advancing past draft → submitted', () => {
    const result = validateTransition(
      ctx({ actorRole: 'member', currentState: 'submitted', targetState: 'triage' }),
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/steward.*or higher/i);
  });

  it('allows steward to triage → investigation when assignment present', () => {
    const result = validateTransition(
      ctx({
        currentState: 'triage',
        targetState: 'investigation',
        assignedTo: 'steward-42',
      }),
    );
    expect(result.allowed).toBe(true);
  });

  it('blocks triage → investigation without steward assignment', () => {
    const result = validateTransition(
      ctx({
        currentState: 'triage',
        targetState: 'investigation',
        assignedTo: null,
      }),
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/steward must be assigned/i);
  });

  it('requires officer (not steward) for negotiation → mediation', () => {
    const stewardAttempt = validateTransition(
      ctx({ currentState: 'negotiation', targetState: 'mediation', actorRole: 'steward' }),
    );
    expect(stewardAttempt.allowed).toBe(false);

    const officerAttempt = validateTransition(
      ctx({ currentState: 'negotiation', targetState: 'mediation', actorRole: 'officer' }),
    );
    expect(officerAttempt.allowed).toBe(true);
  });
});

describe('case-lifecycle FSM — closure guards (PR-023)', () => {
  it('blocks resolved → closed without required documentation', () => {
    const result = validateTransition(
      ctx({
        actorRole: 'admin',
        currentState: 'resolved',
        targetState: 'closed',
        statusChangedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        hasRequiredDocumentation: false,
      }),
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/documentation/i);
  });

  it('blocks resolved → closed with unresolved critical signals', () => {
    const result = validateTransition(
      ctx({
        actorRole: 'admin',
        currentState: 'resolved',
        targetState: 'closed',
        statusChangedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        hasUnresolvedCriticalSignals: true,
      }),
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/critical signals/i);
  });

  it('enforces 7-day cooling-off period before resolved → closed', () => {
    const result = validateTransition(
      ctx({
        actorRole: 'admin',
        currentState: 'resolved',
        targetState: 'closed',
        statusChangedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      }),
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/minimum time/i);
  });

  it('allows resolved → closed after cooling-off with docs and no critical signals', () => {
    const result = validateTransition(
      ctx({
        actorRole: 'admin',
        currentState: 'resolved',
        targetState: 'closed',
        statusChangedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      }),
    );
    expect(result.allowed).toBe(true);
  });
});

describe('case-lifecycle FSM — reverse transitions (closed reopen)', () => {
  it('forbids steward from reopening a closed case', () => {
    const result = validateTransition(
      ctx({
        actorRole: 'steward',
        currentState: 'closed',
        targetState: 'triage',
      }),
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/system_admin/i);
  });

  it('forbids admin from reopening a closed case (system_admin only)', () => {
    const result = validateTransition(
      ctx({
        actorRole: 'admin',
        currentState: 'closed',
        targetState: 'triage',
      }),
    );
    expect(result.allowed).toBe(false);
  });

  it('allows system_admin to reopen closed → triage for audit', () => {
    const result = validateTransition(
      ctx({
        actorRole: 'system_admin',
        currentState: 'closed',
        targetState: 'triage',
      }),
    );
    expect(result.allowed).toBe(true);
  });

  it('still forbids reopening closed → anything other than triage', () => {
    const result = validateTransition(
      ctx({
        actorRole: 'system_admin',
        currentState: 'closed',
        targetState: 'investigation',
      }),
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/cannot transition/i);
  });
});

describe('case-lifecycle FSM — SLA breach warnings (PR-023)', () => {
  it('emits SLA-breach warning when days-in-state exceeds priority limit', () => {
    const result = validateTransition(
      ctx({
        currentState: 'submitted',
        targetState: 'triage',
        priority: 'critical',
        statusChangedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      }),
    );
    expect(result.allowed).toBe(true);
    expect(result.warnings).toBeDefined();
    expect(result.warnings?.some((w) => /sla breached/i.test(w))).toBe(true);
    expect(result.metadata?.slaCompliant).toBe(false);
  });

  it('marks slaCompliant=true when within priority window', () => {
    const result = validateTransition(
      ctx({
        currentState: 'submitted',
        targetState: 'triage',
        priority: 'low',
        statusChangedAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
      }),
    );
    expect(result.metadata?.slaCompliant).toBe(true);
    expect(result.warnings).toBeUndefined();
  });

  it('exposes correct next-deadline for the target state', () => {
    const before = Date.now();
    const result = validateTransition(
      ctx({
        currentState: 'submitted',
        targetState: 'triage',
        priority: 'high',
      }),
    );
    const after = Date.now();
    const expectedHours = getSLADeadlineHours('triage', 'high');
    expect(result.metadata?.nextDeadline).toBeDefined();
    const deadlineMs = result.metadata!.nextDeadline!.getTime();
    expect(deadlineMs).toBeGreaterThanOrEqual(before + expectedHours * 3600_000 - 10);
    expect(deadlineMs).toBeLessThanOrEqual(after + expectedHours * 3600_000 + 10);
  });

  it('omits nextDeadline for terminal states (Infinity SLA)', () => {
    const result = validateTransition(
      ctx({
        actorRole: 'admin',
        currentState: 'resolved',
        targetState: 'closed',
        statusChangedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      }),
    );
    expect(result.metadata?.nextDeadline).toBeUndefined();
  });
});

describe('case-lifecycle FSM — getAllowedTransitions', () => {
  it('returns only role-permitted targets for steward in negotiation', () => {
    const allowed = getAllowedTransitions('negotiation', 'steward');
    expect(allowed).toContain('investigation');
    expect(allowed).toContain('resolved');
    expect(allowed).not.toContain('mediation');
    expect(allowed).not.toContain('arbitration');
    expect(allowed).not.toContain('closed');
  });

  it('returns triage as only allowed target from closed for system_admin', () => {
    expect(getAllowedTransitions('closed', 'system_admin')).toEqual(['triage']);
  });

  it('returns empty list from closed for non-system_admin', () => {
    expect(getAllowedTransitions('closed', 'admin')).toEqual([]);
    expect(getAllowedTransitions('closed', 'steward')).toEqual([]);
  });
});
