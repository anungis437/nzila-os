/**
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
import { withRLSContext } from '@/lib/db/with-rls-context'
import { persistAtomicAudit } from '@/lib/audit/atomic-audit'
import { logger } from '@/lib/logger'

export class OperationAuditError extends Error {
  readonly code = 'OPERATION_AUDIT_UNAVAILABLE'
  constructor(message: string) {
    super(message)
    this.name = 'OperationAuditError'
  }
}

export interface AuditedOperation {
  /** The organization the administrator is acting in. Required: there is no unattributed platform audit. */
  organizationId: string | null | undefined
  userId: string | null | undefined
  action: string
  resourceType: string
  resourceId?: string
  details?: Record<string, unknown>
}

export async function performAuditedOperation<T>(op: AuditedOperation, operation: () => Promise<T>): Promise<T> {
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
    await withRLSContext({ organizationId }, (tx) => persistAtomicAudit(tx, entry('requested')))
  } catch (error) {
    logger.error('platform_operation_intent_not_recorded', { action: op.action, error })
    throw new OperationAuditError('The operation was not performed because its audit record could not be written.')
  }

  try {
    const result = await operation()
    await recordOutcome(organizationId, entry('completed'), 'success')
    return result
  } catch (error) {
    await recordOutcome(organizationId, entry('failed', { error: error instanceof Error ? error.message : 'unknown' }), 'failure')
    throw error
  }
}

async function recordOutcome(
  organizationId: string,
  record: Parameters<typeof persistAtomicAudit>[1],
  outcome: 'success' | 'failure',
) {
  try {
    await withRLSContext({ organizationId }, (tx) => persistAtomicAudit(tx, record, outcome))
  } catch (error) {
    logger.error('platform_operation_outcome_not_recorded', { action: record.action, outcome, error })
  }
}

/** The response a route returns when the audit boundary refused the operation. */
export const operationAuditResponse = (error: unknown) =>
  error instanceof OperationAuditError
    ? { status: 409, body: { error: { code: error.code, message: error.message } } }
    : null
