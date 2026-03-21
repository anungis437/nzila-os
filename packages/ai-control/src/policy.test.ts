import { describe, it, expect } from "vitest";
import { AIPolicyRegistry, checkAIPolicy, setAIPolicyRegistry } from "./policy.js";

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
});
