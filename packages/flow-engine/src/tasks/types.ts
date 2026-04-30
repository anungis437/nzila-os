import type { FlowEngineInput, FlowEngineState } from '../types'

export interface FlowTaskInput extends FlowEngineInput {
  taskCount: number
}

export interface FlowTaskState extends FlowEngineState {
  taskCount: number
}