import { describe, it, expect } from "vitest";
import { canAccess } from "./engine.js";
import { InMemoryDecisionStore, DecisionLogger } from "./decisions.js";
import { withGovernanceCheck, GovernanceError, buildAccessRequest } from "./middleware.js";
import { evaluateCondition, evaluateConditions, matchesRole } from "./policy.js";
import type { PolicySet, AccessRequest } from "./schemas.js";
import { AccessRequestSchema, PolicySetSchema } from "./schemas.js";
import * as governanceIndex from "./index.js";

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

  it("filters by resource, outcome and org", () => {
    const store = new InMemoryDecisionStore();
    const logger = new DecisionLogger(store, "test-policy");

    logger.log(canAccess(testPolicySet, makeRequest({ resource: { type: "claim" } })));
    logger.log(canAccess(testPolicySet, makeRequest({ resource: { type: "invoice" }, action: "write" })));

    expect(store.getByResource("claim")).toHaveLength(1);
    expect(store.getByOutcome("allow")).toHaveLength(1);
    expect(store.getByOutcome("deny")).toHaveLength(1);
    expect(store.getByOrg("t1")).toHaveLength(2);
  });

  it("returns a persisted decision entry with generated id", () => {
    const store = new InMemoryDecisionStore();
    const logger = new DecisionLogger(store, "test-policy");
    const entry = logger.log(canAccess(testPolicySet, makeRequest()));

    expect(entry.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(entry.policySetId).toBe("test-policy");
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

  it("builds access request with timestamp", () => {
    const request = buildAccessRequest(
      { id: "u1", orgId: "t1", roles: ["user"] },
      { type: "claim", id: "c1" },
      "read",
      { source: "api" },
    );

    expect(request.actor.id).toBe("u1");
    expect(request.resource.type).toBe("claim");
    expect(request.action).toBe("read");
    expect(request.context).toEqual({ source: "api" });
    expect(typeof request.timestamp).toBe("string");
  });

  it("captures governance error details", async () => {
    const store = new InMemoryDecisionStore();
    const logger = new DecisionLogger(store, "test-policy");
    const handler = withGovernanceCheck(testPolicySet, logger, async () => "ok");

    try {
      await handler(makeRequest({ actor: { id: "u2", orgId: "t2", roles: ["user"] }, action: "write" }));
      throw new Error("expected denial");
    } catch (error) {
      expect(error).toBeInstanceOf(GovernanceError);
      const govError = error as GovernanceError;
      expect(govError.code).toBe("GOVERNANCE_DENIED");
      expect(govError.request.actor.id).toBe("u2");
      expect(govError.name).toBe("GovernanceError");
    }
  });
});

describe("policy helpers", () => {
  it("evaluates all supported condition operators", () => {
    const context = {
      actor: { orgId: "t1", age: 25 },
      action: "read",
      country: "zm",
    };

    expect(evaluateCondition({ field: "actor.orgId", operator: "eq", value: "t1" }, context)).toBe(true);
    expect(evaluateCondition({ field: "actor.orgId", operator: "neq", value: "t2" }, context)).toBe(true);
    expect(evaluateCondition({ field: "action", operator: "in", value: ["read", "write"] }, context)).toBe(true);
    expect(evaluateCondition({ field: "country", operator: "not_in", value: ["ng", "ke"] }, context)).toBe(true);
    expect(evaluateCondition({ field: "actor.age", operator: "gt", value: 18 }, context)).toBe(true);
    expect(evaluateCondition({ field: "actor.age", operator: "lt", value: 30 }, context)).toBe(true);
    expect(evaluateCondition({ field: "missing", operator: "exists", value: false }, context)).toBe(true);
    expect(evaluateCondition({ field: "actor.orgId", operator: "exists", value: true }, context)).toBe(true);
    expect(
      evaluateCondition(
        { field: "actor.orgId", operator: "unknown" as "eq", value: "t1" },
        context,
      ),
    ).toBe(false);
  });

  it("evaluates condition lists and role matching", () => {
    const context = { actor: { orgId: "t1" } };

    expect(evaluateConditions(undefined, context)).toBe(true);
    expect(
      evaluateConditions(
        [
          { field: "actor.orgId", operator: "eq", value: "t1" },
          { field: "actor.orgId", operator: "neq", value: "t2" },
        ],
        context,
      ),
    ).toBe(true);
    expect(
      evaluateConditions(
        [{ field: "actor.orgId", operator: "eq", value: "t2" }],
        context,
      ),
    ).toBe(false);

    expect(matchesRole({ id: "r1", resource: "*", actions: ["*"], effect: "allow" }, ["user"])).toBe(true);
    expect(matchesRole({ id: "r2", resource: "*", actions: ["*"], effect: "allow", roles: ["admin"] }, ["user"])).toBe(false);
  });
});

describe("schema and index exports", () => {
  it("validates access requests at runtime", () => {
    const parsed = AccessRequestSchema.safeParse(makeRequest());
    expect(parsed.success).toBe(true);
  });

  it("applies policy defaults through schema", () => {
    const parsed = PolicySetSchema.parse({
      id: "p1",
      name: "Policy",
      rules: [
        { id: "allow", resource: "*", actions: ["read"], effect: "allow" },
      ],
    });

    expect(parsed.defaultEffect).toBe("deny");
    expect(parsed.rules[0]?.priority).toBe(0);
  });

  it("exports governance public API from index", () => {
    expect(typeof governanceIndex.canAccess).toBe("function");
    expect(typeof governanceIndex.evaluateCondition).toBe("function");
    expect(typeof governanceIndex.withGovernanceCheck).toBe("function");
    expect(typeof governanceIndex.InMemoryDecisionStore).toBe("function");
  });
});
