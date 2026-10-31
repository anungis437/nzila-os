/**
 * THE AUDIT-WRITE CONTRACT. There are two kinds of audited operation, and the kind is decided by where the effect lands:
 *
 *   - The effect is rows in our own database: performAtomicAuditedOperation (below). The change and its audit record are written in
 *     one tenant transaction, so a failed audit write rolls the change back and a failed change leaves no record of success. The
 *     record is hash-chained by persistAtomicAudit.
 *   - The effect is somewhere our transaction cannot reach (a provider call, an e-mail, a payment, a queue): performAuditedOperation.
 *     It is a durable two-phase record, not an atomic one. The route manifest labels such routes INTENT_OUTCOME, never ATOMIC.
 *
 * Audit for operations whose effect is not a row in the caller's transaction (UE-CONV-K-011).
 *
 * A platform operation (pausing a job queue, running a platform-wide job, flipping a platform flag) acts on a
 * system outside the database transaction, so the effect and its audit record cannot commit together. The order that
 * keeps the guarantee is:
 *
 *   1. the INTENT is made durable first; if it cannot be recorded, the operation is not performed;
 *   2. the operation runs;
 *   3. the OUTCOME (success or failure) is recorded; a failure to record it is logged loudly but does not reverse an
 *      effect that has already happened, because the intent record already proves the attempt.
 *
 * The record is attributed to the organization the administrator is acting in, because the audit chain is
 * organization-keyed. An administrator with no acting organization cannot perform a platform operation.
 */
import { withRLSContext, withSystemContext, type RLSTx } from '@/lib/db/with-rls-context'
import { persistAtomicAudit } from '@/lib/audit/atomic-audit'
import { logger } from '@/lib/logger'

export class OperationAuditError extends Error {
  readonly code = 'OPERATION_AUDIT_UNAVAILABLE'
  constructor(message: string) {
    super(message)
    this.name = 'OperationAuditError'
  }
}

export interface AtomicAuditedOperation<T = unknown> {
  organizationId: string | null | undefined
  userId: string | null | undefined
  /** The single audit action recorded with the change (there is no .requested/.completed pair: there is one transaction). */
  action: string
  resourceType: string
  resourceId?: string
  details?: Record<string, unknown>
  /** Facts about what the work did (counts, identifiers), recorded in the same audit row once the work has produced them. */
  resultDetails?: (value: T) => Record<string, unknown>
  scope?: 'organization' | 'system'
}

export interface AuditedOperation<T = unknown> {
  /** The organization the administrator is acting in. Required: there is no unattributed platform audit. */
  organizationId: string | null | undefined
  userId: string | null | undefined
  action: string
  resourceType: string
  resourceId?: string
  details?: Record<string, unknown>
  /**
   * 'system' records the audit under the system role instead of the actor's own organization binding: needed when a
   * platform administrator acts on an organization they are not a member of (the record is still attributed to that
   * organization and to the administrator).
   */
  scope?: 'organization' | 'system'
  /** Set to { recorded: false } by the operation when its outcome record could not be written, so the caller can say so. */
  outcomeReport?: { recorded: boolean }
  /** What the operation did (counts, identifiers of the durable rows it wrote), added to the outcome record when it completes. */
  resultDetails?: (value: T) => Record<string, unknown>
}

export async function performAuditedOperation<T>(op: AuditedOperation<T>, operation: () => Promise<T>): Promise<T> {
  const { organizationId, userId } = op
  if (!organizationId || !userId) {
    throw new OperationAuditError('A platform operation needs an authenticated administrator acting in an organization.')
  }
  const entry = (suffix: string, details: Record<string, unknown> = {}) => ({
    organizationId,
    userId,
    action: `${op.action}.${suffix}`,
    resourceType: op.resourceType,
    resourceId: op.resourceId,
    details: { ...op.details, ...details },
  })

  try {
    await inScope(op.scope, organizationId, (tx) => persistAtomicAudit(tx, entry('requested')))
  } catch (error) {
    logger.error('platform_operation_intent_not_recorded', { action: op.action, error })
    throw new OperationAuditError('The operation was not performed because its audit record could not be written.')
  }

  try {
    const result = await operation()
    const recorded = await recordOutcome(op.scope, organizationId, entry('completed', op.resultDetails ? op.resultDetails(result) : {}), 'success')
    if (op.outcomeReport) op.outcomeReport.recorded = recorded
    return result
  } catch (error) {
    const recorded = await recordOutcome(op.scope, organizationId, entry('failed', { error: error instanceof Error ? error.message : 'unknown' }), 'failure')
    if (op.outcomeReport) op.outcomeReport.recorded = recorded
    throw error
  }
}

/**
 * Runs `work` and writes its audit record in ONE transaction. If the audit record cannot be written the work rolls back and the caller
 * gets an OperationAuditError (HTTP 409 through operationAuditResponse); if the work throws, nothing is recorded as done.
 * `afterCommit` runs only once the transaction has committed (cache invalidation, for example) and cannot undo it.
 */
export async function performAtomicAuditedOperation<T>(
  op: AtomicAuditedOperation<T>,
  work: (tx: RLSTx) => Promise<T>,
  afterCommit?: () => Promise<void> | void,
): Promise<T> {
  const { organizationId, userId } = op
  if (!organizationId || !userId) {
    throw new OperationAuditError('A platform operation needs an authenticated administrator acting in an organization.')
  }
  const result = await inScope(op.scope, organizationId, async (tx) => {
    const value = await work(tx)
    try {
      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: op.action,
        resourceType: op.resourceType,
        resourceId: op.resourceId,
        details: { ...(op.details ?? {}), ...(op.resultDetails ? op.resultDetails(value) : {}) },
      })
    } catch (error) {
      logger.error('platform_operation_atomic_audit_not_recorded', { action: op.action, error })
      throw new OperationAuditError('The operation was not performed because its audit record could not be written.')
    }
    return value
  })
  if (afterCommit) {
    try {
      await afterCommit()
    } catch (error) {
      logger.error('platform_operation_after_commit_failed', { action: op.action, error })
    }
  }
  return result
}
const inScope = <T>(scope: 'organization' | 'system' | undefined, organizationId: string, work: (tx: RLSTx) => Promise<T>) =>
  scope === 'system' ? withSystemContext((tx) => work(tx as unknown as RLSTx)) : withRLSContext({ organizationId }, work)

async function recordOutcome(
  scope: 'organization' | 'system' | undefined,
  organizationId: string,
  record: Parameters<typeof persistAtomicAudit>[1],
  outcome: 'success' | 'failure',
): Promise<boolean> {
  try {
    await inScope(scope, organizationId, (tx) => persistAtomicAudit(tx, record, outcome))
    return true
  } catch (error) {
    logger.error('platform_operation_outcome_not_recorded', { action: record.action, outcome, error })
    return false
  }
}

/** The response a route returns when the audit boundary refused the operation. */
export const operationAuditResponse = (error: unknown) =>
  error instanceof OperationAuditError
    ? { status: 409, body: { error: { code: error.code, message: error.message } } }
    : null
