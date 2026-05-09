export type {
  GovernanceSeverity,
  GovernanceSubject,
  GovernanceScope,
  GovernanceDoctrineCitation,
  GovernanceEventEnvelope,
  GovernanceSink,
} from './types'

export {
  GovernanceEmitter,
  InMemoryGovernanceSink,
  ForbiddenPayloadKeyError,
  governanceEmitter,
  emit,
} from './emitter'

export {
  applyPolicyDecision,
  requireRegisteredAICapability,
  UnregisteredAICapabilityError,
} from './gates'
export type {
  PolicyEffect,
  PolicyEvaluationLike,
  PolicyGateInput,
  PolicyGateOutcome,
  AICapabilityCheckInput,
} from './gates'

export {
  withPolicyGate,
  attachGovernanceHeaders,
} from './next'
export type { PolicyGateResponseShape } from './next'
