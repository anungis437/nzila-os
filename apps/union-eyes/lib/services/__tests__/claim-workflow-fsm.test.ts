import { describe, it, expect } from 'vitest';
import {
  CLAIM_FSM,
  CLAIM_SLA_STANDARDS,
  validateClaimTransition,
  getAllowedClaimTransitions,
  getTransitionRequirements,
  type ClaimTransitionContext,
} from '../claim-workflow-fsm';

describe('claim-workflow-fsm', () => {
  const now = new Date();

  function makeContext(overrides: Partial<ClaimTransitionContext> = {}): ClaimTransitionContext {
    return {
      claimId: 'CLM-001',
      currentStatus: 'submitted',
      targetStatus: 'under_review',
      userId: 'user-1',
      userRole: 'steward',
      priority: 'medium',
      statusChangedAt: new Date(now.getTime() - 48 * 60 * 60 * 1000), // 2 days ago
      hasUnresolvedCriticalSignals: false,
      hasRequiredDocumentation: true,
      notes: 'Transition notes',
      ...overrides,
    };
  }

  describe('CLAIM_FSM structure', () => {
    it('has all expected states', () => {
      const states = Object.keys(CLAIM_FSM);
      expect(states).toContain('submitted');
      expect(states).toContain('under_review');
      expect(states).toContain('assigned');
      expect(states).toContain('investigation');
      expect(states).toContain('pending_documentation');
      expect(states).toContain('resolved');
      expect(states).toContain('rejected');
      expect(states).toContain('closed');
    });

    it('closed has no allowed transitions', () => {
      expect(CLAIM_FSM.closed.allowedTransitions).toHaveLength(0);
    });
  });

  describe('CLAIM_SLA_STANDARDS', () => {
    it('has correct SLA hours for submitted', () => {
      expect(CLAIM_SLA_STANDARDS.submitted).toBe(48);
    });

    it('has correct SLA hours for investigation', () => {
      expect(CLAIM_SLA_STANDARDS.investigation).toBe(240);
    });

    it('has zero SLA for closed', () => {
      expect(CLAIM_SLA_STANDARDS.closed).toBe(0);
    });
  });

  describe('validateClaimTransition — valid transitions', () => {
    it('allows submitted → under_review for steward', () => {
      const result = validateClaimTransition(makeContext());
      expect(result.allowed).toBe(true);
    });

    it('allows submitted → assigned for admin', () => {
      const result = validateClaimTransition(
        makeContext({ targetStatus: 'assigned', userRole: 'admin' })
      );
      expect(result.allowed).toBe(true);
    });
  });

  describe('validateClaimTransition — invalid transitions', () => {
    it('rejects submitted → closed (not a valid transition)', () => {
      const result = validateClaimTransition(
        makeContext({ targetStatus: 'closed' })
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Invalid transition');
    });

    it('rejects submitted → investigation (not directly allowed)', () => {
      const result = validateClaimTransition(
        makeContext({ targetStatus: 'investigation' })
      );
      expect(result.allowed).toBe(false);
    });
  });

  describe('validateClaimTransition — role enforcement', () => {
    it('rejects member performing submitted → under_review', () => {
      const result = validateClaimTransition(
        makeContext({ userRole: 'member' })
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not authorized');
    });

    it('allows system role for any transition', () => {
      const result = validateClaimTransition(
        makeContext({ userRole: 'system' })
      );
      expect(result.allowed).toBe(true);
    });
  });

  describe('validateClaimTransition — minTimeInState', () => {
    it('rejects under_review → investigation when minimum time not met', () => {
      const result = validateClaimTransition(
        makeContext({
          currentStatus: 'under_review',
          targetStatus: 'investigation',
          userRole: 'steward',
          statusChangedAt: new Date(), // just now — 24h min not met
        })
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('minimum duration');
    });
  });

  describe('validateClaimTransition — critical signal blocking', () => {
    it('blocks resolved → closed when critical signals unresolved', () => {
      const sevenDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
      const result = validateClaimTransition(
        makeContext({
          currentStatus: 'resolved',
          targetStatus: 'closed',
          userRole: 'admin',
          statusChangedAt: sevenDaysAgo,
          hasUnresolvedCriticalSignals: true,
          hasRequiredDocumentation: true,
        })
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('critical signals');
    });
  });

  describe('getAllowedClaimTransitions', () => {
    it('returns transitions for submitted filtered by role', () => {
      const transitions = getAllowedClaimTransitions('submitted', 'steward');
      expect(transitions).toContain('under_review');
      expect(transitions).toContain('assigned');
      expect(transitions).not.toContain('rejected'); // admin only
    });

    it('returns empty array for closed', () => {
      const transitions = getAllowedClaimTransitions('closed', 'admin');
      expect(transitions).toHaveLength(0);
    });
  });

  /* ── Batch 32: branch gap-fill ── */

  describe('getTransitionRequirements', () => {
    it('returns requirements for submitted → under_review', () => {
      const req = getTransitionRequirements('submitted', 'under_review');
      expect(req.requiresRole).toEqual(['steward', 'admin', 'system']);
      expect(req.minHours).toBe(0);
      expect(req.requiresDocumentation).toBe(false);
      expect(req.blockIfCriticalSignals).toBe(false);
    });

    it('returns requirements for resolved → closed', () => {
      const req = getTransitionRequirements('resolved', 'closed');
      expect(req.requiresRole).toEqual(['admin', 'system']);
      expect(req.minHours).toBe(168); // 7 days
      expect(req.requiresDocumentation).toBe(true);
      expect(req.blockIfCriticalSignals).toBe(true);
    });

    it('returns default ["member"] role for unknown target status', () => {
      const req = getTransitionRequirements('submitted', 'closed' as any);
      expect(req.requiresRole).toEqual(['member']);
    });

    it('returns requirements for investigation state', () => {
      const req = getTransitionRequirements('investigation', 'pending_documentation');
      expect(req.minHours).toBe(72); // 3 days
      expect(req.requiresDocumentation).toBe(true);
    });
  });

  describe('validateClaimTransition (expanded branches)', () => {
    it('blocks transitions not in allowedTransitions list', () => {
      const result = validateClaimTransition({
        claimId: 'c-1',
        currentStatus: 'closed',
        targetStatus: 'submitted',
        userId: 'u-1',
        userRole: 'admin',
        priority: 'medium',
        statusChangedAt: new Date(0),
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Invalid transition');
    });

    it('blocks role-unauthorized transitions', () => {
      const result = validateClaimTransition({
        claimId: 'c-1',
        currentStatus: 'submitted',
        targetStatus: 'rejected',
        userId: 'u-1',
        userRole: 'member',
        priority: 'medium',
        statusChangedAt: new Date(0),
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not authorized');
    });

    it('allows system role to bypass role restrictions', () => {
      const result = validateClaimTransition({
        claimId: 'c-1',
        currentStatus: 'submitted',
        targetStatus: 'rejected',
        userId: 'u-1',
        userRole: 'system',
        priority: 'medium',
        statusChangedAt: new Date(0),
      });
      expect(result.allowed).toBe(true);
    });

    it('blocks transition when minimum time has not elapsed', () => {
      const result = validateClaimTransition({
        claimId: 'c-1',
        currentStatus: 'under_review',
        targetStatus: 'investigation',
        userId: 'u-1',
        userRole: 'admin',
        priority: 'medium',
        statusChangedAt: new Date(), // just now — min 24h required
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('minimum duration');
    });

    it('blocks transition when documentation required but missing', () => {
      const result = validateClaimTransition({
        claimId: 'c-1',
        currentStatus: 'investigation',
        targetStatus: 'resolved',
        userId: 'u-1',
        userRole: 'admin',
        priority: 'medium',
        statusChangedAt: new Date(0), // plenty of time
        hasRequiredDocumentation: false,
        // no notes
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('documentation');
    });

    it('allows transition when documentation missing but notes provided', () => {
      const result = validateClaimTransition({
        claimId: 'c-1',
        currentStatus: 'investigation',
        targetStatus: 'resolved',
        userId: 'u-1',
        userRole: 'admin',
        priority: 'medium',
        statusChangedAt: new Date(0),
        hasRequiredDocumentation: false,
        notes: 'Resolved verbally with member.',
      });
      expect(result.allowed).toBe(true);
    });

    it('blocks closure when critical signals are unresolved', () => {
      const result = validateClaimTransition({
        claimId: 'c-1',
        currentStatus: 'resolved',
        targetStatus: 'closed',
        userId: 'u-1',
        userRole: 'admin',
        priority: 'medium',
        statusChangedAt: new Date(0),
        hasRequiredDocumentation: true,
        hasUnresolvedCriticalSignals: true,
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('critical signals');
    });

    it('adds SLA breach warning on allowed transition', () => {
      const result = validateClaimTransition({
        claimId: 'c-1',
        currentStatus: 'submitted',
        targetStatus: 'under_review',
        userId: 'u-1',
        userRole: 'admin',
        priority: 'medium',
        statusChangedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago → SLA breached
      });
      expect(result.allowed).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings!.some((w) => w.includes('SLA'))).toBe(true);
    });

    it('returns metadata with slaCompliant and daysInState', () => {
      const result = validateClaimTransition({
        claimId: 'c-1',
        currentStatus: 'submitted',
        targetStatus: 'under_review',
        userId: 'u-1',
        userRole: 'admin',
        priority: 'low',
        statusChangedAt: new Date(0),
        hasRequiredDocumentation: true,
      });
      expect(result.allowed).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(typeof result.metadata!.daysInState).toBe('number');
      expect(typeof result.metadata!.slaCompliant).toBe('boolean');
    });

    it('getAllowedClaimTransitions allows system role everywhere', () => {
      const transitions = getAllowedClaimTransitions('submitted', 'system');
      expect(transitions).toContain('under_review');
      expect(transitions).toContain('assigned');
      expect(transitions).toContain('rejected');
    });
  });
});
