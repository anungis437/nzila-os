/**
 * Flow — Control Layer Error: Payment Gate Blocked
 */
import { FlowWorkflowError } from '@/lib/workflows/errors'

export class PaymentGateBlockedError extends FlowWorkflowError {
  readonly code = 'PAYMENT_GATE_BLOCKED'
  constructor(
    public readonly orderId: string,
    public readonly gate: string,
    public readonly blockers: readonly string[],
    public readonly outstandingBalance: number,
  ) {
    super(
      `Payment gate blocked for order ${orderId} at ${gate}: ${blockers.join('; ')}`,
    )
  }
}
