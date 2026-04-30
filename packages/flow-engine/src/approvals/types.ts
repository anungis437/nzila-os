import type { FlowEngineInput, FlowEngineState } from '../types'

export interface FlowApprovalInput extends FlowEngineInput {
  approverRole: 'owner' | 'manager' | 'finance'
}

export interface FlowApprovalState extends FlowEngineState {
  approverRole: FlowApprovalInput['approverRole']
}