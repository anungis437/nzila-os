import type { FlowStatusInput, FlowStatusState } from './types'

export function createStatusStage(input: FlowStatusInput): FlowStatusState {
  return {
    moduleId: 'flow.status',
    summary: `Workflow status is ${input.status}`,
    nextAction: 'evaluate-automation',
    status: input.status,
  }
}