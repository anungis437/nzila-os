/**
 * @nzila/nacp-core — Exam Session State Machine Tests
 */
import { describe, it, expect } from 'vitest'
import { attemptTransition, validateMachine } from '@nzila/commerce-state'
import { examSessionMachine } from './exam-session'
import { ExamSessionStatus, NacpRole } from '../enums'
import type { TransitionContext } from '@nzila/commerce-state'
import type { ExamSession } from '../types/index'

const ORG_ID = 'org-uuid-001'

function makeCtx(overrides: Partial<TransitionContext<NacpRole>> = {}): TransitionContext<NacpRole> {
  return {
    entityId: ORG_ID,
    actorId: 'actor-uuid-001',
    role: NacpRole.ADMIN,
    meta: {},
    ...overrides,
  }
}

function makeSession(overrides: Partial<ExamSession> = {}): ExamSession {
  return {
    id: 'session-uuid-001',
    entityId: ORG_ID,
    examId: 'exam-uuid-001',
    centerId: 'center-uuid-001',
    ref: 'SES-ENT-000001' as ExamSession['ref'],
    status: ExamSessionStatus.SCHEDULED,
    scheduledAt: '2026-06-01T08:00:00Z',
    openedAt: null,
    sealedAt: null,
    exportedAt: null,
    closedAt: null,
    integrityHash: null,
    supervisorId: null,
    candidateCount: 50,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('examSessionMachine', () => {
  it('passes validation', () => {
    const errors = validateMachine(examSessionMachine)
    expect(errors).toHaveLength(0)
  })

  it('has correct initial and terminal states', () => {
    expect(examSessionMachine.initialState).toBe(ExamSessionStatus.SCHEDULED)
    expect(examSessionMachine.terminalStates).toEqual([ExamSessionStatus.CLOSED])
  })

  describe('scheduled → opened', () => {
    it('allows admin to open session', () => {
      const result = attemptTransition(
        examSessionMachine,
        ExamSessionStatus.SCHEDULED,
        ExamSessionStatus.OPENED,
        makeCtx(),
        ORG_ID,
        makeSession(),
      )
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.from).toBe(ExamSessionStatus.SCHEDULED)
        expect(result.to).toBe(ExamSessionStatus.OPENED)
      }
    })

    it('denies viewer from opening session', () => {
      const result = attemptTransition(
        examSessionMachine,
        ExamSessionStatus.SCHEDULED,
        ExamSessionStatus.OPENED,
        makeCtx({ role: NacpRole.VIEWER }),
        ORG_ID,
        makeSession(),
      )
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.code).toBe('ROLE_DENIED')
      }
    })
  })

  describe('opened → in_progress', () => {
    it('requires at least one candidate', () => {
      const result = attemptTransition(
        examSessionMachine,
        ExamSessionStatus.OPENED,
        ExamSessionStatus.IN_PROGRESS,
        makeCtx(),
        ORG_ID,
        makeSession({ status: ExamSessionStatus.OPENED, candidateCount: 0 }),
      )
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.code).toBe('GUARD_FAILED')
      }
    })

    it('allows transition with candidates present', () => {
      const result = attemptTransition(
        examSessionMachine,
        ExamSessionStatus.OPENED,
        ExamSessionStatus.IN_PROGRESS,
        makeCtx(),
        ORG_ID,
        makeSession({ status: ExamSessionStatus.OPENED, candidateCount: 30 }),
      )
      expect(result.ok).toBe(true)
    })
  })

  describe('in_progress → sealed', () => {
    it('emits integrity artifact generation event', () => {
      const result = attemptTransition(
        examSessionMachine,
        ExamSessionStatus.IN_PROGRESS,
        ExamSessionStatus.SEALED,
        makeCtx(),
        ORG_ID,
        makeSession({ status: ExamSessionStatus.IN_PROGRESS }),
      )
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.eventsToEmit).toContainEqual(
          expect.objectContaining({ type: 'integrity.generate_artifact' })
        )
        expect(result.actionsToSchedule).toContainEqual(
          expect.objectContaining({ type: 'generate_integrity_artifact' })
        )
      }
    })
  })

  describe('sealed → exported', () => {
    it('requires integrity hash to be present', () => {
      const result = attemptTransition(
        examSessionMachine,
        ExamSessionStatus.SEALED,
        ExamSessionStatus.EXPORTED,
        makeCtx(),
        ORG_ID,
        makeSession({ status: ExamSessionStatus.SEALED, integrityHash: null }),
      )
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.code).toBe('GUARD_FAILED')
      }
    })

    it('allows export when integrity hash exists', () => {
      const result = attemptTransition(
        examSessionMachine,
        ExamSessionStatus.SEALED,
        ExamSessionStatus.EXPORTED,
        makeCtx(),
        ORG_ID,
        makeSession({
          status: ExamSessionStatus.SEALED,
          integrityHash: 'sha256-abc123' as ExamSession['integrityHash'],
        }),
      )
      expect(result.ok).toBe(true)
    })
  })

  describe('org isolation', () => {
    it('rejects transitions from different org', () => {
      const result = attemptTransition(
        examSessionMachine,
        ExamSessionStatus.SCHEDULED,
        ExamSessionStatus.OPENED,
        makeCtx({ entityId: 'different-org-uuid' }),
        ORG_ID,
        makeSession(),
      )
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.code).toBe('ORG_MISMATCH')
      }
    })
  })

  describe('terminal state', () => {
    it('rejects transitions from closed state', () => {
      const result = attemptTransition(
        examSessionMachine,
        ExamSessionStatus.CLOSED,
        ExamSessionStatus.SCHEDULED,
        makeCtx(),
        ORG_ID,
        makeSession({ status: ExamSessionStatus.CLOSED }),
      )
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.code).toBe('TERMINAL_STATE')
      }
    })
  })
})
