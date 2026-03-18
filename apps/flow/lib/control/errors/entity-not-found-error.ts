/**
 * Flow — Control Layer Error: Entity Not Found
 */
import { FlowWorkflowError } from '@/lib/workflows/errors'

export class EntityNotFoundError extends FlowWorkflowError {
  readonly code = 'ENTITY_NOT_FOUND'
  constructor(
    public readonly entityType: string,
    public readonly entityId: string,
  ) {
    super(`${entityType} "${entityId}" not found`)
  }
}
