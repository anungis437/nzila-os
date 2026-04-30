import type { FlowEngineInput, FlowEngineState } from '../types'

export interface FlowQuotingInput extends FlowEngineInput {
  currency: 'CAD' | 'USD'
}

export interface FlowQuotingState extends FlowEngineState {
  currency: FlowQuotingInput['currency']
}