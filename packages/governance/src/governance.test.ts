import { describe, it, expect } from "vitest";
import { canAccess } from "./engine.js";
import { InMemoryDecisionStore, DecisionLogger } from "./decisions.js";
import { withGovernanceCheck, GovernanceError } from "./middleware.js";
import type { PolicySet, AccessRequest } from "./schemas.js";

const testPolicySet: PolicySet = {
  id: "test-policy",
  name: "Test Policy Set",
  defaultEffect: "deny",
  rules: [
    {
      id: "allow-admin-all",
      description: "Admins can do anything",
      resource: "*",
      actions: ["*"],
      effect: "allow",
      roles: ["admin"],
      priority: 100,
    },
    {
      id: "allow-read-own-org",
      description: "Users can read their own org's resources",
      resource: "claim",
      actions: ["read"],
      effect: "allow",
      conditions: [
        { field: "actor.orgId", operator: "eq", value: "t1" },
      ],
      priority: 50,
    },
    {
      id: "deny-delete",
      description: "No one can delete",
      resource: "*",
      actions: ["delete"],
      effect: "deny",
      priority: 200,
    },
  ],
};

function makeRequest(overrides: Partial<AccessRequest> = {}): AccessRequest {
  return {
    actor: { id: "u1", orgId: "t1", roles: ["user"] },
    resource: { type: "claim" },
    action: "read",
    ...overrides,
  };
}

describe("canAccess", () => {
  it("allows admin access via wildcard rule", () => {
    const result = canAccess(testPolicySet, makeRequest({
      actor: { id: "admin1", orgId: "t1", roles: ["admin"] },
      action: "write",
    }));
    expect(result.outcome).toBe("allow");
    expect(result.matchedRuleId).toBe("allow-admin-all");
  });

  it("allows org-scoped read", () => {
    const result = canAccess(testPolicySet, makeRequest());
    expect(result.outcome).toBe("allow");
    expect(result.matchedRuleId).toBe("allow-read-own-org");
  });

  it("denies delete via high-priority deny rule", () => {
    const result = canAccess(testPolicySet, makeRequest({
      actor: { id: "admin1", orgId: "t1", roles: ["admin"] },
      action: "delete",
    }));
    expect(result.outcome).toBe("deny");
    expect(result.matchedRuleId).toBe("deny-delete");
  });

  it("denies by default when no rule matches", () => {
    const result = canAccess(testPolicySet, makeRequest({
      actor: { id: "u2", orgId: "t2", roles: ["user"] },
      action: "write",
      resource: { type: "invoice" },
    }));
    expect(result.outcome).toBe("deny");
    expect(result.matchedRuleId).toBeNull();
  });
});

describe("DecisionLogger", () => {
  it("logs decisions to the store", () => {
    const store = new InMemoryDecisionStore();
    const logger = new DecisionLogger(store, "test-policy");

    const decision = canAccess(testPolicySet, makeRequest());
    logger.log(decision);

    const all = store.getAll();
    expect(all).toHaveLength(1);
    expect(all[0]!.outcome).toBe("allow");
    expect(all[0]!.policySetId).toBe("test-policy");
  });

  it("filters by actor", () => {
    const store = new InMemoryDecisionStore();
    const logger = new DecisionLogger(store, "test-policy");

    logger.log(canAccess(testPolicySet, makeRequest({ actor: { id: "u1", orgId: "t1", roles: ["user"] } })));
    logger.log(canAccess(testPolicySet, makeRequest({ actor: { id: "u2", orgId: "t1", roles: ["user"] } })));

    expect(store.getByActor("u1")).toHaveLength(1);
    expect(store.getByActor("u2")).toHaveLength(1);
  });
});

describe("withGovernanceCheck", () => {
  it("calls handler when access is allowed", async () => {
    const store = new InMemoryDecisionStore();
    const logger = new DecisionLogger(store, "test-policy");

    const handler = withGovernanceCheck(testPolicySet, logger, async (_req) => {
      return "success";
    });

    const result = await handler(makeRequest());
    expect(result).toBe("success");
  });

  it("throws GovernanceError when access is denied", async () => {
    const store = new InMemoryDecisionStore();
    const logger = new DecisionLogger(store, "test-policy");

    const handler = withGovernanceCheck(testPolicySet, logger, async () => "nope");

    await expect(
      handler(makeRequest({
        actor: { id: "u2", orgId: "t2", roles: ["user"] },
        action: "write",
        resource: { type: "secret" },
      })),
    ).rejects.toThrow(GovernanceError);

    // Decision should still be logged (deny)
    expect(store.getByOutcome("deny")).toHaveLength(1);
  });
});
