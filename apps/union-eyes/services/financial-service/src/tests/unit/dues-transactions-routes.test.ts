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
      "set",
      "values",
      "returning",
      "innerJoin",
      "leftJoin",
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
  const db: any = {
    select: vi.fn(() => makeChain()),
    insert: vi.fn(() => makeChain()),
    update: vi.fn(() => makeChain()),
    delete: vi.fn(() => makeChain()),
  };
  const schema: any = new Proxy(
    {},
    {
      get: (_t, table: string) => {
        if (table === "__esModule") return true;
        return new Proxy(
          { __name: table },
          { get: (o: any, col: string) => (col in o ? o[col] : { __col: col }) },
        );
      },
      has: () => true,
    },
  );
  const engine = { calculateMemberDues: vi.fn(), batchCalculateDuesSimple: vi.fn() };
  return { queue, db, schema, engine };
});

vi.mock("@union-claims/financial", () => ({
  DuesCalculationEngine: class {
    calculateMemberDues = h.engine.calculateMemberDues;
    batchCalculateDuesSimple = h.engine.batchCalculateDuesSimple;
  },
}));
vi.mock("../../db", () => ({ db: h.db, schema: h.schema }));

import txRouter from "../../routes/dues-transactions";

const ADMIN = { organizationId: "org-1", userId: "u1", role: "admin" };
const MEMBER = { organizationId: "org-1", userId: "u1", role: "member" };
const UUID = "11111111-1111-1111-1111-111111111111";
const RULE = {
  id: "r1",
  organizationId: "org-1",
  ruleName: "Standard",
  ruleCode: "STD",
  calculationType: "flat_rate",
  percentageRate: "2.5",
  baseField: "gross",
  flatAmount: "25",
  hourlyRate: "1",
  hoursPerPeriod: "40",
  tierStructure: null,
  customFormula: null,
  billingFrequency: "monthly",
  effectiveDate: "2025-01-01",
  endDate: "2025-12-31",
  isActive: true,
};

function enqueue(...results: any[]) {
  h.queue.push(...results);
}

beforeEach(() => {
  h.queue.length = 0;
  h.db.select.mockClear();
  h.db.insert.mockClear();
  h.engine.calculateMemberDues.mockReset();
  h.engine.batchCalculateDuesSimple.mockReset();
});

describe("dues-transactions routes", () => {
  it("calculates dues for a member", async () => {
    enqueue([{ member_dues_assignments: { id: "a1", memberId: UUID }, dues_rules: RULE }]);
    h.engine.calculateMemberDues.mockResolvedValue({ totalAmount: 25 });
    const r = await invokeRoute(txRouter, "post", "/calculate", {
      user: ADMIN,
      body: { memberId: UUID, billingPeriodStart: "2025-01-01", billingPeriodEnd: "2025-01-31" },
    });
    expect(r.statusCode).toBe(200);
    expect(h.engine.calculateMemberDues).toHaveBeenCalled();
  });

  it("returns 404 when no active assignment exists", async () => {
    enqueue([]);
    const r = await invokeRoute(txRouter, "post", "/calculate", {
      user: ADMIN,
      body: { memberId: UUID, billingPeriodStart: "2025-01-01", billingPeriodEnd: "2025-01-31" },
    });
    expect(r.statusCode).toBe(404);
  });

  it("returns 404 when assignment has no rule", async () => {
    enqueue([{ member_dues_assignments: { id: "a1", memberId: UUID }, dues_rules: null }]);
    const r = await invokeRoute(txRouter, "post", "/calculate", {
      user: ADMIN,
      body: { memberId: UUID, billingPeriodStart: "2025-01-01", billingPeriodEnd: "2025-01-31" },
    });
    expect(r.statusCode).toBe(404);
  });

  it("returns 400 on calculate validation error", async () => {
    const r = await invokeRoute(txRouter, "post", "/calculate", { user: ADMIN, body: { memberId: "x" } });
    expect(r.statusCode).toBe(400);
  });

  it("returns 500 when calculate engine throws", async () => {
    enqueue([{ member_dues_assignments: { id: "a1", memberId: UUID }, dues_rules: RULE }]);
    h.engine.calculateMemberDues.mockRejectedValue(new Error("calc failed"));
    const r = await invokeRoute(txRouter, "post", "/calculate", {
      user: ADMIN,
      body: { memberId: UUID, billingPeriodStart: "2025-01-01", billingPeriodEnd: "2025-01-31" },
    });
    expect(r.statusCode).toBe(500);
  });

  it("batch-calculates and creates transactions", async () => {
    enqueue(
      [
        { member_dues_assignments: { id: "a1", memberId: UUID }, dues_rules: RULE },
        { member_dues_assignments: { id: "a2", memberId: "no-rule" }, dues_rules: null },
      ],
      [{ id: "t1" }],
    );
    h.engine.batchCalculateDuesSimple.mockReturnValue({
      totalProcessed: 2,
      successful: 1,
      failed: 1,
      summary: { totalRevenue: 25 },
      results: [
        { memberId: UUID, totalAmount: 25 },
        { memberId: "other", totalAmount: 0, errors: ["bad"] },
      ],
    });
    const r = await invokeRoute(txRouter, "post", "/batch", {
      user: ADMIN,
      body: {
        billingPeriodStart: "2025-01-01",
        billingPeriodEnd: "2025-01-31",
        memberIds: [UUID],
        memberData: [{ memberId: UUID, grossWages: 1000, hoursWorked: 40 }],
      },
    });
    expect(r.statusCode).toBe(200);
    expect((r.body as any).data.transactionsCreated).toBe(1);
  });

  it("batch dry-run returns results without creating", async () => {
    enqueue([{ member_dues_assignments: { id: "a1", memberId: UUID }, dues_rules: RULE }]);
    h.engine.batchCalculateDuesSimple.mockReturnValue({
      totalProcessed: 1,
      successful: 1,
      failed: 0,
      summary: {},
      results: [{ memberId: UUID, totalAmount: 25 }],
    });
    const r = await invokeRoute(txRouter, "post", "/batch", {
      user: ADMIN,
      body: { billingPeriodStart: "2025-01-01", billingPeriodEnd: "2025-01-31", dryRun: true },
    });
    expect(r.statusCode).toBe(200);
    expect((r.body as any).data.dryRun).toBe(true);
  });

  it("batch returns empty summary when no assignments", async () => {
    enqueue([]);
    const r = await invokeRoute(txRouter, "post", "/batch", {
      user: ADMIN,
      body: { billingPeriodStart: "2025-01-01", billingPeriodEnd: "2025-01-31" },
    });
    expect(r.statusCode).toBe(200);
    expect((r.body as any).data.summary.totalProcessed).toBe(0);
  });

  it("denies batch for non-admins", async () => {
    const r = await invokeRoute(txRouter, "post", "/batch", { user: MEMBER, body: {} });
    expect(r.statusCode).toBe(403);
  });

  it("returns 400 on batch validation error", async () => {
    const r = await invokeRoute(txRouter, "post", "/batch", { user: ADMIN, body: { billingPeriodStart: "nope" } });
    expect(r.statusCode).toBe(400);
  });

  it("lists transactions with filters", async () => {
    enqueue([{ id: "t1" }]);
    const r = await invokeRoute(txRouter, "get", "/", {
      user: ADMIN,
      query: { memberId: UUID, status: "pending", startDate: "2025-01-01", endDate: "2025-01-31" },
    });
    expect(r.statusCode).toBe(200);
  });

  it("returns 500 when listing transactions throws", async () => {
    enqueue(new Error("db"));
    const r = await invokeRoute(txRouter, "get", "/", { user: ADMIN, query: {} });
    expect(r.statusCode).toBe(500);
  });

  it("fetches a transaction by id", async () => {
    enqueue([{ id: "t1" }]);
    const r = await invokeRoute(txRouter, "get", "/:id", { user: ADMIN, params: { id: "t1" } });
    expect(r.statusCode).toBe(200);
  });

  it("returns 404 for a missing transaction", async () => {
    enqueue([]);
    const r = await invokeRoute(txRouter, "get", "/:id", { user: ADMIN, params: { id: "x" } });
    expect(r.statusCode).toBe(404);
  });
});
