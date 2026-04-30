import type { FlowEngineInput, FlowEngineState } from '../types'

export interface FlowStatusInput extends FlowEngineInput {
  status: 'queued' | 'in-progress' | 'completed'
}

export interface FlowStatusState extends FlowEngineState {
  status: FlowStatusInput['status']
}