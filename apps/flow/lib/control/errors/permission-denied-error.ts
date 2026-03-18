/**
 * Flow — Control Layer Error: Permission Denied
 */
import { FlowWorkflowError } from '@/lib/workflows/errors'

export class PermissionDeniedError extends FlowWorkflowError {
  readonly code = 'PERMISSION_DENIED'
  constructor(
    public readonly action: string,
    public readonly reason: string,
  ) {
    super(`Permission denied for "${action}": ${reason}`)
  }
}
