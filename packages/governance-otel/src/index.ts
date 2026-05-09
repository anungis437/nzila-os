export type {
  GovernanceSeverity,
  GovernanceSubject,
  GovernanceScope,
  GovernanceDoctrineCitation,
  GovernanceEventEnvelopeLike,
} from './types'

export {
  createGovernanceTracer,
  emitGovernanceSpan,
  withGovernanceSpan,
  FORBIDDEN_OTEL_ATTRIBUTE_KEYS,
} from './adapter'
export type { GovernanceTracerOptions } from './adapter'
