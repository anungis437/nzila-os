import type { FlowTaskInput, FlowTaskState } from './types'

export function createTaskStage(input: FlowTaskInput): FlowTaskState {
  return {
    moduleId: 'flow.tasks',
    summary: `Queued ${input.taskCount} execution tasks`,
    nextAction: 'track-status',
    taskCount: input.taskCount,
  }
}