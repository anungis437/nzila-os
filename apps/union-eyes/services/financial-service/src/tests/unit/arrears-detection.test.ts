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
    for (const m of ["select", "from", "where", "limit", "groupBy", "orderBy", "values", "returning", "set"]) {
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
  const db: any = {
    execute: vi.fn(async () => next()),
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

import * as arrears from "../../services/arrears-detection";

function enqueue(...results: any[]) {
  h.queue.push(...results);
}

beforeEach(() => {
  h.queue.length = 0;
  h.db.execute.mockClear();
});

describe("detectOverduePayments", () => {
  it("groups overdue transactions by member and aggregates owing", async () => {
    const old = new Date(Date.now() - 100 * 86400000).toISOString();
    const older = new Date(Date.now() - 200 * 86400000).toISOString();
    enqueue([
      { id: "t1", member_id: "m1", due_date: old, amount: "50" },
      { id: "t2", member_id: "m1", due_date: older, amount: "25" },
      { id: "t3", member_id: "m2", due_date: old, amount: "10" },
    ]);
    const result = await arrears.detectOverduePayments({ organizationId: "org-1" });
    expect(result).toHaveLength(2);
    const m1 = result.find((r) => r.memberId === "m1")!;
    expect(m1.totalOwing).toBe(75);
    expect(m1.transactionCount).toBe(2);
    expect(m1.transactionIds).toEqual(["t1", "t2"]);
    // escalation is fixed from the first transaction's daysOverdue (~100 -> suspended);
    // the older transaction updates oldestDebtDate/daysOverdue but not the escalation label.
    expect(m1.suggestedEscalation).toBe("suspended");
    expect(m1.daysOverdue).toBeGreaterThanOrEqual(190);
  });

  it("escalates to legal_action past the level4 threshold", async () => {
    const veryOld = new Date(Date.now() - 200 * 86400000).toISOString();
    enqueue([{ id: "t1", member_id: "m1", due_date: veryOld, amount: "10" }]);
    const result = await arrears.detectOverduePayments({ organizationId: "org-1" });
    expect(result[0].suggestedEscalation).toBe("legal_action");
  });

  it("uses custom escalation thresholds", async () => {
    const old = new Date(Date.now() - 100 * 86400000).toISOString();
    enqueue([{ id: "t1", member_id: "m1", due_date: old, amount: "10" }]);
    const result = await arrears.detectOverduePayments({
      organizationId: "org-1",
      escalationThresholds: { level2Days: 50 },
    });
    // 100 days, custom level2=50, level3 default 90 -> 'suspended'
    expect(result[0].suggestedEscalation).toBe("suspended");
  });

  it("returns an empty array when no overdue transactions", async () => {
    enqueue([]);
    const result = await arrears.detectOverduePayments({ organizationId: "org-1", gracePeriodDays: 15 });
    expect(result).toEqual([]);
  });
});

describe("calculateLateFees", () => {
  it("computes percentage + fixed late fee", async () => {
    enqueue([{ amount: "200" }]);
    const fee = await arrears.calculateLateFees("t1", {
      organizationId: "org-1",
      lateFeePercentage: 5,
      lateFeeFixedAmount: 10,
    });
    // 200*5/100 = 10, + 10 fixed = 20
    expect(fee).toBe(20);
  });

  it("returns 0 when transaction not found", async () => {
    enqueue([]);
    const fee = await arrears.calculateLateFees("ghost", { organizationId: "org-1", lateFeePercentage: 5 });
    expect(fee).toBe(0);
  });
});

describe("createArrearsCases", () => {
  const detected = [
    {
      memberId: "member-1234567890",
      transactionIds: ["t1"],
      totalOwing: 100,
      oldestDebtDate: new Date("2024-10-01T00:00:00.000Z"),
      daysOverdue: 95,
      transactionCount: 1,
      suggestedEscalation: "suspended",
    },
  ];

  it("updates an existing open case", async () => {
    enqueue([{ id: "case-1" }], undefined); // existing case found, then update
    const ids = await arrears.createArrearsCases(detected, "org-1", "admin");
    expect(ids).toEqual(["case-1"]);
  });

  it("creates a new case when none exists", async () => {
    enqueue([], [{ id: "case-new" }]); // no existing, then insert returning
    const ids = await arrears.createArrearsCases(detected, "org-1", "admin");
    expect(ids).toEqual(["case-new"]);
  });
});

describe("applyLateFees", () => {
  it("applies fees and updates transactions", async () => {
    // calculateLateFees execute -> amount, then select totalAmount, then update
    enqueue([{ amount: "200" }], [{ totalAmount: "200" }], undefined);
    const total = await arrears.applyLateFees(["t1"], {
      organizationId: "org-1",
      lateFeePercentage: 5,
      lateFeeFixedAmount: 10,
    });
    expect(total).toBe(20);
  });

  it("skips transactions with zero late fee", async () => {
    enqueue([{ amount: "200" }]); // fee = 0 (no config) -> no select/update
    const total = await arrears.applyLateFees(["t1"], { organizationId: "org-1" });
    expect(total).toBe(0);
  });
});

describe("runArrearsDetection", () => {
  it("returns zeros when nothing is overdue", async () => {
    enqueue([]); // detectOverduePayments -> empty
    const result = await arrears.runArrearsDetection({ organizationId: "org-1" }, "admin");
    expect(result).toEqual({ detectedCount: 0, casesCreated: [], totalOwing: 0, feesApplied: 0 });
  });

  it("runs the full workflow with fees and case creation", async () => {
    const old = new Date(Date.now() - 100 * 86400000).toISOString();
    enqueue(
      [{ id: "t1", member_id: "m1", due_date: old, amount: "100" }], // detect
      [{ amount: "100" }], // calculateLateFees execute
      [{ totalAmount: "100" }], // applyLateFees select
      undefined, // applyLateFees update
      [], // createArrearsCases: no existing
      [{ id: "case-1" }], // insert returning
    );
    const result = await arrears.runArrearsDetection(
      { organizationId: "org-1", lateFeePercentage: 5, lateFeeFixedAmount: 10 },
      "admin",
    );
    expect(result.detectedCount).toBe(1);
    expect(result.totalOwing).toBe(100);
    expect(result.feesApplied).toBe(15);
    expect(result.casesCreated).toEqual(["case-1"]);
  });
});
