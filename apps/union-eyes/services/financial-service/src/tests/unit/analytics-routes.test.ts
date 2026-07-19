import { describe, it, expect, vi, beforeEach } from "vitest";
import { invokeRoute } from "./_route-harness";

const h = vi.hoisted(() => {
  const queue: any[] = [];
  function next() {
    const v = queue.shift();
    if (v instanceof Error) throw v;
    return v ?? [];
  }
  function makeChain(): any {
    const chain: any = {};
    for (const m of [
      "select",
      "from",
      "where",
      "limit",
      "orderBy",
      "groupBy",
      "leftJoin",
      "innerJoin",
    ]) {
      chain[m] = vi.fn(() => chain);
    }
    chain.then = (resolve: (v: any) => void, reject?: (e: any) => void) =>
      Promise.resolve()
        .then(() => next())
        .then(resolve, reject);
    chain.catch = (reject: (e: any) => void) => chain.then(undefined, reject);
    return chain;
  }
  const db: any = { select: vi.fn(() => makeChain()) };
  function makeTable(name: string) {
    return new Proxy(
      { __name: name },
      { get: (o: any, col: string) => (col in o ? o[col] : { __col: col }) },
    );
  }
  const predictor = {
    generateBurnRateForecast: vi.fn(),
    getHistoricalBurnRate: vi.fn(),
    detectSeasonalPatterns: vi.fn(),
    processAutomatedAlerts: vi.fn(),
    generateWeeklyForecastReport: vi.fn(),
  };
  return { queue, db, makeTable, predictor };
});

vi.mock("../../services/burn-rate-predictor", () => ({
  generateBurnRateForecast: h.predictor.generateBurnRateForecast,
  getHistoricalBurnRate: h.predictor.getHistoricalBurnRate,
  detectSeasonalPatterns: h.predictor.detectSeasonalPatterns,
  processAutomatedAlerts: h.predictor.processAutomatedAlerts,
  generateWeeklyForecastReport: h.predictor.generateWeeklyForecastReport,
}));
vi.mock("../../db", () => ({ db: h.db }));
vi.mock("../../db/schema", () => ({
  strikeFunds: h.makeTable("strike_funds"),
  donations: h.makeTable("donations"),
  duesTransactions: h.makeTable("dues_transactions"),
  stipendDisbursements: h.makeTable("stipend_disbursements"),
}));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import analyticsRouter from "../../routes/analytics";

const UUID = "11111111-1111-1111-1111-111111111111";
const HEADERS = { "x-organization-id": "org-1" };

function enqueue(...results: any[]) {
  h.queue.push(...results);
}

beforeEach(() => {
  h.queue.length = 0;
  h.db.select.mockClear();
  for (const fn of Object.values(h.predictor)) (fn as any).mockReset();
});

describe("analytics routes", () => {
  it("generates a forecast", async () => {
    h.predictor.generateBurnRateForecast.mockResolvedValue({ scenarios: [], alerts: [] });
    const r = await invokeRoute(analyticsRouter, "get", "/forecast/:fundId", {
      params: { fundId: UUID },
      query: { forecastDays: "30" },
      headers: HEADERS,
    });
    expect(r.statusCode).toBe(200);
  });

  it("returns 500 on invalid forecast params", async () => {
    const r = await invokeRoute(analyticsRouter, "get", "/forecast/:fundId", {
      params: { fundId: "not-a-uuid" },
      headers: HEADERS,
    });
    expect(r.statusCode).toBe(500);
  });

  it("fetches historical burn rate", async () => {
    h.predictor.getHistoricalBurnRate.mockResolvedValue([{ day: 1 }]);
    const r = await invokeRoute(analyticsRouter, "get", "/historical/:fundId", {
      params: { fundId: UUID },
      query: { startDate: "2025-01-01T00:00:00Z", endDate: "2025-01-31T00:00:00Z" },
      headers: HEADERS,
    });
    expect(r.statusCode).toBe(200);
  });

  it("returns 500 on invalid historical date range", async () => {
    const r = await invokeRoute(analyticsRouter, "get", "/historical/:fundId", {
      params: { fundId: UUID },
      query: {},
      headers: HEADERS,
    });
    expect(r.statusCode).toBe(500);
  });

  it("detects seasonal patterns", async () => {
    h.predictor.detectSeasonalPatterns.mockResolvedValue({ pattern: "stable" });
    const r = await invokeRoute(analyticsRouter, "get", "/seasonal/:fundId", {
      params: { fundId: UUID },
      headers: HEADERS,
    });
    expect(r.statusCode).toBe(200);
  });

  it("returns 500 when seasonal detection throws", async () => {
    h.predictor.detectSeasonalPatterns.mockRejectedValue(new Error("boom"));
    const r = await invokeRoute(analyticsRouter, "get", "/seasonal/:fundId", {
      params: { fundId: UUID },
      headers: HEADERS,
    });
    expect(r.statusCode).toBe(500);
  });

  it("processes automated alerts", async () => {
    h.predictor.processAutomatedAlerts.mockResolvedValue(3);
    const r = await invokeRoute(analyticsRouter, "post", "/alerts/process", { headers: HEADERS });
    expect(r.statusCode).toBe(200);
    expect((r.body as any).alertsSent).toBe(3);
  });

  it("returns 500 when alert processing throws", async () => {
    h.predictor.processAutomatedAlerts.mockRejectedValue(new Error("boom"));
    const r = await invokeRoute(analyticsRouter, "post", "/alerts/process", { headers: HEADERS });
    expect(r.statusCode).toBe(500);
  });

  it("generates a weekly report", async () => {
    h.predictor.generateWeeklyForecastReport.mockResolvedValue(undefined);
    const r = await invokeRoute(analyticsRouter, "post", "/reports/weekly", {
      user: { id: "u1" },
      headers: HEADERS,
    });
    expect(r.statusCode).toBe(200);
  });

  it("requires a user id for the weekly report", async () => {
    const r = await invokeRoute(analyticsRouter, "post", "/reports/weekly", { user: {}, headers: HEADERS });
    expect(r.statusCode).toBe(400);
  });

  it("returns the financial summary", async () => {
    enqueue(
      [{ count: 2 }],
      [{ totalDonations: 5000 }],
      [{ totalStipends: 1000 }],
      [{ count: 10, total: 3000 }],
      [{ count: 4, total: 800 }],
      [{ count: 6, total: 1200 }],
    );
    const r = await invokeRoute(analyticsRouter, "get", "/summary", { headers: HEADERS });
    expect(r.statusCode).toBe(200);
    expect((r.body as any).summary.strikeFunds.count).toBe(2);
  });

  it("returns 500 when summary query throws", async () => {
    enqueue(new Error("db"));
    const r = await invokeRoute(analyticsRouter, "get", "/summary", { headers: HEADERS });
    expect(r.statusCode).toBe(500);
  });

  it("returns financial trends", async () => {
    enqueue(
      [{ date: "2025-01-01", amount: 100, count: 2 }],
      [{ date: "2025-01-02", amount: 50, count: 1 }],
    );
    const r = await invokeRoute(analyticsRouter, "get", "/trends", { query: { days: "30" }, headers: HEADERS });
    expect(r.statusCode).toBe(200);
    expect((r.body as any).trends.donations).toHaveLength(1);
  });

  it("returns top donors", async () => {
    enqueue([
      { donorEmail: "a@x.com", donorName: "A", totalAmount: 500, donationCount: 3, lastDonation: new Date() },
    ]);
    const r = await invokeRoute(analyticsRouter, "get", "/top-donors", { query: { limit: "5" }, headers: HEADERS });
    expect(r.statusCode).toBe(200);
    expect((r.body as any).topDonors).toHaveLength(1);
  });

  it("returns fund health with forecast and fallback branches", async () => {
    enqueue(
      [
        { id: "f1", fundName: "Fund One", targetAmount: "1000" },
        { id: "f2", fundName: "Fund Two", targetAmount: null },
      ],
      [{ totalDonations: 500, totalStipends: 100 }],
      [{ totalDonations: 200, totalStipends: 0 }],
      [{ totalDonations: 200, totalStipends: 0 }],
    );
    h.predictor.generateBurnRateForecast
      .mockResolvedValueOnce({ scenarios: [{ scenario: "realistic", daysRemaining: 45 }], alerts: [] })
      .mockRejectedValueOnce(new Error("no forecast"));
    const r = await invokeRoute(analyticsRouter, "get", "/fund-health", { headers: HEADERS });
    expect(r.statusCode).toBe(200);
    expect((r.body as any).funds).toHaveLength(2);
  });

  it("returns 500 when fund health query throws", async () => {
    enqueue(new Error("db"));
    const r = await invokeRoute(analyticsRouter, "get", "/fund-health", { headers: HEADERS });
    expect(r.statusCode).toBe(500);
  });
});
