import type { FlowApprovalInput, FlowApprovalState } from './types'

export function createApprovalStage(input: FlowApprovalInput): FlowApprovalState {
  return {
    moduleId: 'flow.approvals',
    summary: `Approval requested from ${input.approverRole}`,
    nextAction: 'prepare-quote',
    approverRole: input.approverRole,
  }
}