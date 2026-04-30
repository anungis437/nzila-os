import type { FlowEngineInput, FlowEngineState } from '../types'

export interface FlowRoutingInput extends FlowEngineInput {
  queue: 'frontline' | 'finance' | 'operations'
}

export interface FlowRoutingState extends FlowEngineState {
  queue: FlowRoutingInput['queue']
}