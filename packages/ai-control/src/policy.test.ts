import { describe, it, expect } from "vitest";
import {
  AIPolicyRegistry,
  checkAIPolicy,
  getAIPolicyRegistry,
  modelAllowlistPolicy,
  restrictedDataPolicy,
  setAIPolicyRegistry,
} from "./policy.js";

describe("AIPolicyRegistry", () => {
  it("allows when no rules match", () => {
    const registry = new AIPolicyRegistry();
    setAIPolicyRegistry(registry);

    const result = checkAIPolicy({
      orgId: "t1",
      actorId: "u1",
      model: "gpt-4",
      action: "completion",
    });
    expect(result.allowed).toBe(true);
  });

  it("denies when a deny rule matches", () => {
    const registry = new AIPolicyRegistry();
    registry.register({
      id: "block-dangerous",
      description: "Block restricted models",
      evaluate: (ctx) =>
        ctx.model === "dangerous-model"
          ? { allowed: false, reason: "Model is restricted", policyId: "block-dangerous" }
          : { allowed: true, reason: "OK" },
    });
    setAIPolicyRegistry(registry);

    const result = checkAIPolicy({
      orgId: "t1",
      actorId: "u1",
      model: "dangerous-model",
      action: "completion",
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("Model is restricted");
  });

  it("evaluates directly on registry instance", () => {
    const registry = new AIPolicyRegistry();
    const result = registry.evaluate({
      orgId: "t1",
      actorId: "u1",
      model: "gpt-4",
      action: "completion",
    });
    expect(result.allowed).toBe(true);
  });

  it("returns registered rules", () => {
    const registry = new AIPolicyRegistry();
    registry.register(restrictedDataPolicy);
    expect(registry.getRules()).toHaveLength(1);
  });
});

describe("built-in policies", () => {
  it("blocks restricted data classification", () => {
    const decision = restrictedDataPolicy.evaluate({
      orgId: "t1",
      actorId: "u1",
      action: "completion",
      model: "gpt-4",
      dataClassification: "restricted",
    });

    expect(decision.allowed).toBe(false);
    expect(decision.policyId).toBe("restricted-data-guard");
  });

  it("allows acceptable data classification", () => {
    const decision = restrictedDataPolicy.evaluate({
      orgId: "t1",
      actorId: "u1",
      action: "completion",
      model: "gpt-4",
      dataClassification: "internal",
    });

    expect(decision.allowed).toBe(true);
  });

  it("enforces model allowlist", () => {
    const rule = modelAllowlistPolicy(["gpt-4", "gpt-4.1-mini"]);

    const deny = rule.evaluate({
      orgId: "t1",
      actorId: "u1",
      action: "completion",
      model: "other-model",
    });
    const allow = rule.evaluate({
      orgId: "t1",
      actorId: "u1",
      action: "completion",
      model: "gpt-4",
    });

    expect(deny.allowed).toBe(false);
    expect(allow.allowed).toBe(true);
  });

  it("getAIPolicyRegistry returns singleton unless overridden", () => {
    const first = getAIPolicyRegistry();
    const second = getAIPolicyRegistry();
    expect(first).toBe(second);

    const replacement = new AIPolicyRegistry();
    setAIPolicyRegistry(replacement);
    expect(getAIPolicyRegistry()).toBe(replacement);
  });
});
