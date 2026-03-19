import type { PolicyCondition, PolicyRule } from "./schemas.js";

/**
 * Resolve a dot-path on an object, e.g. "actor.tenantId" → value.
 */
function resolvePath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * Evaluate a single condition against a flat context bag.
 */
export function evaluateCondition(
  condition: PolicyCondition,
  context: Record<string, unknown>,
): boolean {
  const actual = resolvePath(context, condition.field);

  switch (condition.operator) {
    case "eq":
      return actual === condition.value;
    case "neq":
      return actual !== condition.value;
    case "in":
      return Array.isArray(condition.value) && condition.value.includes(actual);
    case "not_in":
      return Array.isArray(condition.value) && !condition.value.includes(actual);
    case "exists":
      return condition.value ? actual !== undefined : actual === undefined;
    case "gt":
      return typeof actual === "number" && typeof condition.value === "number" && actual > condition.value;
    case "lt":
      return typeof actual === "number" && typeof condition.value === "number" && actual < condition.value;
    default:
      return false;
  }
}

/**
 * Check whether a rule's role requirement is met by the actor.
 */
export function matchesRole(rule: PolicyRule, actorRoles: string[]): boolean {
  if (!rule.roles || rule.roles.length === 0) return true; // No role constraint
  return rule.roles.some((r) => actorRoles.includes(r));
}

/**
 * Check whether all conditions on a rule are satisfied.
 */
export function evaluateConditions(
  conditions: PolicyCondition[] | undefined,
  context: Record<string, unknown>,
): boolean {
  if (!conditions || conditions.length === 0) return true;
  return conditions.every((c) => evaluateCondition(c, context));
}
