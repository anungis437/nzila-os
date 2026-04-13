import { describe, it, expect } from "vitest";
import {
  AIControlError,
  InMemoryBudgetStore,
  InMemoryAILogStore,
  AIPolicyRegistry,
  runAI,
  type AIRunnerConfig,
  type AIProvider,
  type AIRequest,
} from "./index.js";

function makeProvider(content = "safe output", costUsd = 0.5): AIProvider {
  return {
    name: "test-provider",
    async invoke() {
      return {
        content,
        tokensUsed: { prompt: 10, completion: 5, total: 15 },
        costUsd,
      };
    },
  };
}

function makeConfig(overrides?: Partial<AIRunnerConfig>): AIRunnerConfig {
  const budgetStore = new InMemoryBudgetStore();
  budgetStore.setConfig({
    orgId: "org-1",
    monthlyCapUsd: 100,
    warningThresholdPercent: 80,
  });

  return {
    provider: makeProvider(),
    budgetStore,
    logStore: new InMemoryAILogStore(),
    ...overrides,
  };
}

const request: AIRequest = {
  model: "gpt-4.1-mini",
  orgId: "org-1",
  actorId: "user-1",
  prompt: "Write a short summary",
};

describe("runAI", () => {
  it("runs end-to-end and logs an entry", async () => {
    const config = makeConfig();

    const result = await runAI(config, request);
    expect(result.model).toBe("gpt-4.1-mini");
    expect(result.classification).toBe("safe");

    const entries = await config.logStore.getEntries("org-1");
    expect(entries).toHaveLength(1);
    expect(entries[0].orgId).toBe("org-1");
  });

  it("uses a custom classifier when provided", async () => {
    const config = makeConfig({
      classifier: {
        rules: [],
        classify() {
          return {
            classification: "warning",
            matchedRules: ["custom"],
            reasons: ["custom rule"],
          };
        },
      },
    });

    const result = await runAI(config, request);
    expect(result.classification).toBe("warning");
  });

  it("throws POLICY_DENIED when policy denies", async () => {
    const registry = new AIPolicyRegistry();
    registry.register({
      id: "deny-all",
      description: "deny all",
      evaluate: () => ({ allowed: false, reason: "blocked", policyId: "deny-all" }),
    });

    const config = makeConfig({ policyRegistry: registry });

    await expect(runAI(config, request)).rejects.toMatchObject({
      code: "POLICY_DENIED",
    } satisfies Partial<AIControlError>);
  });

  it("throws BUDGET_EXCEEDED when budget is blocked", async () => {
    const budgetStore = new InMemoryBudgetStore();
    budgetStore.setConfig({
      orgId: "org-1",
      monthlyCapUsd: 1,
      warningThresholdPercent: 80,
    });
    await budgetStore.recordSpend("org-1", "2026-01", 0);

    const config = {
      provider: makeProvider("ok", 1),
      budgetStore,
      logStore: new InMemoryAILogStore(),
    } satisfies AIRunnerConfig;

    await budgetStore.recordSpend("org-1", new Date().toISOString().slice(0, 7), 1);

    await expect(runAI(config, request)).rejects.toMatchObject({
      code: "BUDGET_EXCEEDED",
    } satisfies Partial<AIControlError>);
  });
});
