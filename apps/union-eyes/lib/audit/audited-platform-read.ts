import { ApiError } from '@/lib/api/framework'
import type { RLSTx } from '@/lib/db/with-rls-context'
import { OperationAuditError, operationAuditResponse, performAtomicAuditedOperation, performAuditedOperation } from '@/lib/audit/operation-audit'

// A platform-wide read of other organizations' member records is recorded before it runs, and is refused if the record cannot be written.
export async function performAuditedPlatformRead<T>(
  actor: { organizationId: string | null | undefined; userId: string | null | undefined },
  read: { action: string; resourceType: string; details?: Record<string, unknown> },
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await performAuditedOperation({ ...actor, scope: 'system', ...read }, operation)
  } catch (error) {
    const refused = error instanceof OperationAuditError ? operationAuditResponse(error) : null
    if (refused) throw ApiError.conflict(refused.body.error.message)
    throw error
  }
}

/**
 * The same read, with the audit record and the read in ONE system transaction: no record, no data, and the read runs on the transaction the
 * system role opened rather than on whatever the connection role sees. The record is written after the read so it can say how much came
 * back, and a failed record rolls the read back. Use this for a platform read whose effect is rows in our own database.
 */
export async function performAtomicPlatformRead<T>(
  actor: { organizationId: string | null | undefined; userId: string | null | undefined },
  read: { action: string; resourceType: string; details?: Record<string, unknown>; resultDetails?: (value: T) => Record<string, unknown> },
  operation: (tx: RLSTx) => Promise<T>,
): Promise<T> {
  try {
    return await performAtomicAuditedOperation({ ...actor, scope: 'system', ...read }, operation)
  } catch (error) {
    const refused = error instanceof OperationAuditError ? operationAuditResponse(error) : null
    if (refused) throw ApiError.conflict(refused.body.error.message)
    throw error
  }
}