/**
 * @nzila/pilot-mode — Barrel Export
 *
 * Org/user-scoped pilot flags with gradual rollout.
 *
 * @module @nzila/pilot-mode
 */

// Types
export type {
  PilotFlagDef,
  PilotContext,
  PilotEvaluation,
  PilotEvaluationReason,
  PilotCohort,
  PilotRecord,
  RolloutStrategy,
} from './types'

// Engine
export {
  evaluatePilotFlag,
  evaluateAllFlags,
  getEnabledPilotFlags,
  validatePilotFlag,
  hashBucket,
} from './engine'

// Audited
export { auditedPilotEvaluation } from './audited'

// Registry
export {
  registerPilotFlag,
  getPilotFlag,
  listPilotFlags,
  getAllPilotFlags,
  unregisterPilotFlag,
  registerCohort,
  getCohort,
  listCohorts,
  getCohortMap,
  unregisterCohort,
  clearPilotRegistry,
} from './registry'

// Builders
export { PilotFlagBuilder, CohortBuilder, pilotFlag, cohort } from './builders'

// Events
export {
  flagEvaluatedEvent,
  cohortEnrolledEvent,
  flagChangedEvent,
} from './events'
export type {
  PilotEventMeta,
  FlagEvaluatedPayload,
  CohortEnrolledPayload,
  FlagChangedPayload,
} from './events'
