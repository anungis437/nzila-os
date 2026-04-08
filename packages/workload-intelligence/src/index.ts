// ─── @nzila/workload-intelligence ────────────────────────────────
// Workload Intelligence Layer (WIL)
// Decision prioritization across competing workloads, built on NIL.

// Models
export type {
  WorkItem,
  WorkItemType,
  IntakeSubmission,
  IntakeStatus,
  OfficialWorkItem,
  OfficialWorkItemStatus,
  QueueBucket,
  UrgencySignal,
  UrgencySignalType,
  RiskSignal,
  RiskSignalType,
  RiskSeverity,
  StrategicSignal,
  StrategicSignalType,
  PrioritizedWorkItem,
  PriorityLevel,
  PrioritizationResult,
  SignalScores,
  ScoringWeights,
  PrioritizationMetrics,
} from './models/types.js'

export {
  WorkItemTypes,
  IntakeStatuses,
  OfficialWorkItemStatuses,
  QueueBucketTypes,
  UrgencySignalTypes,
  RiskSignalTypes,
  RiskSeverities,
  StrategicSignalTypes,
  PriorityLevels,
  DEFAULT_WEIGHTS,
  workItemSchema,
  intakeSubmissionSchema,
  officialWorkItemSchema,
  urgencySignalSchema,
  riskSignalSchema,
  strategicSignalSchema,
} from './models/types.js'

// Signals
export { scoreUrgency } from './signals/urgency.js'
export { scoreRisk, describeRiskFactors } from './signals/risk.js'
export { scoreStrategic, describeStrategicFactors } from './signals/strategic.js'

// Scoring
export { computePriorityScore, scoreToPriorityLevel } from './scoring/priorityScore.js'

// Engine
export { createPrioritizationEngine } from './engine/prioritizationEngine.js'
export type { NilPort, PrioritizationEngineConfig, BucketedResult, PrioritizedIntake } from './engine/prioritizationEngine.js'

// Explanations
export { generateExplanation } from './explanations/generateExplanation.js'

// Authority Model
export {
  canCreateIntake,
  canCreateOfficialWorkItem,
  canConvertIntake,
  canAssignPriority,
  canOverridePriority,
  STEWARD_THRESHOLD,
} from './authority/permissions.js'
export type { AuthorityRole } from './authority/permissions.js'

// Intake Workflow
export {
  createIntakeWorkflow,
  isTerminalIntakeStatus,
} from './workflow/intakeLifecycle.js'
export type { IntakeTransitionResult } from './workflow/intakeLifecycle.js'

// NIL Prompt Registry
export {
  createPromptRegistry,
  IntakePromptFamilies,
  CasePromptFamilies,
} from './prompts/promptRegistry.js'
export type { PromptFamily, PromptRequest, PromptRegistry } from './prompts/promptRegistry.js'

// Human Override
export { createOverrideManager } from './overrides/overrideManager.js'
export type { PriorityOverride, OverrideManager } from './overrides/overrideManager.js'

// Orchestration
export { createWorkloadOrchestrator } from './orchestration/workloadOrchestrator.js'
export type { WorkItemSource, IntakeSource, OrchestratorConfig } from './orchestration/workloadOrchestrator.js'

// UI Contracts
export {
  toPanelData,
  getConfidenceIndicator,
} from './contracts/ui.js'
export type {
  WorkloadPriorityPanelProps,
  PriorityCardData,
  ConfidenceIndicator,
} from './contracts/ui.js'
