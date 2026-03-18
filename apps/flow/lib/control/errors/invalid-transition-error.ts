/**
 * Flow — Control Layer Error: Invalid Transition
 */
import { FlowWorkflowError } from '@/lib/workflows/errors'

export class InvalidTransitionError extends FlowWorkflowError {
  readonly code = 'INVALID_TRANSITION'
  constructor(
    public readonly workflow: string,
    public readonly from: string,
    public readonly to: string,
    public readonly allowed: readonly string[] = [],
  ) {
    super(
      `[${workflow}] Transition ${from} → ${to} is not allowed.` +
      (allowed.length > 0 ? ` Allowed: ${allowed.join(', ')}` : ''),
    )
  }
}
