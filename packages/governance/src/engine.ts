import type {
  AccessRequest,
  DecisionOutcome,
  GovernanceDecision,
  PolicyRule,
  PolicySet,
} from "./schemas.js";
import { evaluateConditions, matchesRole } from "./policy.js";

/**
 * Core governance engine: evaluates an access request against a policy set.
 *
 * Rules are evaluated in priority order (highest first).
 * The first matching rule determines the outcome.
 * If no rule matches, the policy set's `defaultEffect` applies.
 */
export function canAccess(
  policySet: PolicySet,
  request: AccessRequest,
): GovernanceDecision {
  const start = performance.now();
  const evaluatedAt = new Date().toISOString();

  // Build a flat context bag for condition evaluation
  const contextBag: Record<string, unknown> = {
    actor: request.actor,
    resource: request.resource,
    action: request.action,
    ...request.actor.attributes,
    ...request.resource.attributes,
    ...request.context,
  };

  // Sort rules by priority descending
  const sorted = [...policySet.rules].sort(
    (a, b) => (b.priority ?? 0) - (a.priority ?? 0),
  );

  for (const rule of sorted) {
    if (!ruleApplies(rule, request)) continue;
    if (!matchesRole(rule, request.actor.roles)) continue;
    if (!evaluateConditions(rule.conditions, contextBag)) continue;

    return {
      outcome: rule.effect as DecisionOutcome,
      matchedRuleId: rule.id,
      reason: rule.description ?? `Matched rule ${rule.id}`,
      request,
      evaluatedAt,
      durationMs: performance.now() - start,
    };
  }

  // No rule matched — fall back to default
  return {
    outcome: policySet.defaultEffect as DecisionOutcome,
    matchedRuleId: null,
    reason: `No matching rule; default effect is ${policySet.defaultEffect}`,
    request,
    evaluatedAt,
    durationMs: performance.now() - start,
  };
}

/**
 * Check if a rule targets the given resource type and action.
 */
function ruleApplies(rule: PolicyRule, request: AccessRequest): boolean {
  const resourceMatch =
    rule.resource === "*" || rule.resource === request.resource.type;
  const actionMatch =
    rule.actions.includes("*") || rule.actions.includes(request.action);
  return resourceMatch && actionMatch;
}
