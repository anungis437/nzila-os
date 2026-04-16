/**
 * Control Plane — Authority Services Barrel
 *
 * Single import point for all Control Plane authority service modules.
 * Import from this barrel inside the Control Plane app only.
 *
 * External callers (Console, Platform Admin, Orchestrator) MUST use the
 * Control Plane HTTP API — not these modules directly.
 */
export { resolveEntitlements, resolveEntitlementsBulk } from './entitlements'
export type { EntitlementQuery, EntitlementResult } from './entitlements'

export { authorizeWorkflowTrigger } from './workflow-authorizer'
export type { AuthorizeWorkflowResult } from './workflow-authorizer'

export {
  recordDecisionEvent,
  getDecisionsByCorrelationId,
  getDecisionsByWorkflowId,
  getDecisionsForOrg,
} from './decision'
export type { RecordDecisionInput, DecisionRecord } from './decision'
