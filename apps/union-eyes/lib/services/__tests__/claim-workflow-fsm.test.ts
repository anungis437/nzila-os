import { describe, it, expect } from 'vitest';
import {
  CLAIM_FSM,
  CLAIM_SLA_STANDARDS,
  validateClaimTransition,
  getAllowedClaimTransitions,
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
});
