/**
 * @nzila/onboarding-core — Barrel Export
 *
 * Multi-step organisation onboarding engine.
 *
 * @module @nzila/onboarding-core
 */

// Types
export type {
  OnboardingStepDef,
  OnboardingFlowDef,
  StepCompletion,
  OnboardingProgress,
  OnboardingStatus,
  StepOutcome,
  StepResult,
  ProgressSummary,
  OnboardingRecord,
  StepValidator,
} from './types'

// Engine
export {
  deriveStatus,
  evaluateProgress,
  completeStep,
  resetStep,
  findNextStep,
  getBlockers,
  isFlowComplete,
  validateFlow,
  createProgress,
} from './engine'
export type { CompleteStepFailure, CompleteStepResult, ResetStepResult } from './engine'

// Audited
export { executeOnboardingStep } from './audited'

// Registry
export {
  registerFlow,
  getFlow,
  listFlows,
  unregisterFlow,
  clearFlowRegistry,
} from './registry'

// Builders
export { StepBuilder, FlowBuilder, step, flow } from './builders'

// Events
export {
  stepCompletedEvent,
  flowCompletedEvent,
  onboardingEventsFromCompletion,
} from './events'
export type {
  OnboardingEventMeta,
  StepCompletedPayload,
  FlowCompletedPayload,
} from './events'

// Self-Service
export {
  resolveOnboardingFlow,
  validateOrgCreation,
  buildOrgCreation,
  buildInviteLink,
  validateInviteConsumption,
  getFieldsForPhase,
  computeProfileCompleteness,
  buildReferralAttribution,
  buildSelfServiceFlow,
  DEFAULT_PROFILE_FIELDS,
} from './self-service'
export type {
  OrgCreationRequest,
  OrgType,
  OrgCreationResult,
  InviteRole,
  InviteLink,
  CreateInviteInput,
  ProfilePhase,
  ProfileField,
  ReferralAttribution,
} from './self-service'
