/**
 * Claim Workflow FSM — Unit Tests
 *
 * Tests ALL PURE FSM logic:
 *   - validateClaimTransition: state machine enforcement
 *   - getAllowedClaimTransitions: role-filtered available actions
 *   - getTransitionRequirements: per-transition metadata
 *   - SLA calculations (via transition metadata)
 *
 * Tier 2 — Core Business Logic (pure, no mocks)
 */
import { describe, it, expect } from 'vitest';

import {
  validateClaimTransition,
  getAllowedClaimTransitions,
  getTransitionRequirements,
  CLAIM_FSM,
  CLAIM_SLA_STANDARDS,
  type ClaimTransitionContext,
  type ClaimStatus,
} from '../services/claim-workflow-fsm';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeContext(overrides: Partial<ClaimTransitionContext>): ClaimTransitionContext {
  return {
    claimId: 'claim-001',
    currentStatus: 'submitted',
    targetStatus: 'under_review',
    userId: 'user-steward',
    userRole: 'steward',
    priority: 'medium',
    statusChangedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    hasUnresolvedCriticalSignals: false,
    hasRequiredDocumentation: true,
    ...overrides,
  };
}

// ─── CLAIM_FSM structure ─────────────────────────────────────────────────────

describe('CLAIM_FSM structure', () => {
  const ALL_STATES: ClaimStatus[] = [
    'submitted', 'under_review', 'assigned', 'investigation',
    'pending_documentation', 'resolved', 'rejected', 'closed',
  ];

  it('defines all 8 states', () => {
    for (const state of ALL_STATES) {
      expect(CLAIM_FSM).toHaveProperty(state);
    }
  });

  it('closed is a terminal state with no transitions', () => {
    expect(CLAIM_FSM.closed.allowedTransitions).toHaveLength(0);
  });

  it('every transition target is a valid state', () => {
    for (const [, state] of Object.entries(CLAIM_FSM)) {
      for (const target of state.allowedTransitions) {
        expect(ALL_STATES).toContain(target);
      }
    }
  });

  it('every transition has role requirements defined', () => {
    for (const [, state] of Object.entries(CLAIM_FSM)) {
      for (const target of state.allowedTransitions) {
        const roles = state.requiresRole[target];
        expect(Array.isArray(roles), `Missing role definition for transition to ${target}`).toBe(true);
        expect(roles.length).toBeGreaterThan(0);
      }
    }
  });
});

// ─── validateClaimTransition ─────────────────────────────────────────────────

describe('validateClaimTransition', () => {
  describe('valid transitions', () => {
    it('allows submitted → under_review for steward', () => {
      const result = validateClaimTransition(makeContext({
        currentStatus: 'submitted',
        targetStatus: 'under_review',
        userRole: 'steward',
      }));
      expect(result.allowed).toBe(true);
    });

    it('allows submitted → assigned for admin', () => {
      const result = validateClaimTransition(makeContext({
        currentStatus: 'submitted',
        targetStatus: 'assigned',
        userRole: 'admin',
      }));
      expect(result.allowed).toBe(true);
    });

    it('allows submitted → rejected for admin', () => {
      const result = validateClaimTransition(makeContext({
        currentStatus: 'submitted',
        targetStatus: 'rejected',
        userRole: 'admin',
      }));
      expect(result.allowed).toBe(true);
    });

    it('allows resolved → closed for admin', () => {
      const result = validateClaimTransition(makeContext({
        currentStatus: 'resolved',
        targetStatus: 'closed',
        userRole: 'admin',
        hasRequiredDocumentation: true,
      }));
      expect(result.allowed).toBe(true);
    });

    it('system role bypasses role checks', () => {
      const result = validateClaimTransition(makeContext({
        currentStatus: 'submitted',
        targetStatus: 'rejected',
        userRole: 'system', // normally only admin can reject submitted
      }));
      expect(result.allowed).toBe(true);
    });
  });

  describe('invalid transitions', () => {
    it('rejects transition to non-adjacent state', () => {
      const result = validateClaimTransition(makeContext({
        currentStatus: 'submitted',
        targetStatus: 'closed', // submitted cannot go to closed
      }));
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Invalid transition');
    });

    it('rejects transition from closed (terminal state)', () => {
      const result = validateClaimTransition(makeContext({
        currentStatus: 'closed',
        targetStatus: 'submitted',
        userRole: 'admin',
      }));
      expect(result.allowed).toBe(false);
    });
  });

  describe('role enforcement', () => {
    it('rejects rejected claim → closed by member (admin required)', () => {
      const result = validateClaimTransition(makeContext({
        currentStatus: 'rejected',
        targetStatus: 'closed',
        userRole: 'member',
        hasRequiredDocumentation: true,
      }));
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not authorized');
    });

    it('rejects submitted → rejected by steward (admin required)', () => {
      const result = validateClaimTransition(makeContext({
        currentStatus: 'submitted',
        targetStatus: 'rejected',
        userRole: 'steward',
      }));
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not authorized');
    });

    it('defaults to member role when userRole omitted', () => {
      const result = validateClaimTransition(makeContext({
        currentStatus: 'submitted',
        targetStatus: 'under_review',
        userRole: undefined, // defaults to 'member'
      }));
      expect(result.allowed).toBe(false); // members can't review
    });
  });

  describe('minimum time-in-state enforcement', () => {
    it('blocks under_review → investigation before 24h', () => {
      const result = validateClaimTransition(makeContext({
        currentStatus: 'under_review',
        targetStatus: 'investigation',
        userRole: 'admin',
        statusChangedAt: new Date(), // just now
      }));
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('minimum duration');
    });

    it('allows under_review → investigation after 24h', () => {
      const result = validateClaimTransition(makeContext({
        currentStatus: 'under_review',
        targetStatus: 'investigation',
        userRole: 'admin',
        statusChangedAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25h ago
      }));
      expect(result.allowed).toBe(true);
    });

    it('blocks investigation → resolved before 3 days', () => {
      const result = validateClaimTransition(makeContext({
        currentStatus: 'investigation',
        targetStatus: 'resolved',
        userRole: 'admin',
        statusChangedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        hasRequiredDocumentation: true,
      }));
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('minimum duration');
    });

    it('submitted has 0 minimum time', () => {
      const result = validateClaimTransition(makeContext({
        currentStatus: 'submitted',
        targetStatus: 'under_review',
        userRole: 'admin',
        statusChangedAt: new Date(), // just now
      }));
      expect(result.allowed).toBe(true);
    });
  });

  describe('documentation enforcement', () => {
    it('blocks investigation transitions without docs or notes', () => {
      const result = validateClaimTransition(makeContext({
        currentStatus: 'investigation',
        targetStatus: 'resolved',
        userRole: 'admin',
        hasRequiredDocumentation: false,
        notes: undefined,
      }));
      // Blocked by either time *or* docs. Since we set statusChangedAt 7 days ago, time is fine.
      // Check for documentation blocking
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('documentation');
    });

    it('allows investigation with notes instead of documentation', () => {
      const result = validateClaimTransition(makeContext({
        currentStatus: 'investigation',
        targetStatus: 'resolved',
        userRole: 'admin',
        hasRequiredDocumentation: false,
        notes: 'Investigation completed, resolution agreed upon.',
      }));
      expect(result.allowed).toBe(true);
    });
  });

  describe('critical signal blocking', () => {
    it('blocks resolved → closed when critical signals exist', () => {
      const result = validateClaimTransition(makeContext({
        currentStatus: 'resolved',
        targetStatus: 'closed',
        userRole: 'admin',
        hasUnresolvedCriticalSignals: true,
        hasRequiredDocumentation: true,
      }));
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('critical signals');
    });

    it('blocks rejected → closed when critical signals exist', () => {
      const result = validateClaimTransition(makeContext({
        currentStatus: 'rejected',
        targetStatus: 'closed',
        userRole: 'admin',
        hasUnresolvedCriticalSignals: true,
        hasRequiredDocumentation: true,
      }));
      expect(result.allowed).toBe(false);
    });

    it('does not block non-terminal transitions even with signals', () => {
      const result = validateClaimTransition(makeContext({
        currentStatus: 'submitted',
        targetStatus: 'under_review',
        userRole: 'admin',
        hasUnresolvedCriticalSignals: true,
      }));
      expect(result.allowed).toBe(true);
    });
  });

  describe('SLA metadata', () => {
    it('includes SLA compliance info on allowed transitions', () => {
      const result = validateClaimTransition(makeContext({
        currentStatus: 'submitted',
        targetStatus: 'under_review',
        userRole: 'admin',
      }));
      expect(result.allowed).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(result.metadata).toHaveProperty('slaCompliant');
      expect(result.metadata).toHaveProperty('daysInState');
    });

    it('warns when SLA is breached', () => {
      const result = validateClaimTransition(makeContext({
        currentStatus: 'submitted',
        targetStatus: 'under_review',
        userRole: 'admin',
        statusChangedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        priority: 'medium',
      }));
      expect(result.allowed).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings!.some(w => w.includes('SLA BREACH'))).toBe(true);
    });
  });
});

// ─── getAllowedClaimTransitions ───────────────────────────────────────────────

describe('getAllowedClaimTransitions', () => {
  it('returns all transitions for system role', () => {
    const transitions = getAllowedClaimTransitions('submitted', 'system');
    expect(transitions).toEqual(
      expect.arrayContaining(['under_review', 'assigned', 'rejected']),
    );
  });

  it('steward can review and assign submitted claims', () => {
    const transitions = getAllowedClaimTransitions('submitted', 'steward');
    expect(transitions).toContain('under_review');
    expect(transitions).toContain('assigned');
  });

  it('steward cannot reject submitted claims (admin only)', () => {
    const transitions = getAllowedClaimTransitions('submitted', 'steward');
    expect(transitions).not.toContain('rejected');
  });

  it('member gets no transitions for submitted claims', () => {
    const transitions = getAllowedClaimTransitions('submitted', 'member');
    expect(transitions).toHaveLength(0);
  });

  it('admin can reject submitted claims', () => {
    const transitions = getAllowedClaimTransitions('submitted', 'admin');
    expect(transitions).toContain('rejected');
  });

  it('closed state has no transitions for anyone', () => {
    expect(getAllowedClaimTransitions('closed', 'admin')).toHaveLength(0);
    expect(getAllowedClaimTransitions('closed', 'system')).toHaveLength(0);
  });
});

// ─── getTransitionRequirements ──────────────────────────────────────────────

describe('getTransitionRequirements', () => {
  it('returns role requirements for submitted → rejected', () => {
    const req = getTransitionRequirements('submitted', 'rejected');
    expect(req.requiresRole).toContain('admin');
    expect(req.requiresRole).not.toContain('member');
  });

  it('returns 0 min hours for submitted', () => {
    const req = getTransitionRequirements('submitted', 'under_review');
    expect(req.minHours).toBe(0);
  });

  it('returns 24 min hours for under_review', () => {
    const req = getTransitionRequirements('under_review', 'investigation');
    expect(req.minHours).toBe(24);
  });

  it('returns 72 min hours (3 days) for investigation', () => {
    const req = getTransitionRequirements('investigation', 'resolved');
    expect(req.minHours).toBe(72);
  });

  it('resolved requires docs and blocks critical signals', () => {
    const req = getTransitionRequirements('resolved', 'closed');
    expect(req.requiresDocumentation).toBe(true);
    expect(req.blockIfCriticalSignals).toBe(true);
  });

  it('submitted does NOT block critical signals', () => {
    const req = getTransitionRequirements('submitted', 'under_review');
    expect(req.blockIfCriticalSignals).toBe(false);
  });
});

// ─── SLA Standards ──────────────────────────────────────────────────────────

describe('CLAIM_SLA_STANDARDS', () => {
  it('submitted SLA is 48 hours', () => {
    expect(CLAIM_SLA_STANDARDS.submitted).toBe(48);
  });

  it('under_review SLA is 120 hours (5 days)', () => {
    expect(CLAIM_SLA_STANDARDS.under_review).toBe(120);
  });

  it('investigation SLA is 240 hours (10 days)', () => {
    expect(CLAIM_SLA_STANDARDS.investigation).toBe(240);
  });

  it('closed SLA is 0 (terminal)', () => {
    expect(CLAIM_SLA_STANDARDS.closed).toBe(0);
  });
});
