import { ApiError } from '@/lib/api/framework'
import { OperationAuditError, operationAuditResponse, performAuditedOperation } from '@/lib/audit/operation-audit'

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
