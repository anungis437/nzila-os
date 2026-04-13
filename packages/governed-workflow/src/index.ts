// ---------------------------------------------------------------------------
// @nzila/governed-workflow  —  Barrel export
// ---------------------------------------------------------------------------

// Types
export type {
  IngestionPhase,
  FsmPhase,
  EvidencePhase,
  GovernedWorkflowDef,
  GovernedWorkflowContext,
  IngestionPhaseResult,
  IngestionPhaseSkipped,
  IngestionOutcome,
  FsmPhaseResult,
  FsmPhaseSkipped,
  FsmOutcome,
  WorkflowOutcome,
  GovernedWorkflowResult,
  GovernedWorkflowRecord,
  WorkflowStartedPayload,
  WorkflowCompletedPayload,
} from './types'

// Orchestrator
export { executeGovernedWorkflow, buildWorkflowRecord } from './orchestrator'
export type { ExecuteGovernedWorkflowOpts } from './orchestrator'

// Builders
export { GovernedWorkflowBuilder, workflow } from './builders'

// Registry
export {
  registerWorkflow,
  getWorkflow,
  listWorkflows,
  unregisterWorkflow,
  clearWorkflowRegistry,
} from './registry'

// Event bridge
export { workflowStartedEvent, workflowCompletedEvent } from './events'
