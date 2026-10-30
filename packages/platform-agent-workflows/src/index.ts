/**
 * @nzila/platform-agent-workflows — barrel exports
 * Workflow completion requires independently verified outcome evidence;
 * release authorization is separate and never conferred by this package.
 */
export type {
  WorkflowStatus, EngineeringOutcomePhase, OutcomeEvidence,
  WorkflowStep, AgentWorkflow, Recommendation,
} from './types'
export {
  outcomeEvidenceSchema, workflowStepSchema, agentWorkflowSchema, recommendationSchema,
} from './types'
export { createWorkflow, executeStep } from './workflowRunner'
export {
  verifyOutcomeEvidence, isVerifiedOutcomeFor, serializeOutcomeProof,
} from './outcome-proof'
export type {
  OutcomeVerificationRequest, IndependentVerificationResult,
  TrustedOutcomeVerifier, VerifiedOutcomeProof,
} from './outcome-proof'
export { generateRecommendations } from './recommendations'
