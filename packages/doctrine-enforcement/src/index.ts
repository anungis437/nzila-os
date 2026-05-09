/**
 * @nzila/doctrine-enforcement — barrel exports
 */

export type {
  DoctrineCitation,
  PolicyDomain,
  PolicyEffect,
  PolicySeverity,
  PolicyConditionOperator,
  PolicyCondition,
  PolicyScope,
  GovernancePolicy,
  PolicySubject,
  PolicyContext,
  PolicyEvaluationOutput,
  AICapabilityRegistration,
  CategoricallyRefusedAIBehavior,
} from './types'

export { CATEGORICALLY_REFUSED_AI_BEHAVIORS } from './types'

export { DoctrinePolicyRegistry, governancePolicySchema } from './registry'

export { evaluatePolicy } from './evaluator'

export {
  AICapabilityRegistry,
  aiCapabilityRegistrationSchema,
  isCategoricallyRefused,
} from './ai-capability-registry'
