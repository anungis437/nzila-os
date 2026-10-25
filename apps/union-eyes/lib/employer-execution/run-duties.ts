/**
 * Employer-execution payroll runs: segregation of duties.
 *
 * Preparing a run, approving it, executing it and reconciling it are different duties. One person may not hold two
 * of them on the same run. Participants are read from what the run already records (preparer in the input snapshot,
 * approvers in `approvedBy` and the snapshot's approvals) and from the executing audit/compliance record, so the
 * check is evaluated against this run's real history, never against a role rank.
 *
 * Fail closed: a duty that depends on an earlier participant being known is refused when that participant is not
 * recorded, because segregation cannot then be shown. This is a local, pure rule set for payroll runs; it is not
 * the authority-kernel finance policy, which is built for public.payments transactions.
 */

export type RunDuty = 'prepare' | 'approve' | 'execute' | 'reconcile'

export type RunDutyViolationCode =
  | 'ACTOR_REQUIRED'
  | 'PREPARER_UNRECORDED'
  | 'APPROVER_UNRECORDED'
  | 'EXECUTOR_UNRECORDED'
  | 'SELF_APPROVAL'
  | 'DUPLICATE_APPROVER'
  | 'SELF_EXECUTION'
  | 'APPROVER_EXECUTES'
  | 'SELF_RECONCILIATION'

export class RunDutyError extends Error {
  readonly code: RunDutyViolationCode
  constructor(code: RunDutyViolationCode, message: string) {
    super(message)
    this.name = 'RunDutyError'
    this.code = code
  }
}

export interface RunParticipants {
  preparedBy?: string | null
  approvedBy?: readonly string[]
  executedBy?: string | null
}

interface RunDutyRecord {
  inputSnapshot?: unknown
  approvedBy?: string | null
  executedBy?: string | null
}

const asId = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null

export function participantsFromRun(run: RunDutyRecord, executedBy?: string | null): RunParticipants {
  const snapshot = (run.inputSnapshot ?? {}) as Record<string, unknown>
  const recorded = Array.isArray(snapshot.approvals) ? (snapshot.approvals as Array<{ userId?: unknown }>) : []
  const approvers = new Set<string>()
  for (const approval of recorded) {
    const id = asId(approval?.userId)
    if (id) approvers.add(id)
  }
  const final = asId(run.approvedBy)
  if (final) approvers.add(final)
  return {
    preparedBy: asId(snapshot.creatorUserId),
    approvedBy: [...approvers],
    executedBy: asId(run.executedBy) ?? asId(executedBy),
  }
}

export function assertRunDuty(duty: RunDuty, actorId: string | null | undefined, participants: RunParticipants): void {
  const actor = asId(actorId)
  if (!actor) throw new RunDutyError('ACTOR_REQUIRED', 'An authenticated actor is required for this payroll duty')

  const preparer = asId(participants.preparedBy)
  const approvers = (participants.approvedBy ?? []).filter((id): id is string => !!asId(id))
  const executor = asId(participants.executedBy)

  switch (duty) {
    case 'prepare':
      return
    case 'approve':
      if (!preparer) {
        throw new RunDutyError('PREPARER_UNRECORDED', 'The preparer of this run is not recorded; approval cannot be segregated')
      }
      if (preparer === actor) {
        throw new RunDutyError('SELF_APPROVAL', 'The person who prepared a payroll run cannot approve it')
      }
      if (approvers.includes(actor)) {
        throw new RunDutyError('DUPLICATE_APPROVER', 'Dual approval requires a second distinct approver')
      }
      return
    case 'execute':
      if (!preparer) {
        throw new RunDutyError('PREPARER_UNRECORDED', 'The preparer of this run is not recorded; execution cannot be segregated')
      }
      if (approvers.length === 0) {
        throw new RunDutyError('APPROVER_UNRECORDED', 'The approver of this run is not recorded; execution cannot be segregated')
      }
      if (preparer === actor) {
        throw new RunDutyError('SELF_EXECUTION', 'The person who prepared a payroll run cannot execute it')
      }
      if (approvers.includes(actor)) {
        throw new RunDutyError('APPROVER_EXECUTES', 'The person who approved a payroll run cannot execute it')
      }
      return
    case 'reconcile':
      if (!executor) {
        throw new RunDutyError('EXECUTOR_UNRECORDED', 'The executor of this run is not recorded; reconciliation cannot be segregated')
      }
      if (actor === executor || actor === preparer || approvers.includes(actor)) {
        throw new RunDutyError('SELF_RECONCILIATION', 'A person who took part in a payroll run cannot reconcile it')
      }
      return
  }
}

/** The amounts on record for a run: what is approved and executed, never what a request claims. */
export function recordedRunAmounts(run: {
  totalGross: unknown
  totalNet: unknown
  totalDues: unknown
  totalBenefits: unknown
  totalPension: unknown
}) {
  return {
    totalGross: String(run.totalGross),
    totalNet: String(run.totalNet),
    totalDues: String(run.totalDues),
    totalBenefits: String(run.totalBenefits),
    totalPension: String(run.totalPension),
  }
}
