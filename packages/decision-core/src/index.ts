export type {
  DecisionActor,
  DecisionActorType,
  DecisionAuthority,
  DecisionDomain,
  DecisionEnforcementLevel,
  DecisionEvaluationResult,
  DecisionGapLevel,
  DecisionInput,
  DecisionOutcome,
  DecisionOutcomeStatus,
  DecisionPolicyRef,
  DecisionProofAdapter,
  DecisionProofAdapterRequest,
  DecisionProof,
  DecisionRecord,
  DecisionRegistryEntry,
  DecisionDriftResult,
  EnforceDecisionRequest,
  ReplayDecisionRequest,
  ReplayDecisionResult,
} from './types'

export { DECISION_DOMAINS } from './types'
export {
  DEFAULT_DECISION_TYPES,
  clearDecisionRegistry,
  getDecisionType,
  listDecisionTypes,
  registerDecisionType,
} from './registry'
export { enforceDecision } from './enforceDecision'
export { evaluateStrictCoverageFailures } from './coverage-gate'
export { replayDecision, detectDecisionDrift } from './replay'