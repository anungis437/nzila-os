/**
 * Flow — Control Layer Error: Integration Dispatch Error
 */
import { FlowWorkflowError } from '@/lib/workflows/errors'

export class IntegrationDispatchError extends FlowWorkflowError {
  readonly code = 'INTEGRATION_DISPATCH_ERROR'
  constructor(
    public readonly integration: string,
    public readonly operation: string,
    public readonly cause?: string,
  ) {
    super(
      `Integration dispatch failed: ${integration}.${operation}` +
      (cause ? ` — ${cause}` : ''),
    )
  }
}
