import { describe, it, expect } from "vitest";
import {
  InMemoryAILogStore,
  createAILogEntry,
  type AIRequest,
  type AIResponse,
} from "./index.js";

describe("createAILogEntry", () => {
  it("builds a hashed log entry from request and response", () => {
    const request: AIRequest = {
      model: "gpt-4.1-mini",
      orgId: "org-1",
      actorId: "user-1",
      prompt: "hello",
    };

    const response: AIResponse = {
      id: "resp-1",
      model: "gpt-4.1-mini",
      content: "world",
      tokensUsed: { prompt: 2, completion: 3, total: 5 },
      costUsd: 0.01,
      classification: "safe",
      durationMs: 12,
      timestamp: new Date().toISOString(),
    };

    const entry = createAILogEntry(request, response, {
      allowed: true,
      reason: "ok",
    });

    expect(entry.orgId).toBe("org-1");
    expect(entry.tokensUsed).toBe(5);
    expect(entry.promptHash).toHaveLength(64);
    expect(entry.responseHash).toHaveLength(64);
  });
});

describe("InMemoryAILogStore", () => {
  it("stores entries and filters by org", async () => {
    const store = new InMemoryAILogStore();

    const base = {
      id: "e1",
      timestamp: new Date().toISOString(),
      actorId: "user-1",
      model: "gpt-4.1-mini",
      promptHash: "a",
      responseHash: "b",
      tokensUsed: 10,
      costUsd: 0.1,
      classification: "safe" as const,
      durationMs: 20,
      policyDecision: { allowed: true, reason: "ok" },
    };

    await store.append({ ...base, orgId: "org-a" });
    await store.append({ ...base, id: "e2", orgId: "org-b" });
    await store.append({ ...base, id: "e3", orgId: "org-a" });

    const orgA = await store.getEntries("org-a");
    const limited = await store.getEntries("org-a", { limit: 1 });

    expect(orgA).toHaveLength(2);
    expect(limited).toHaveLength(1);
    expect(limited[0].id).toBe("e3");
  });
});
