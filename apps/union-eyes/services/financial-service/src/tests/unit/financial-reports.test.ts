import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => {
  const queue: any[] = [];
  function next() {
    const v = queue.shift();
    if (v instanceof Error) throw v;
    return v ?? [];
  }
  const db: any = { execute: vi.fn(async () => next()) };
  return { queue, db };
});

vi.mock("../../db", () => ({ db: h.db }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import * as reports from "../../services/financial-reports";

function enqueue(...results: any[]) {
  h.queue.push(...results);
}

const range = {
  startDate: new Date("2025-01-01T00:00:00.000Z"),
  endDate: new Date("2025-01-31T00:00:00.000Z"),
};

beforeEach(() => {
  h.queue.length = 0;
  h.db.execute.mockClear();
});

describe("getCollectionMetrics", () => {
  it("computes collection and payment rates", async () => {
    enqueue(
      [{ total: "1000", count: "50" }], // charged
      [{ total: "800", count: "40" }], // collected
      [{ total: "200" }], // outstanding
      [{ avg_days: "3.4" }], // payment time
    );
    const m = await reports.getCollectionMetrics("org-1", range);
    expect(m.totalDuesCharged).toBe(1000);
    expect(m.totalCollected).toBe(800);
    expect(m.collectionRate).toBe(80);
    expect(m.paymentRate).toBe(80);
    expect(m.outstandingAmount).toBe(200);
    expect(m.averagePaymentTime).toBe(3.4);
  });

  it("guards against divide-by-zero", async () => {
    enqueue([{ total: "0", count: "0" }], [{ total: "0", count: "0" }], [{ total: "0" }], [{ avg_days: "0" }]);
    const m = await reports.getCollectionMetrics("org-1", range);
    expect(m.collectionRate).toBe(0);
    expect(m.paymentRate).toBe(0);
  });

  it("throws and logs on db error", async () => {
    enqueue(new Error("db fail"));
    await expect(reports.getCollectionMetrics("org-1", range)).rejects.toThrow("db fail");
  });
});

describe("getArrearsStatistics", () => {
  it("aggregates cases by status and escalation and finds the oldest case", async () => {
    enqueue(
      [{ count: "5", total: "1200.50" }], // total
      [
        { status: "open", count: "3" },
        { status: "in_progress", count: "2" },
      ],
      [
        { level: "1", count: "2" },
        { level: "2", count: "3" },
      ],
      [{ avg_days: "45.6" }],
      [{ id: "c1", member_id: "m1", days_overdue: "120", total_owed: "500" }],
    );
    const stats = await reports.getArrearsStatistics("org-1");
    expect(stats.totalCases).toBe(5);
    expect(stats.totalOwed).toBe(1200.5);
    expect(stats.casesByStatus).toEqual({ open: 3, in_progress: 2 });
    expect(stats.casesByEscalationLevel).toEqual({ 1: 2, 2: 3 });
    expect(stats.averageDaysOverdue).toBe(45.6);
    expect(stats.oldestCase).toEqual({ id: "c1", memberId: "m1", daysOverdue: 120, totalOwed: 500 });
  });

  it("returns null oldest case when none found", async () => {
    enqueue([{ count: "0", total: "0" }], [], [], [{ avg_days: "0" }], []);
    const stats = await reports.getArrearsStatistics("org-1");
    expect(stats.oldestCase).toBeNull();
  });

  it("throws on db error", async () => {
    enqueue(new Error("boom"));
    await expect(reports.getArrearsStatistics("org-1")).rejects.toThrow("boom");
  });
});

describe("getRevenueAnalysis", () => {
  it("computes total, monthly breakdown, by-type, and growth rate", async () => {
    enqueue(
      [{ total: "5000" }], // revenue
      [
        { month: "2025-01", amount: "1000", count: "10" },
        { month: "2025-02", amount: "1500", count: "12" },
      ],
      [
        { type: "payment", amount: "4000" },
        { type: "adjustment", amount: "1000" },
      ],
    );
    const r = await reports.getRevenueAnalysis("org-1", range);
    expect(r.totalRevenue).toBe(5000);
    expect(r.revenueByMonth).toHaveLength(2);
    expect(r.revenueByType).toEqual({ payment: 4000, adjustment: 1000 });
    // growth = (1500-1000)/1000 * 100 = 50
    expect(r.growthRate).toBe(50);
  });

  it("yields zero growth with fewer than two months", async () => {
    enqueue([{ total: "1000" }], [{ month: "2025-01", amount: "1000", count: "10" }], []);
    const r = await reports.getRevenueAnalysis("org-1", range);
    expect(r.growthRate).toBe(0);
  });

  it("throws on db error", async () => {
    enqueue(new Error("boom"));
    await expect(reports.getRevenueAnalysis("org-1", range)).rejects.toThrow("boom");
  });
});

describe("getMemberPaymentPatterns", () => {
  it("computes a reliability score per member", async () => {
    enqueue([
      {
        member_id: "m1",
        total_transactions: "10",
        total_paid: "500.25",
        avg_payment: "50.05",
        on_time: "8",
        late: "1",
        missed: "1",
        last_payment: new Date("2025-01-20T00:00:00.000Z"),
      },
    ]);
    const patterns = await reports.getMemberPaymentPatterns("org-1", range);
    expect(patterns).toHaveLength(1);
    // (8*1 + 1*0.5)/10 * 100 = 85
    expect(patterns[0].paymentReliabilityScore).toBe(85);
    expect(patterns[0].totalPaid).toBe(500.25);
  });

  it("scores zero when there are no transactions", async () => {
    enqueue([
      {
        member_id: "m1",
        total_transactions: "0",
        total_paid: "0",
        avg_payment: "0",
        on_time: "0",
        late: "0",
        missed: "0",
        last_payment: null,
      },
    ]);
    const patterns = await reports.getMemberPaymentPatterns("org-1", range, 5);
    expect(patterns[0].paymentReliabilityScore).toBe(0);
  });

  it("throws on db error", async () => {
    enqueue(new Error("boom"));
    await expect(reports.getMemberPaymentPatterns("org-1", range)).rejects.toThrow("boom");
  });
});

describe("getFinancialDashboard", () => {
  it("assembles all sections (queries return empty datasets)", async () => {
    // empty queue -> every db.execute resolves [] -> zeroed sub-reports, no throws
    const dashboard = await reports.getFinancialDashboard("org-1", range);
    expect(dashboard.collectionMetrics.totalDuesCharged).toBe(0);
    expect(dashboard.arrearsStats.oldestCase).toBeNull();
    expect(dashboard.revenueAnalysis.totalRevenue).toBe(0);
    expect(dashboard.topPayers).toEqual([]);
    expect(typeof dashboard.generatedAt).toBe("string");
  });

  it("propagates errors from sub-reports", async () => {
    enqueue(new Error("dashboard fail"));
    await expect(reports.getFinancialDashboard("org-1", range)).rejects.toThrow();
  });
});
