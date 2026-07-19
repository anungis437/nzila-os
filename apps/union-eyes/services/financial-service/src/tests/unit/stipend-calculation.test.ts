import { describe, it, expect, vi, beforeEach } from "vitest";

// Queue-driven, table/op-agnostic drizzle builder mock. Each awaited query
// resolves the next item pushed onto `queue`.
const h = vi.hoisted(() => {
  const queue: any[] = [];
  function makeChain(): any {
    const chain: any = {};
    const methods = [
      "select",
      "from",
      "where",
      "limit",
      "groupBy",
      "orderBy",
      "values",
      "returning",
      "set",
      "onConflictDoUpdate",
      "innerJoin",
      "leftJoin",
    ];
    for (const m of methods) chain[m] = vi.fn(() => chain);
    chain.then = (resolve: (v: any) => void, reject?: (e: any) => void) => {
      const next = queue.shift();
      if (next instanceof Error) return reject ? reject(next) : Promise.reject(next);
      return resolve(next ?? []);
    };
    return chain;
  }
  const db: any = {
    select: vi.fn(() => makeChain()),
    insert: vi.fn(() => makeChain()),
    update: vi.fn(() => makeChain()),
    delete: vi.fn(() => makeChain()),
  };
  const schema: any = new Proxy(
    {},
    {
      get: (_t, table: string) =>
        new Proxy({ __name: table }, { get: (o: any, col: string) => (col in o ? o[col] : { __col: col }) }),
    },
  );
  return { queue, db, schema };
});

vi.mock("../../db", () => ({ db: h.db, schema: h.schema }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import * as stipend from "../../services/stipend-calculation";

function enqueue(...results: any[]) {
  h.queue.push(...results);
}

beforeEach(() => {
  h.queue.length = 0;
  h.db.select.mockClear();
  h.db.insert.mockClear();
  h.db.update.mockClear();
});

const week = {
  weekStartDate: new Date("2025-01-06T00:00:00.000Z"),
  weekEndDate: new Date("2025-01-12T00:00:00.000Z"),
};

describe("calculateWeeklyStipends", () => {
  it("computes eligibility using fund configuration", async () => {
    enqueue(
      [{ id: "sf-1", minimumAttendanceHours: "20", weeklyStipendAmount: "300" }], // strike fund
      [
        { memberId: "m1", totalHours: "25" }, // eligible
        { memberId: "m2", totalHours: "10" }, // not eligible
      ],
    );
    const result = await stipend.calculateWeeklyStipends({
      organizationId: "org-1",
      strikeFundId: "sf-1",
      ...week,
    });
    expect(result).toHaveLength(2);
    const m1 = result.find((r) => r.memberId === "m1")!;
    // fundHourlyRate = 300/20 = 15; 25 * 15 = 375
    expect(m1.eligible).toBe(true);
    expect(m1.stipendAmount).toBe(375);
    const m2 = result.find((r) => r.memberId === "m2")!;
    expect(m2.eligible).toBe(false);
    expect(m2.stipendAmount).toBe(0);
    expect(m2.reason).toMatch(/Insufficient hours/);
  });

  it("uses request defaults when fund has no config", async () => {
    enqueue([{ id: "sf-1", minimumAttendanceHours: null, weeklyStipendAmount: null }], [
      { memberId: "m1", totalHours: "30" },
    ]);
    const result = await stipend.calculateWeeklyStipends({
      organizationId: "org-1",
      strikeFundId: "sf-1",
      ...week,
    });
    // default rate 15, 30*15 = 450
    expect(result[0].stipendAmount).toBe(450);
  });

  it("throws when the strike fund is not found", async () => {
    enqueue([]); // no strike fund
    await expect(
      stipend.calculateWeeklyStipends({ organizationId: "org-1", strikeFundId: "missing", ...week }),
    ).rejects.toThrow(/Failed to calculate stipends/);
  });
});

describe("createDisbursement", () => {
  it("returns the created disbursement id on success", async () => {
    enqueue([{ id: "disb-1" }]);
    const result = await stipend.createDisbursement({
      organizationId: "org-1",
      strikeFundId: "sf-1",
      memberId: "m1",
      amount: 300,
      ...week,
      approvedBy: "admin",
      paymentMethod: "direct_deposit",
    });
    expect(result.success).toBe(true);
    expect(result.disbursementId).toBe("disb-1");
  });

  it("returns an error when insert fails", async () => {
    enqueue(new Error("db down"));
    const result = await stipend.createDisbursement({
      organizationId: "org-1",
      strikeFundId: "sf-1",
      memberId: "m1",
      amount: 300,
      ...week,
      approvedBy: "admin",
      paymentMethod: "check",
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe("Failed to create disbursement");
  });
});

describe("approveDisbursement", () => {
  it("approves a pending disbursement", async () => {
    enqueue([{ id: "disb-1", status: "pending" }], undefined);
    const result = await stipend.approveDisbursement("org-1", {
      disbursementId: "disb-1",
      approvedBy: "admin",
    });
    expect(result.success).toBe(true);
  });

  it("rejects when disbursement is not found", async () => {
    enqueue([]);
    const result = await stipend.approveDisbursement("org-1", {
      disbursementId: "ghost",
      approvedBy: "admin",
    });
    expect(result).toEqual({ success: false, error: "Disbursement not found" });
  });

  it("rejects when disbursement is not pending", async () => {
    enqueue([{ id: "disb-1", status: "approved" }]);
    const result = await stipend.approveDisbursement("org-1", {
      disbursementId: "disb-1",
      approvedBy: "admin",
    });
    expect(result.error).toMatch(/already approved/);
  });
});

describe("markDisbursementPaid", () => {
  it("marks an approved disbursement as paid", async () => {
    enqueue([{ id: "disb-1", status: "approved" }], undefined);
    const result = await stipend.markDisbursementPaid("org-1", "disb-1", "txn-1", "admin");
    expect(result.success).toBe(true);
  });

  it("requires the disbursement to be approved first", async () => {
    enqueue([{ id: "disb-1", status: "pending" }]);
    const result = await stipend.markDisbursementPaid("org-1", "disb-1", "txn-1", "admin");
    expect(result.error).toMatch(/must be approved first/);
  });

  it("returns not found when missing", async () => {
    enqueue([]);
    const result = await stipend.markDisbursementPaid("org-1", "ghost", "txn-1", "admin");
    expect(result.error).toBe("Disbursement not found");
  });
});

describe("getMemberDisbursements", () => {
  it("returns parsed disbursements (with optional strikeFundId filter)", async () => {
    enqueue([{ id: "d1", totalAmount: "300.50" }]);
    const result = await stipend.getMemberDisbursements("org-1", "m1", "sf-1");
    expect(result[0].amount).toBe(300.5);
  });

  it("returns an empty array on error", async () => {
    enqueue(new Error("boom"));
    const result = await stipend.getMemberDisbursements("org-1", "m1");
    expect(result).toEqual([]);
  });
});

describe("getPendingDisbursements", () => {
  it("returns parsed pending disbursements", async () => {
    enqueue([{ id: "d1", totalAmount: "100.00" }]);
    const result = await stipend.getPendingDisbursements("org-1", "sf-1");
    expect(result[0].amount).toBe(100);
  });

  it("returns an empty array on error", async () => {
    enqueue(new Error("boom"));
    const result = await stipend.getPendingDisbursements("org-1", "sf-1");
    expect(result).toEqual([]);
  });
});

describe("getStrikeFundDisbursementSummary", () => {
  it("aggregates totals by status", async () => {
    enqueue([
      { status: "pending", totalAmount: "100", memberCount: 2 },
      { status: "approved", totalAmount: "200", memberCount: 3 },
      { status: "paid", totalAmount: "300", memberCount: 5 },
    ]);
    const result = await stipend.getStrikeFundDisbursementSummary("org-1", "sf-1");
    expect(result).toEqual({
      totalPending: 100,
      totalApproved: 200,
      totalPaid: 300,
      memberCount: 5,
    });
  });

  it("returns zeroed summary on error", async () => {
    enqueue(new Error("boom"));
    const result = await stipend.getStrikeFundDisbursementSummary("org-1", "sf-1");
    expect(result).toEqual({ totalPending: 0, totalApproved: 0, totalPaid: 0, memberCount: 0 });
  });
});

describe("batchCreateDisbursements", () => {
  it("creates disbursements for all eligible members", async () => {
    enqueue(
      [{ id: "sf-1", minimumAttendanceHours: "20", weeklyStipendAmount: "300" }], // fund
      [
        { memberId: "m1", totalHours: "25" }, // eligible -> create
        { memberId: "m2", totalHours: "5" }, // skipped
      ],
      [{ id: "disb-1" }], // createDisbursement for m1
    );
    const result = await stipend.batchCreateDisbursements({
      organizationId: "org-1",
      strikeFundId: "sf-1",
      ...week,
      approvedBy: "admin",
      paymentMethod: "direct_deposit",
    });
    expect(result.success).toBe(true);
    expect(result.created).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.disbursementIds).toEqual(["disb-1"]);
  });

  it("records errors when a disbursement fails to create", async () => {
    enqueue(
      [{ id: "sf-1", minimumAttendanceHours: "20", weeklyStipendAmount: "300" }],
      [{ memberId: "m1", totalHours: "25" }],
      new Error("insert failed"), // createDisbursement error path
    );
    const result = await stipend.batchCreateDisbursements({
      organizationId: "org-1",
      strikeFundId: "sf-1",
      ...week,
      approvedBy: "admin",
      paymentMethod: "check",
    });
    expect(result.created).toBe(0);
    expect(result.errors).toHaveLength(1);
  });

  it("fails gracefully when stipend calculation throws", async () => {
    enqueue([]); // no strike fund -> calculateWeeklyStipends throws
    const result = await stipend.batchCreateDisbursements({
      organizationId: "org-1",
      strikeFundId: "missing",
      ...week,
      approvedBy: "admin",
      paymentMethod: "cash",
    });
    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
  });
});
