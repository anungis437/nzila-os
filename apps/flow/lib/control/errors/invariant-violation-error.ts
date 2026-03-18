/**
 * Flow — Control Layer Error: Invariant Violation
 */
import { FlowWorkflowError } from '@/lib/workflows/errors'

export class InvariantViolationError extends FlowWorkflowError {
  readonly code = 'INVARIANT_VIOLATION'
  constructor(
    public readonly invariant: string,
    public readonly context: Record<string, unknown> = {},
  ) {
    super(`Invariant violated: ${invariant}`)
  }
}
