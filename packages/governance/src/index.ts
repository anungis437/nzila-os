// Core engine
export { canAccess } from "./engine.js";

// Policy helpers
export { evaluateCondition, evaluateConditions, matchesRole } from "./policy.js";

// Schemas & types
export {
  ActorSchema,
  ResourceSchema,
  PolicyConditionSchema,
  PolicyRuleSchema,
  PolicySetSchema,
  AccessRequestSchema,
} from "./schemas.js";
export type {
  Actor,
  Resource,
  PolicyAction,
  PolicyCondition,
  PolicyRule,
  PolicySet,
  AccessRequest,
  DecisionOutcome,
  GovernanceDecision,
  DecisionLogEntry,
} from "./schemas.js";

// Decision logging
export { InMemoryDecisionStore, DecisionLogger } from "./decisions.js";
export type { DecisionStore } from "./decisions.js";

// Middleware
export {
  withGovernanceCheck,
  buildAccessRequest,
  GovernanceError,
} from "./middleware.js";
