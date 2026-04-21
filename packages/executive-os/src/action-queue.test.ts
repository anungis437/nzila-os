import { describe, it, expect } from 'vitest'
import {
  approve,
  reject,
  autoApprove,
  expire,
  markExecuted,
  isExecutable,
  isAwaitingApproval,
  ApprovalTransitionError,
  type ActionRecord,
} from './action-queue'

function baseAction(overrides: Partial<ActionRecord> = {}): ActionRecord {
  return {
    id: 'a1',
    actionClass: 'recommendation',
    approvalState: 'pending',
    executionStatus: 'not_executed',
    requiresApproval: true,
    ...overrides,
  }
}

describe('action queue state machine', () => {
  describe('approve', () => {
    it('transitions pending → approved with approver metadata', () => {
      const a = baseAction()
      const r = approve(a, { approverId: 'user-1' })
      expect(r.approvalState).toBe('approved')
      expect(r.approverId).toBe('user-1')
      expect(r.approvedAt).toBeInstanceOf(Date)
    })

    it('rejects approve from non-pending states', () => {
      expect(() => approve(baseAction({ approvalState: 'approved' }), { approverId: 'u' })).toThrow(
        ApprovalTransitionError,
      )
      expect(() => approve(baseAction({ approvalState: 'rejected' }), { approverId: 'u' })).toThrow(
        ApprovalTransitionError,
      )
    })

    it('rejects approve when action does not require approval', () => {
      expect(() => approve(baseAction({ requiresApproval: false }), { approverId: 'u' })).toThrow(
        ApprovalTransitionError,
      )
    })
  })

  describe('reject', () => {
    it('transitions pending → rejected with reason', () => {
      const r = reject(baseAction(), { approverId: 'u', reason: 'too risky' })
      expect(r.approvalState).toBe('rejected')
      expect(r.rejectionReason).toBe('too risky')
    })
  })

  describe('autoApprove', () => {
    it('only allowed for insight-class actions', () => {
      const r = autoApprove(baseAction({ actionClass: 'insight' }))
      expect(r.approvalState).toBe('auto')
      expect(r.requiresApproval).toBe(false)
    })

    it('rejects auto-approval for material actions', () => {
      expect(() => autoApprove(baseAction({ actionClass: 'recommendation' }))).toThrow(
        ApprovalTransitionError,
      )
      expect(() => autoApprove(baseAction({ actionClass: 'draft_action' }))).toThrow(
        ApprovalTransitionError,
      )
    })
  })

  describe('expire', () => {
    it('transitions pending → expired', () => {
      const r = expire(baseAction())
      expect(r.approvalState).toBe('expired')
    })

    it('cannot expire approved actions', () => {
      expect(() => expire(baseAction({ approvalState: 'approved' }))).toThrow(ApprovalTransitionError)
    })
  })

  describe('markExecuted', () => {
    it('records succeeded outcome on approved action', () => {
      const approved = baseAction({ approvalState: 'approved' })
      const r = markExecuted(approved, { status: 'succeeded', result: { ok: true } })
      expect(r.executionStatus).toBe('succeeded')
      expect(r.executionResult).toEqual({ ok: true })
    })

    it('records failed outcome on auto action', () => {
      const auto = baseAction({ approvalState: 'auto', actionClass: 'insight', requiresApproval: false })
      const r = markExecuted(auto, { status: 'failed', error: 'boom' })
      expect(r.executionStatus).toBe('failed')
    })

    it('refuses execution when approval state is pending', () => {
      expect(() =>
        markExecuted(baseAction(), { status: 'succeeded' }),
      ).toThrow(ApprovalTransitionError)
    })

    it('refuses double execution', () => {
      const approved = baseAction({ approvalState: 'approved', executionStatus: 'succeeded' })
      expect(() => markExecuted(approved, { status: 'succeeded' })).toThrow(ApprovalTransitionError)
    })
  })

  describe('predicates', () => {
    it('isAwaitingApproval is true only for pending+requiresApproval', () => {
      expect(isAwaitingApproval(baseAction())).toBe(true)
      expect(isAwaitingApproval(baseAction({ approvalState: 'approved' }))).toBe(false)
      expect(isAwaitingApproval(baseAction({ requiresApproval: false }))).toBe(false)
    })

    it('isExecutable is true only for approved/auto + not_executed', () => {
      expect(isExecutable(baseAction({ approvalState: 'approved' }))).toBe(true)
      expect(
        isExecutable(baseAction({ approvalState: 'auto', actionClass: 'insight', requiresApproval: false })),
      ).toBe(true)
      expect(isExecutable(baseAction())).toBe(false)
      expect(
        isExecutable(baseAction({ approvalState: 'approved', executionStatus: 'succeeded' })),
      ).toBe(false)
    })
  })
})
