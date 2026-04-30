import type { FlowEngineInput, FlowEngineState } from '../types'

export interface FlowAutomationInput extends FlowEngineInput {
  recipe: 'follow-up' | 'restock' | 'closeout'
}

export interface FlowAutomationState extends FlowEngineState {
  recipe: FlowAutomationInput['recipe']
}