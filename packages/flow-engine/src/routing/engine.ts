import type { FlowRoutingInput, FlowRoutingState } from './types'

export function createRoutingStage(input: FlowRoutingInput): FlowRoutingState {
  return {
    moduleId: 'flow.routing',
    summary: `Routed request ${input.requestId} to ${input.queue}`,
    nextAction: 'collect-approval',
    queue: input.queue,
  }
}