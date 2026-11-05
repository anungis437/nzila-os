import { describe, expect, it } from 'vitest'
import {
  assertRunDuty,
  participantsFromRun,
  recordedRunAmounts,
  RunDutyError,
  type RunParticipants,
} from '../run-duties'

const run = (over: Partial<{ inputSnapshot: unknown; approvedBy: string | null; executedBy: string | null }> = {}) => ({
  inputSnapshot: { creatorUserId: 'preparer' },
  approvedBy: null as string | null,
  ...over,
})

const codeOf = (fn: () => void) => {
  try {
    fn()
  } catch (error) {
    expect(error).toBeInstanceOf(RunDutyError)
    return (error as RunDutyError).code
  }
  return null
}

describe('participantsFromRun', () => {
  it('reads the preparer from the snapshot and approvers from approvedBy and the recorded approvals', () => {
    const participants = participantsFromRun(
      run({ inputSnapshot: { creatorUserId: 'p', approvals: [{ userId: 'a1' }, { userId: 'a1' }] }, approvedBy: 'a2' }),
      'x',
    )
    expect(participants).toEqual({ preparedBy: 'p', approvedBy: ['a1', 'a2'], executedBy: 'x' })
  })

  it('treats blank or non-string identifiers as unrecorded', () => {
    expect(participantsFromRun({ inputSnapshot: { creatorUserId: '  ', approvals: [{ userId: 5 }] }, approvedBy: '' })).toEqual({
      preparedBy: null,
      approvedBy: [],
      executedBy: null,
    })
    expect(participantsFromRun({ inputSnapshot: null, approvedBy: null }).preparedBy).toBeNull()
  })
})

describe('assertRunDuty', () => {
  const full: RunParticipants = { preparedBy: 'preparer', approvedBy: ['approver'], executedBy: 'executor' }

  it('refuses every duty without an authenticated actor', () => {
    for (const duty of ['prepare', 'approve', 'execute', 'reconcile'] as const) {
      expect(codeOf(() => assertRunDuty(duty, null, full))).toBe('ACTOR_REQUIRED')
      expect(codeOf(() => assertRunDuty(duty, '', full))).toBe('ACTOR_REQUIRED')
    }
  })

  it('lets anyone with authority prepare', () => {
    expect(() => assertRunDuty('prepare', 'someone', {})).not.toThrow()
  })

  it('refuses self-approval', () => {
    expect(codeOf(() => assertRunDuty('approve', 'preparer', { preparedBy: 'preparer' }))).toBe('SELF_APPROVAL')
  })

  it('fails closed when the preparer is not recorded', () => {
    expect(codeOf(() => assertRunDuty('approve', 'approver', {}))).toBe('PREPARER_UNRECORDED')
    expect(codeOf(() => assertRunDuty('execute', 'executor', { approvedBy: ['approver'] }))).toBe('PREPARER_UNRECORDED')
  })

  it('refuses the same person approving twice', () => {
    expect(codeOf(() => assertRunDuty('approve', 'approver', { preparedBy: 'preparer', approvedBy: ['approver'] }))).toBe(
      'DUPLICATE_APPROVER',
    )
  })

  it('allows a distinct approver', () => {
    expect(() => assertRunDuty('approve', 'approver', { preparedBy: 'preparer' })).not.toThrow()
    expect(() => assertRunDuty('approve', 'second', { preparedBy: 'preparer', approvedBy: ['approver'] })).not.toThrow()
  })

  it('refuses self-execution and approver-execution', () => {
    expect(codeOf(() => assertRunDuty('execute', 'preparer', full))).toBe('SELF_EXECUTION')
    expect(codeOf(() => assertRunDuty('execute', 'approver', full))).toBe('APPROVER_EXECUTES')
  })

  it('refuses execution when no approver is recorded', () => {
    expect(codeOf(() => assertRunDuty('execute', 'executor', { preparedBy: 'preparer', approvedBy: [] }))).toBe(
      'APPROVER_UNRECORDED',
    )
  })

  it('allows a third person to execute', () => {
    expect(() => assertRunDuty('execute', 'executor', full)).not.toThrow()
  })

  it('refuses reconciliation by any participant and when the executor is unrecorded', () => {
    for (const actor of ['preparer', 'approver', 'executor']) {
      expect(codeOf(() => assertRunDuty('reconcile', actor, full))).toBe('SELF_RECONCILIATION')
    }
    expect(codeOf(() => assertRunDuty('reconcile', 'outsider', { preparedBy: 'preparer', approvedBy: ['approver'] }))).toBe(
      'EXECUTOR_UNRECORDED',
    )
    expect(() => assertRunDuty('reconcile', 'outsider', full)).not.toThrow()
  })
})

describe('recordedRunAmounts', () => {
  it('reports the amounts on record as strings', () => {
    expect(
      recordedRunAmounts({ totalGross: '100.00', totalNet: 80, totalDues: '2.00', totalBenefits: '3.00', totalPension: '4.00' }),
    ).toEqual({ totalGross: '100.00', totalNet: '80', totalDues: '2.00', totalBenefits: '3.00', totalPension: '4.00' })
  })
})

describe('the executor on the run record', () => {
  it('is read from the run itself, not only from the caller', () => {
    expect(participantsFromRun(run({ executedBy: 'executor' })).executedBy).toBe('executor')
  })

  it('prefers the recorded executor over a supplied one', () => {
    expect(participantsFromRun(run({ executedBy: 'executor' }), 'someone-else').executedBy).toBe('executor')
  })

  it('falls back to the supplied executor for a run posted before the column existed', () => {
    expect(participantsFromRun(run(), 'executor').executedBy).toBe('executor')
  })
})
