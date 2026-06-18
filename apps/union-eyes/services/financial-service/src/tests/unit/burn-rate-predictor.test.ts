import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => {
  const queue: any[] = [];
  function next() {
    const v = queue.shift();
    if (v instanceof Error) throw v;
    return v ?? [];
  }
  function makeChain(): any {
    const chain: any = {};
    for (const m of ["select", "from", "where", "limit", "groupBy", "orderBy", "leftJoin", "innerJoin"]) {
      chain[m] = vi.fn(() => chain);
    }
    chain.then = (resolve: (v: any) => void, reject?: (e: any) => void) => {
      try {
        return resolve(next());
      } catch (e) {
        return reject ? reject(e) : Promise.reject(e);
      }
    };
    return chain;
  }
  const db: any = { select: vi.fn(() => makeChain()) };
  const tableCache: Record<string, any> = {};
  const schema: any = new Proxy(
    {},
    {
      get: (_t, table: string) => {
        if (table === "__esModule") return true;
        if (!tableCache[table]) {
          tableCache[table] = new Proxy(
            { __name: table },
            { get: (o: any, col: string) => (col in o ? o[col] : { __col: col }) },
          );
        }
        return tableCache[table];
      },
      has: () => true,
    },
  );
  const queueNotification = vi.fn(async () => {});
  return { queue, db, schema, queueNotification };
});

vi.mock("../../db", () => ({ db: h.db }));
vi.mock("../../db/schema", () => h.schema);
vi.mock("../../services/notification-service", () => ({ queueNotification: h.queueNotification }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import {
  getHistoricalBurnRate,
  detectSeasonalPatterns,
  generateBurnRateForecast,
  processAutomatedAlerts,
  generateWeeklyForecastReport,
} from "../../services/burn-rate-predictor";

function enqueue(...results: any[]) {
  h.queue.push(...results);
}

// The six queries a single generateBurnRateForecast performs, in order.
function forecastResults(opts: {
  fund: any;
  balance: any;
  don?: any[];
  stip?: any[];
}) {
  const don = opts.don ?? [];
  const stip = opts.stip ?? [];
  return [
    [opts.fund], // 1. fund lookup (limit 1)
    [opts.balance], // 2. balance aggregate
    don, // 3. donation history (90d)
    stip, // 4. stipend history (90d)
    don, // 5. donation history (12mo, via detectSeasonalPatterns)
    stip, // 6. stipend history (12mo)
  ];
}

beforeEach(() => {
  h.queue.length = 0;
  h.db.select.mockClear();
  h.queueNotification.mockClear();
});

describe("getHistoricalBurnRate", () => {
  it("merges donations and stipends into sorted daily records with running balance", async () => {
    enqueue(
      [
        { date: "2025-01-02", amount: "2000" },
        { date: "2025-01-01", amount: "1000" },
      ],
      [
        { date: "2025-01-01", amount: "300" },
        { date: "2025-01-03", amount: "800" },
      ],
    );
    const data = await getHistoricalBurnRate(
      "org-1",
      "f1",
      new Date("2025-01-01"),
      new Date("2025-01-31"),
    );
    expect(data).toHaveLength(3);
    // sorted ascending by date
    expect(data[0].balance).toBe(700); // 1000 - 300
    expect(data[0].withdrawals).toBe(300);
    expect(data[1].balance).toBe(2700); // +2000
    expect(data[2].balance).toBe(1900); // -800
  });

  it("returns an empty array when there is no history", async () => {
    enqueue([], []);
    const data = await getHistoricalBurnRate("org-1", "f1", new Date(), new Date());
    expect(data).toEqual([]);
  });
});

describe("detectSeasonalPatterns", () => {
  it("returns 12 monthly patterns", async () => {
    enqueue(
      [{ date: "2025-01-15", amount: "1000" }],
      [{ date: "2025-01-15", amount: "400" }],
    );
    const patterns = await detectSeasonalPatterns("org-1", "f1");
    expect(patterns).toHaveLength(12);
    expect(patterns.every((p) => typeof p.avgBurnRate === "number")).toBe(true);
  });
});

describe("generateBurnRateForecast", () => {
  it("produces three scenarios with recommendations and alerts", async () => {
    enqueue(
      ...forecastResults({
        fund: { id: "f1", fundName: "Fund A", targetAmount: "100000", createdBy: "admin" },
        balance: { totalDonations: 100000, totalStipends: 10000 },
        don: [
          { date: "2025-01-01", amount: "1000" },
          { date: "2025-01-02", amount: "1500" },
        ],
        stip: [
          { date: "2025-01-01", amount: "200" },
          { date: "2025-01-03", amount: "300" },
        ],
      }),
    );
    const forecast = await generateBurnRateForecast("org-1", "f1");
    expect(forecast.fundName).toBe("Fund A");
    expect(forecast.currentBalance).toBe(90000); // 100000 - 10000
    expect(forecast.scenarios.map((s) => s.scenario)).toEqual([
      "optimistic",
      "realistic",
      "pessimistic",
    ]);
    expect(Array.isArray(forecast.recommendations)).toBe(true);
    expect(forecast.alerts.length).toBeGreaterThan(0);
  });

  it("throws when the strike fund is not found", async () => {
    enqueue([]); // fund lookup -> none
    await expect(generateBurnRateForecast("org-1", "missing")).rejects.toThrow(
      "Strike fund not found",
    );
  });
});

describe("processAutomatedAlerts", () => {
  it("queues notifications for funds with warning/critical alerts", async () => {
    enqueue(
      [{ id: "f1", fundName: "F1", createdBy: "admin" }], // activeFunds
      ...forecastResults({
        fund: { id: "f1", fundName: "F1", targetAmount: "4000", createdBy: "admin" },
        balance: { totalDonations: 1000, totalStipends: 0 }, // balance 1000
        don: [{ date: "2025-01-01", amount: "0" }],
        stip: [
          { date: "2025-01-01", amount: "500" },
          { date: "2025-01-02", amount: "500" },
        ], // burn 500/day -> ~2 days runway -> warning
      }),
    );
    const result = await processAutomatedAlerts({ organizationId: "org-1" });
    expect(result.success).toBe(true);
    expect(result.alertsSent).toBeGreaterThanOrEqual(1);
    expect(h.queueNotification).toHaveBeenCalled();
  });

  it("returns zero alerts when there are no funds", async () => {
    enqueue([]); // no funds
    const result = await processAutomatedAlerts({ organizationId: "org-1" });
    expect(result).toEqual({ success: true, alertsSent: 0, alerts: [] });
  });
});

describe("generateWeeklyForecastReport", () => {
  it("summarizes funds and sends a report notification", async () => {
    enqueue(
      [{ id: "f1", fundName: "F1", createdBy: "admin" }], // activeFunds
      ...forecastResults({
        fund: { id: "f1", fundName: "F1", targetAmount: "100000", createdBy: "admin" },
        balance: { totalDonations: 100000, totalStipends: 0 },
        don: [{ date: "2025-01-01", amount: "5000" }],
        stip: [{ date: "2025-01-01", amount: "100" }],
      }),
    );
    const report = await generateWeeklyForecastReport({ organizationId: "org-1" });
    expect(report.success).toBe(true);
    expect(report.totalFunds).toBe(1);
    expect(h.queueNotification).toHaveBeenCalled();
  });
});
