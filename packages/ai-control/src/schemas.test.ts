import { describe, it, expect } from "vitest";
import {
  aiRequestSchema,
  aiResponseSchema,
  budgetConfigSchema,
  aiPolicyContextSchema,
  aiPolicyDecisionSchema,
  aiLogEntrySchema,
} from "./index.js";

describe("schemas", () => {
  it("parses request and response payloads", () => {
    const request = aiRequestSchema.parse({
      model: "gpt-4.1-mini",
      orgId: "org-1",
      actorId: "user-1",
      prompt: "Hello",
      temperature: 0.2,
      maxTokens: 100,
    });

    const response = aiResponseSchema.parse({
      id: "resp-1",
      model: request.model,
      content: "Hi",
      tokensUsed: { prompt: 2, completion: 3, total: 5 },
      costUsd: 0.05,
      classification: "warning",
      durationMs: 8,
      timestamp: new Date().toISOString(),
    });

    expect(request.model).toBe("gpt-4.1-mini");
    expect(response.tokensUsed.total).toBe(5);
  });

  it("applies schema defaults and optional fields", () => {
    const budget = budgetConfigSchema.parse({
      orgId: "org-1",
      monthlyCapUsd: 100,
    });

    const context = aiPolicyContextSchema.parse({
      orgId: "org-1",
      actorId: "user-1",
      model: "gpt-4.1-mini",
      action: "ai.invoke",
    });

    const decision = aiPolicyDecisionSchema.parse({
      allowed: false,
      reason: "blocked",
      policyId: "p-1",
      restrictions: ["restricted-data"],
    });

    const entry = aiLogEntrySchema.parse({
      id: "log-1",
      timestamp: new Date().toISOString(),
      orgId: "org-1",
      actorId: "user-1",
      model: "gpt-4.1-mini",
      promptHash: "a",
      responseHash: "b",
      tokensUsed: 5,
      costUsd: 0.01,
      classification: "safe",
      durationMs: 10,
      policyDecision: decision,
    });

    expect(budget.warningThresholdPercent).toBe(80);
    expect(context.role).toBeUndefined();
    expect(entry.policyDecision.allowed).toBe(false);
  });
});
