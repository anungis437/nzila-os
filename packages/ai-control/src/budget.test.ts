import { describe, it, expect } from "vitest";
import { InMemoryBudgetStore, checkBudget, recordSpend } from "./budget.js";

describe("Budget enforcement", () => {
  it("allows spend within budget", async () => {
    const store = new InMemoryBudgetStore();
    store.setConfig({
      orgId: "t1",
      monthlyCapUsd: 100,
      warningThresholdPercent: 80,
    });

    const result = await checkBudget(store, "t1");
    expect(result.status).toBe("ok");
    expect(result.remainingUsd).toBe(100);
  });

  it("tracks spend accumulation", async () => {
    const store = new InMemoryBudgetStore();
    store.setConfig({
      orgId: "t1",
      monthlyCapUsd: 100,
      warningThresholdPercent: 80,
    });

    await recordSpend(store, "t1", 60);
    const result = await checkBudget(store, "t1");
    expect(result.status).toBe("ok");
    expect(result.remainingUsd).toBe(40);
  });

  it("blocks when over monthly cap", async () => {
    const store = new InMemoryBudgetStore();
    store.setConfig({
      orgId: "t1",
      monthlyCapUsd: 100,
      warningThresholdPercent: 80,
    });

    await recordSpend(store, "t1", 100);
    const result = await checkBudget(store, "t1");
    expect(result.status).toBe("blocked");
  });

  it("warns when above warning threshold", async () => {
    const store = new InMemoryBudgetStore();
    store.setConfig({
      orgId: "t1",
      monthlyCapUsd: 100,
      warningThresholdPercent: 80,
    });

    await recordSpend(store, "t1", 85);
    const result = await checkBudget(store, "t1");
    expect(result.status).toBe("warning");
  });

  it("blocks when no config exists", async () => {
    const store = new InMemoryBudgetStore();
    const result = await checkBudget(store, "unknown-org");
    expect(result.status).toBe("blocked");
  });

  it("enforces role-specific caps", async () => {
    const store = new InMemoryBudgetStore();
    store.setConfig({
      orgId: "t1",
      monthlyCapUsd: 100,
      warningThresholdPercent: 80,
      roles: { viewer: { monthlyCapUsd: 20 } },
    });

    await recordSpend(store, "t1", 20);
    const result = await checkBudget(store, "t1", "viewer");
    expect(result.status).toBe("blocked");
  });
});
