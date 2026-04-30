import type { FlowEngineInput, FlowEngineState } from '../types'

export interface FlowIntakeInput extends FlowEngineInput {
  source: 'manual' | 'import' | 'api'
}

export interface FlowIntakeState extends FlowEngineState {
  intakeChannel: FlowIntakeInput['source']
}