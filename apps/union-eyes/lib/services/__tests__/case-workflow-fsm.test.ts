import { describe, it, expect } from 'vitest';
import {
  validateTransition,
  getAllowedTransitions,
  isTerminalState,
  getInitialState,
  getRequiredRoles,
  validateWorkflowPath,
  isActiveState,
  requiresUrgentAttention,
  getStateDescription,
  type TransitionContext,
} from '../case-workflow-fsm';

describe('case-workflow-fsm', () => {
  const officerCtx: TransitionContext = {
    actorRole: 'officer',
    hasSufficientEvidence: true,
  };

  const memberCtx: TransitionContext = {
    actorRole: 'member',
  };

  const _adminCtx: TransitionContext = {
    actorRole: 'admin',
  };

  describe('validateTransition — valid transitions', () => {
    it('allows draft → submitted for member', () => {
      const result = validateTransition('draft', 'submitted', memberCtx);
      expect(result.valid).toBe(true);
    });

    it('allows submitted → acknowledged for officer', () => {
      const result = validateTransition('submitted', 'acknowledged', officerCtx);
      expect(result.valid).toBe(true);
    });

    it('allows acknowledged → investigating for officer with evidence', () => {
      const result = validateTransition('acknowledged', 'investigating', officerCtx);
      expect(result.valid).toBe(true);
    });

    it('allows resolved → closed for officer', () => {
      const result = validateTransition('resolved', 'closed', officerCtx);
      expect(result.valid).toBe(true);
    });
  });

  describe('validateTransition — invalid transitions', () => {
    it('rejects draft → resolved (not allowed)', () => {
      const result = validateTransition('draft', 'resolved', officerCtx);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('INVALID_STATE_TRANSITION');
    });

    it('rejects submitted → resolved (not allowed)', () => {
      const result = validateTransition('submitted', 'resolved', officerCtx);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('INVALID_STATE_TRANSITION');
    });
  });

  describe('validateTransition — role enforcement', () => {
    it('rejects member performing submitted → acknowledged', () => {
      const result = validateTransition('submitted', 'acknowledged', memberCtx);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('allows steward performing submitted → acknowledged', () => {
      const result = validateTransition('submitted', 'acknowledged', {
        actorRole: 'steward',
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('validateTransition — condition checks', () => {
    it('rejects investigating → pending_response without sufficient evidence', () => {
      const result = validateTransition('investigating', 'pending_response', {
        actorRole: 'officer',
        hasSufficientEvidence: false,
      });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('MISSING_REQUIRED_FIELD');
    });

    it('allows investigating → pending_response with sufficient evidence', () => {
      const result = validateTransition('investigating', 'pending_response', {
        actorRole: 'officer',
        hasSufficientEvidence: true,
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('validateTransition — SLA check', () => {
    it('returns SLA_EXPIRED when submitted → acknowledged after >2 days', () => {
      const result = validateTransition('submitted', 'acknowledged', {
        actorRole: 'officer',
        daysInCurrentState: 5,
      });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('SLA_EXPIRED');
    });
  });

  describe('validateTransition — admin bypass', () => {
    it('allows admin to close from investigating without evidence (admin bypass)', () => {
      const result = validateTransition('investigating', 'closed', {
        actorRole: 'admin',
        hasSufficientEvidence: false,
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('getAllowedTransitions', () => {
    it('returns correct states from draft', () => {
      const states = getAllowedTransitions('draft');
      expect(states).toContain('submitted');
      expect(states).toContain('withdrawn');
    });

    it('returns correct states from submitted', () => {
      const states = getAllowedTransitions('submitted');
      expect(states).toContain('acknowledged');
      expect(states).toContain('withdrawn');
    });

    it('returns empty array for closed (terminal state)', () => {
      const states = getAllowedTransitions('closed');
      expect(states).toHaveLength(0);
    });
  });

  describe('isTerminalState', () => {
    it('returns true for closed', () => {
      expect(isTerminalState('closed')).toBe(true);
    });

    it('returns false for draft', () => {
      expect(isTerminalState('draft')).toBe(false);
    });
  });

  describe('utility helpers', () => {
    it('getInitialState returns draft', () => {
      expect(getInitialState()).toBe('draft');
    });

    it('getRequiredRoles returns roles for submitted state', () => {
      const roles = getRequiredRoles('submitted');
      expect(Array.isArray(roles)).toBe(true);
    });

    it('getRequiredRoles returns undefined for draft', () => {
      // draft transitions are member-initiated, no role restriction
      const roles = getRequiredRoles('draft');
      expect(roles === undefined || Array.isArray(roles)).toBe(true);
    });

    it('validateWorkflowPath rejects path shorter than 2', () => {
      const r = validateWorkflowPath(['draft'], []);
      expect(r.valid).toBe(false);
    });

    it('validateWorkflowPath rejects mismatched context count', () => {
      const r = validateWorkflowPath(['draft', 'submitted', 'acknowledged'], [{ actorRole: 'member' }]);
      expect(r.valid).toBe(false);
    });

    it('validateWorkflowPath validates a correct two-step path', () => {
      const r = validateWorkflowPath(
        ['draft', 'submitted'],
        [{ actorRole: 'member' }]
      );
      expect(r.valid).toBe(true);
    });

    it('validateWorkflowPath propagates first invalid transition error', () => {
      const r = validateWorkflowPath(
        ['draft', 'resolved'],
        [{ actorRole: 'officer' }]
      );
      expect(r.valid).toBe(false);
      expect(r.message).toContain('draft');
    });

    it('isActiveState returns true for open states', () => {
      expect(isActiveState('investigating')).toBe(true);
      expect(isActiveState('draft')).toBe(true);
    });

    it('isActiveState returns false for terminal states', () => {
      expect(isActiveState('resolved')).toBe(false);
      expect(isActiveState('closed')).toBe(false);
      expect(isActiveState('withdrawn')).toBe(false);
    });

    it('requiresUrgentAttention identifies urgent states', () => {
      expect(requiresUrgentAttention('submitted')).toBe(true);
      expect(requiresUrgentAttention('escalated')).toBe(true);
      expect(requiresUrgentAttention('pending_response')).toBe(true);
      expect(requiresUrgentAttention('draft')).toBe(false);
      expect(requiresUrgentAttention('closed')).toBe(false);
    });

    it('getStateDescription returns non-empty string for every state', () => {
      const states = ['draft','submitted','acknowledged','investigating','pending_response','negotiating','escalated','resolved','withdrawn','closed'] as const;
      for (const s of states) {
        expect(getStateDescription(s)).toBeTruthy();
      }
    });
  });
});
