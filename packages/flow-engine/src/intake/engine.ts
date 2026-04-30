import type { FlowIntakeInput, FlowIntakeState } from './types'

export function createIntakeStage(input: FlowIntakeInput): FlowIntakeState {
  return {
    moduleId: 'flow.intake',
    summary: `Captured intake for ${input.organizationId}`,
    nextAction: 'route-work',
    intakeChannel: input.source,
  }
}