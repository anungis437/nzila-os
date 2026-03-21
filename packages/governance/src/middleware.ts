import type { AccessRequest, Actor, PolicySet, Resource } from "./schemas.js";
import { canAccess } from "./engine.js";
import type { DecisionLogger } from "./decisions.js";

/**
 * Higher-order function that wraps a handler with governance enforcement.
 *
 * If the access check returns "deny", the handler is not invoked and
 * an error is thrown. All decisions (allow and deny) are logged.
 *
 * @example
 * ```ts
 * const handler = withGovernanceCheck(policySet, logger, async (req) => {
 *   return db.claims.findMany({ where: { orgId: req.actor.orgId } });
 * });
 * const result = await handler(accessRequest);
 * ```
 */
export function withGovernanceCheck<T>(
  policySet: PolicySet,
  logger: DecisionLogger,
  handler: (request: AccessRequest) => T | Promise<T>,
): (request: AccessRequest) => Promise<T> {
  return async (request: AccessRequest): Promise<T> => {
    const decision = canAccess(policySet, request);
    logger.log(decision);

    if (decision.outcome === "deny") {
      throw new GovernanceError(
        `Access denied: ${decision.reason}`,
        decision.matchedRuleId,
        request,
      );
    }

    return handler(request);
  };
}

/**
 * Convenience: build an AccessRequest from common parameters.
 */
export function buildAccessRequest(
  actor: Actor,
  resource: Resource,
  action: string,
  context?: Record<string, unknown>,
): AccessRequest {
  return {
    actor,
    resource,
    action,
    context,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Typed error for governance denials.
 */
export class GovernanceError extends Error {
  public readonly code = "GOVERNANCE_DENIED" as const;

  constructor(
    message: string,
    public readonly matchedRuleId: string | null,
    public readonly request: AccessRequest,
  ) {
    super(message);
    this.name = "GovernanceError";
  }
}
