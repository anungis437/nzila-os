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
      "onConflictDoUpdate",
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
  const detection = { runArrearsDetection: vi.fn(), detectOverduePayments: vi.fn() };
  return { queue, db, schema, detection };
});

vi.mock("../../db", () => ({ db: h.db, schema: h.schema }));
vi.mock("../../services/arrears-detection", () => ({
  runArrearsDetection: h.detection.runArrearsDetection,
  detectOverduePayments: h.detection.detectOverduePayments,
}));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import arrearsRouter from "../../routes/arrears";

const ADMIN = { organizationId: "org-1", userId: "u1", role: "admin" };
const UUID = "11111111-1111-1111-1111-111111111111";

function enqueue(...results: any[]) {
  h.queue.push(...results);
}

beforeEach(() => {
  h.queue.length = 0;
  h.db.select.mockClear();
  h.db.insert.mockClear();
  h.db.update.mockClear();
  h.detection.runArrearsDetection.mockReset();
  h.detection.detectOverduePayments.mockReset();
});

describe("arrears routes", () => {
  it("runs detection and creates cases", async () => {
    h.detection.runArrearsDetection.mockResolvedValue({ detectedCount: 2, casesCreated: ["c1"], totalOwing: 100, feesApplied: 0 });
    const r = await invokeRoute(arrearsRouter, "post", "/detect", { user: ADMIN, body: { createCases: true } });
    expect(r.statusCode).toBe(200);
    expect(h.detection.runArrearsDetection).toHaveBeenCalled();
  });

  it("runs detection without creating cases", async () => {
    h.detection.detectOverduePayments.mockResolvedValue([{ totalOwing: 50 }, { totalOwing: 25 }]);
    const r = await invokeRoute(arrearsRouter, "post", "/detect", { user: ADMIN, body: { createCases: false } });
    expect(r.statusCode).toBe(200);
    expect((r.body as any).data.detectedCount).toBe(2);
  });

  it("denies detection for non-admins", async () => {
    const r = await invokeRoute(arrearsRouter, "post", "/detect", {
      user: { organizationId: "org-1", userId: "u1", role: "member" },
      body: {},
    });
    expect(r.statusCode).toBe(403);
  });

  it("returns 500 on detection failure", async () => {
    h.detection.runArrearsDetection.mockRejectedValue(new Error("boom"));
    const r = await invokeRoute(arrearsRouter, "post", "/detect", { user: ADMIN, body: { createCases: true } });
    expect(r.statusCode).toBe(500);
  });

  it("lists arrears cases with filters", async () => {
    enqueue([{ id: "c1" }]);
    const r = await invokeRoute(arrearsRouter, "get", "/", { user: ADMIN, query: { memberId: UUID, status: "active" } });
    expect(r.statusCode).toBe(200);
  });

  it("returns 500 when listing throws", async () => {
    enqueue(new Error("db"));
    const r = await invokeRoute(arrearsRouter, "get", "/", { user: ADMIN, query: {} });
    expect(r.statusCode).toBe(500);
  });

  it("fetches a case with transactions", async () => {
    enqueue([{ id: "c1", transactionIds: [UUID] }], [{ id: "t1" }]);
    const r = await invokeRoute(arrearsRouter, "get", "/:id", { user: ADMIN, params: { id: "c1" } });
    expect(r.statusCode).toBe(200);
    expect((r.body as any).data.transactions).toHaveLength(1);
  });

  it("fetches a case with no transactions", async () => {
    enqueue([{ id: "c1", transactionIds: [] }]);
    const r = await invokeRoute(arrearsRouter, "get", "/:id", { user: ADMIN, params: { id: "c1" } });
    expect(r.statusCode).toBe(200);
  });

  it("returns 404 for a missing case", async () => {
    enqueue([]);
    const r = await invokeRoute(arrearsRouter, "get", "/:id", { user: ADMIN, params: { id: "nope" } });
    expect(r.statusCode).toBe(404);
  });

  it("creates an arrears case", async () => {
    enqueue([], [{ id: "c1" }]); // no existing, insert
    const r = await invokeRoute(arrearsRouter, "post", "/", {
      user: ADMIN,
      body: { memberId: UUID, transactionIds: [UUID], totalAmount: 100, daysOverdue: 45 },
    });
    expect(r.statusCode).toBe(201);
  });

  it("returns 409 when an active case exists", async () => {
    enqueue([{ id: "existing" }]);
    const r = await invokeRoute(arrearsRouter, "post", "/", {
      user: ADMIN,
      body: { memberId: UUID, transactionIds: [UUID], totalAmount: 100, daysOverdue: 45 },
    });
    expect(r.statusCode).toBe(409);
  });

  it("denies case creation for non-admins", async () => {
    const r = await invokeRoute(arrearsRouter, "post", "/", {
      user: { organizationId: "org-1", userId: "u1", role: "member" },
      body: {},
    });
    expect(r.statusCode).toBe(403);
  });

  it("returns 400 on case creation validation error", async () => {
    const r = await invokeRoute(arrearsRouter, "post", "/", { user: ADMIN, body: { memberId: "x" } });
    expect(r.statusCode).toBe(400);
  });

  it("creates a payment plan", async () => {
    enqueue([{ id: "c1" }], [{ id: "c1", status: "payment_plan" }]);
    const r = await invokeRoute(arrearsRouter, "post", "/:id/payment-plan", {
      user: ADMIN,
      params: { id: "c1" },
      body: { installmentAmount: 50, numberOfInstallments: 3, startDate: "2025-01-01", frequency: "monthly" },
    });
    expect(r.statusCode).toBe(200);
    expect((r.body as any).data.paymentSchedule).toHaveLength(3);
  });

  it("handles weekly and biweekly payment plan frequencies", async () => {
    enqueue([{ id: "c1" }], [{ id: "c1" }]);
    const weekly = await invokeRoute(arrearsRouter, "post", "/:id/payment-plan", {
      user: ADMIN,
      params: { id: "c1" },
      body: { installmentAmount: 50, numberOfInstallments: 2, startDate: "2025-01-01", frequency: "weekly" },
    });
    expect(weekly.statusCode).toBe(200);
    enqueue([{ id: "c1" }], [{ id: "c1" }]);
    const biweekly = await invokeRoute(arrearsRouter, "post", "/:id/payment-plan", {
      user: ADMIN,
      params: { id: "c1" },
      body: { installmentAmount: 50, numberOfInstallments: 2, startDate: "2025-01-01", frequency: "biweekly" },
    });
    expect(biweekly.statusCode).toBe(200);
  });

  it("returns 404 when payment plan case is missing", async () => {
    enqueue([]);
    const r = await invokeRoute(arrearsRouter, "post", "/:id/payment-plan", {
      user: ADMIN,
      params: { id: "nope" },
      body: { installmentAmount: 50, numberOfInstallments: 3, startDate: "2025-01-01", frequency: "monthly" },
    });
    expect(r.statusCode).toBe(404);
  });

  it("denies payment plan for non-admins", async () => {
    const r = await invokeRoute(arrearsRouter, "post", "/:id/payment-plan", {
      user: { organizationId: "org-1", userId: "u1", role: "member" },
      params: { id: "c1" },
      body: {},
    });
    expect(r.statusCode).toBe(403);
  });

  it("updates case status", async () => {
    enqueue([{ id: "c1", status: "suspended" }]);
    const r = await invokeRoute(arrearsRouter, "put", "/:id/status", {
      user: ADMIN,
      params: { id: "c1" },
      body: { status: "suspended" },
    });
    expect(r.statusCode).toBe(200);
  });

  it("returns 404 when status update case is missing", async () => {
    enqueue([]);
    const r = await invokeRoute(arrearsRouter, "put", "/:id/status", {
      user: ADMIN,
      params: { id: "nope" },
      body: { status: "resolved" },
    });
    expect(r.statusCode).toBe(404);
  });

  it("denies status update for non-admins", async () => {
    const r = await invokeRoute(arrearsRouter, "put", "/:id/status", {
      user: { organizationId: "org-1", userId: "u1", role: "member" },
      params: { id: "c1" },
      body: {},
    });
    expect(r.statusCode).toBe(403);
  });

  it("logs a contact attempt", async () => {
    enqueue([{ id: "c1", contactHistory: [] }], [{ id: "c1" }]);
    const r = await invokeRoute(arrearsRouter, "post", "/:id/contact", {
      user: ADMIN,
      params: { id: "c1" },
      body: { contactType: "phone", notes: "called member" },
    });
    expect(r.statusCode).toBe(200);
  });

  it("returns 404 when contact case is missing", async () => {
    enqueue([]);
    const r = await invokeRoute(arrearsRouter, "post", "/:id/contact", {
      user: ADMIN,
      params: { id: "nope" },
      body: { contactType: "phone", notes: "called member" },
    });
    expect(r.statusCode).toBe(404);
  });

  it("records a partial payment", async () => {
    enqueue([{ id: "c1", remainingBalance: "100" }], [{ id: "c1", remainingBalance: "50" }]);
    const r = await invokeRoute(arrearsRouter, "post", "/:id/payment", {
      user: ADMIN,
      params: { id: "c1" },
      body: { amount: 50 },
    });
    expect(r.statusCode).toBe(200);
    expect((r.body as any).data.payment.newBalance).toBe(50);
  });

  it("resolves a case on full payment", async () => {
    enqueue([{ id: "c1", remainingBalance: "50" }], [{ id: "c1", status: "resolved" }]);
    const r = await invokeRoute(arrearsRouter, "post", "/:id/payment", {
      user: ADMIN,
      params: { id: "c1" },
      body: { amount: 50 },
    });
    expect(r.statusCode).toBe(200);
    expect((r.body as any).data.payment.newBalance).toBe(0);
  });

  it("returns 404 when payment case is missing", async () => {
    enqueue([]);
    const r = await invokeRoute(arrearsRouter, "post", "/:id/payment", {
      user: ADMIN,
      params: { id: "nope" },
      body: { amount: 50 },
    });
    expect(r.statusCode).toBe(404);
  });

  it("returns 400 on payment validation error", async () => {
    const r = await invokeRoute(arrearsRouter, "post", "/:id/payment", {
      user: ADMIN,
      params: { id: "c1" },
      body: { amount: -5 },
    });
    expect(r.statusCode).toBe(400);
  });
});
