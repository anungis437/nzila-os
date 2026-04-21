import { describe, it, expect } from "vitest";
import { calculateRunway, runwayStatus } from "../domain/runway";
import { scoreRisks } from "../domain/risk";
import { rankPriorities } from "../domain/priorities";

describe("runway domain", () => {
  it("calculates runway days correctly", () => {
    expect(calculateRunway({ cashOnHand: 100_000, monthlyBurn: 10_000 })).toBe(300);
  });

  it("returns Infinity when burn is zero", () => {
    expect(calculateRunway({ cashOnHand: 50_000, monthlyBurn: 0 })).toBe(Infinity);
  });

  it("floors partial days", () => {
    expect(calculateRunway({ cashOnHand: 100_000, monthlyBurn: 33_000 })).toBe(90);
  });

  it("marks runway < 60 days as critical", () => {
    expect(runwayStatus(45)).toBe("critical");
    expect(runwayStatus(59)).toBe("critical");
  });

  it("marks runway 60–119 days as warning", () => {
    expect(runwayStatus(60)).toBe("warning");
    expect(runwayStatus(90)).toBe("warning");
    expect(runwayStatus(119)).toBe("warning");
  });

  it("marks runway >= 120 days as healthy", () => {
    expect(runwayStatus(120)).toBe("healthy");
    expect(runwayStatus(365)).toBe("healthy");
    expect(runwayStatus(Infinity)).toBe("healthy");
  });
});

describe("risk domain", () => {
  it("flags critical runway < 30 days", () => {
    const risks = scoreRisks({
      runwayDays: 20,
      overdueInvoicesCount: 0,
      openDealsCount: 3,
      prioritiesCount: 3,
      lastActivityDays: 2,
    });
    const runwayRisk = risks.find((r) => r.label === "Low Runway");
    expect(runwayRisk?.level).toBe("critical");
  });

  it("flags high runway between 30–59 days", () => {
    const risks = scoreRisks({
      runwayDays: 45,
      overdueInvoicesCount: 0,
      openDealsCount: 3,
      prioritiesCount: 3,
      lastActivityDays: 2,
    });
    const runwayRisk = risks.find((r) => r.label === "Low Runway");
    expect(runwayRisk?.level).toBe("high");
  });

  it("returns no risks for healthy metrics", () => {
    const risks = scoreRisks({
      runwayDays: 180,
      overdueInvoicesCount: 0,
      openDealsCount: 5,
      prioritiesCount: 4,
      lastActivityDays: 3,
    });
    expect(risks).toHaveLength(0);
  });

  it("flags silent pipeline when no open deals", () => {
    const risks = scoreRisks({
      runwayDays: 200,
      overdueInvoicesCount: 0,
      openDealsCount: 0,
      prioritiesCount: 3,
      lastActivityDays: 5,
    });
    const pipeline = risks.find((r) => r.label === "Silent Pipeline");
    expect(pipeline?.level).toBe("high");
  });

  it("flags overdue invoices as high when > 3", () => {
    const risks = scoreRisks({
      runwayDays: 200,
      overdueInvoicesCount: 5,
      openDealsCount: 3,
      prioritiesCount: 3,
      lastActivityDays: 5,
    });
    const overdue = risks.find((r) => r.label === "Overdue Receivables");
    expect(overdue?.level).toBe("high");
  });
});

describe("priorities domain", () => {
  it("rank 1 is revenue when runway is healthy", () => {
    const ps = rankPriorities({
      runwayDays: 200,
      pipelineValue: 50_000,
      overdueInvoices: 0,
      topDeal: { name: "Acme Corp", value: 30_000 },
    });
    expect(ps[0]?.category).toBe("revenue");
    expect(ps[0]?.rank).toBe(1);
  });

  it("rank 1 is extend runway when runway < 90 days", () => {
    const ps = rankPriorities({
      runwayDays: 60,
      pipelineValue: 0,
      overdueInvoices: 0,
    });
    expect(ps[0]?.title).toBe("Extend Runway");
  });

  it("rank 1 is generate pipeline when no deals and healthy runway", () => {
    const ps = rankPriorities({
      runwayDays: 200,
      pipelineValue: 0,
      overdueInvoices: 0,
    });
    expect(ps[0]?.title).toBe("Generate Pipeline");
  });

  it("always returns 4 priorities", () => {
    const ps = rankPriorities({
      runwayDays: 180,
      pipelineValue: 20_000,
      overdueInvoices: 2,
    });
    expect(ps).toHaveLength(4);
  });

  it("rank 4 is always stop", () => {
    const ps = rankPriorities({
      runwayDays: 180,
      pipelineValue: 0,
      overdueInvoices: 0,
    });
    expect(ps[3]?.category).toBe("stop");
  });
});
