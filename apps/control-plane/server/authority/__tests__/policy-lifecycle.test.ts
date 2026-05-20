import { describe, it, expect } from 'vitest'
import {
  validateTransition,
  canTransitionTo,
  getPermittedTransitions,
  isTerminalState,
  isPublicState,
  isOperationalState,
  isRetiredState,
  isPendingHumanAction,
  lifecycleStateLabel,
  POLICY_LIFECYCLE_STATES,
  type PolicyLifecycleState,
} from '../policy-lifecycle'

describe('policy-lifecycle FSM', () => {
  describe('POLICY_LIFECYCLE_STATES', () => {
    it('contains all 10 states', () => {
      expect(POLICY_LIFECYCLE_STATES).toHaveLength(10)
      expect(POLICY_LIFECYCLE_STATES).toContain('draft')
      expect(POLICY_LIFECYCLE_STATES).toContain('active')
      expect(POLICY_LIFECYCLE_STATES).toContain('archived')
    })
  })

  describe('validateTransition', () => {
    it('allows draft → review_pending', () => {
      expect(() => validateTransition('draft', 'review_pending')).not.toThrow()
    })

    it('allows active → revoked', () => {
      expect(() => validateTransition('active', 'revoked')).not.toThrow()
    })

    it('throws on invalid transition draft → active', () => {
      expect(() => validateTransition('draft', 'active')).toThrow('INVALID_LIFECYCLE_TRANSITION')
    })

    it('throws on backward transition active → draft', () => {
      expect(() => validateTransition('active', 'draft')).toThrow('INVALID_LIFECYCLE_TRANSITION')
    })

    it('throws on transition from terminal state archived → draft', () => {
      expect(() => validateTransition('archived', 'draft')).toThrow('INVALID_LIFECYCLE_TRANSITION')
    })

    it('allows any live state → revoked', () => {
      const liveStates: PolicyLifecycleState[] = ['draft', 'review_pending', 'approval_required', 'approved', 'published', 'active']
      for (const s of liveStates) {
        expect(() => validateTransition(s, 'revoked')).not.toThrow()
      }
    })
  })

  describe('canTransitionTo', () => {
    it('returns true for valid transitions', () => {
      expect(canTransitionTo('draft', 'review_pending')).toBe(true)
      expect(canTransitionTo('review_pending', 'approval_required')).toBe(true)
    })

    it('returns false for invalid transitions', () => {
      expect(canTransitionTo('draft', 'active')).toBe(false)
      expect(canTransitionTo('archived', 'draft')).toBe(false)
    })
  })

  describe('getPermittedTransitions', () => {
    it('draft can transition to review_pending and revoked', () => {
      const permitted = getPermittedTransitions('draft')
      expect(permitted).toContain('review_pending')
      expect(permitted).toContain('revoked')
    })

    it('archived has no permitted transitions', () => {
      const permitted = getPermittedTransitions('archived')
      expect(permitted).toHaveLength(0)
    })
  })

  describe('state classification predicates', () => {
    it('isTerminalState: archived and revoked are terminal', () => {
      expect(isTerminalState('archived')).toBe(true)
      expect(isTerminalState('revoked')).toBe(false) // revoked can → archived
      expect(isTerminalState('active')).toBe(false)
    })

    it('isPublicState: published and active are public', () => {
      expect(isPublicState('published')).toBe(true)
      expect(isPublicState('active')).toBe(true)
      expect(isPublicState('draft')).toBe(false)
    })

    it('isOperationalState: only active is operational', () => {
      expect(isOperationalState('active')).toBe(true)
      expect(isOperationalState('published')).toBe(false)
    })

    it('isRetiredState: superseded, deprecated, revoked, archived are retired', () => {
      expect(isRetiredState('superseded')).toBe(true)
      expect(isRetiredState('deprecated')).toBe(true)
      expect(isRetiredState('revoked')).toBe(true)
      expect(isRetiredState('archived')).toBe(true)
      expect(isRetiredState('active')).toBe(false)
    })

    it('isPendingHumanAction: review_pending and approval_required require human', () => {
      expect(isPendingHumanAction('review_pending')).toBe(true)
      expect(isPendingHumanAction('approval_required')).toBe(true)
      expect(isPendingHumanAction('active')).toBe(false)
    })
  })

  describe('lifecycleStateLabel', () => {
    it('returns human-readable labels', () => {
      expect(lifecycleStateLabel('draft')).toMatch(/draft/i)
      expect(lifecycleStateLabel('active')).toMatch(/active/i)
    })
  })
})
