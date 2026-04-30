export interface FlowEngineInput {
  organizationId: string
  requestId: string
}

export interface FlowEngineState {
  moduleId: string
  summary: string
  nextAction: string
}

export interface FlowEngineModuleDefinition {
  id: string
  name: string
  icon: string
  description: string
  bullets: string[]
}