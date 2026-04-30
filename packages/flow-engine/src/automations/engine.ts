import type { FlowAutomationInput, FlowAutomationState } from './types'

export function createAutomationStage(input: FlowAutomationInput): FlowAutomationState {
  return {
    moduleId: 'flow.automations',
    summary: `Automation recipe ${input.recipe} is armed`,
    nextAction: 'monitor-execution',
    recipe: input.recipe,
  }
}