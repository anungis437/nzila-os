/**
 * @nzila/governance-telemetry — barrel exports
 */

export type {
  GovernanceSeverity,
  GovernanceDecision,
  GovernanceProduct,
  GovernanceEnvironmentClass,
  GovernanceScope,
  GovernanceSubjectKind,
  GovernanceSubject,
  DoctrineCitation,
  GovernanceEventType,
  GovernanceEventEnvelope,
  GovernanceEmitter,
} from './types'

export {
  ENVELOPE_SCHEMA_VERSION,
  governanceSeveritySchema,
  governanceDecisionSchema,
  governanceProductSchema,
  governanceEnvironmentClassSchema,
  governanceScopeSchema,
  governanceSubjectKindSchema,
  governanceSubjectSchema,
  doctrineCitationSchema,
  governanceEventTypeSchema,
  governanceEventEnvelopeSchema,
  validateGovernanceEvent,
  safeValidateGovernanceEvent,
} from './schemas'

export type { GovernanceEventDefinition } from './events'
export {
  getEventDefinition,
  listEventDefinitions,
  meetsSeverityFloor,
} from './events'
