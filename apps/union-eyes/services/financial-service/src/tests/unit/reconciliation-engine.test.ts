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
    for (const m of ["select", "from", "where", "limit", "groupBy", "orderBy"]) {
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
  return { queue, db, schema };
});

vi.mock("../../db", () => ({ db: h.db }));
vi.mock("../../db/schema", () => h.schema);
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { runReconciliation } from "../../services/reconciliation-engine";

function enqueue(...results: any[]) {
  h.queue.push(...results);
}

beforeEach(() => {
  h.queue.length = 0;
});

describe("runReconciliation", () => {
  it("detects every mismatch type and aggregates the summary", async () => {
    enqueue(
      // 1. unprocessed webhook events
      [
        { id: "w1", stripeEventId: "evt_1", eventType: "x", createdAt: "2025-01-01", processingError: "boom" },
        { id: "w2", stripeEventId: "evt_2", eventType: "y", createdAt: "2025-01-02", processingError: null },
      ],
      // 2. paid transactions
      [
        { id: "t1", status: "paid", paymentReference: "pi_1", totalAmount: "100", paidDate: "2025-01-03" },
        { id: "t2", status: "paid", paymentReference: null, totalAmount: "50", paidDate: "2025-01-03" },
      ],
      // 3. webhook match lookup for t1 -> none
      [],
      // 4. failed events
      [
        { stripeEventId: "evt_f1", stripePaymentIntentId: "pi_x", eventType: "payment_intent.payment_failed" },
        { stripeEventId: "evt_f2", stripePaymentIntentId: null, eventType: "payment_intent.payment_failed" },
      ],
      // 5. inconsistent txn for pi_x -> found
      [{ id: "t9", status: "paid" }],
      // 6-8. aggregate counts
      [{ count: 10 }],
      [{ count: 8 }],
      [{ count: 5 }],
    );

    const report = await runReconciliation("2025-01-01", "2025-01-31");

    expect(report.runId).toBeTruthy();
    expect(report.totalWebhookEvents).toBe(10);
    expect(report.totalProcessed).toBe(8);
    expect(report.totalUnprocessed).toBe(2);
    expect(report.totalDuesTransactions).toBe(5);

    const types = report.mismatches.map((m) => m.type);
    expect(types).toContain("webhook_unprocessed");
    expect(types).toContain("payment_without_webhook");
    expect(types).toContain("status_inconsistency");

    expect(report.summary).toEqual({ critical: 1, high: 2, medium: 1, low: 0 });
  });

  it("returns a clean report with no mismatches", async () => {
    enqueue(
      [], // no unprocessed
      [], // no paid transactions
      [], // no failed events
      [{ count: 0 }],
      [{ count: 0 }],
      [{ count: 0 }],
    );
    const report = await runReconciliation("2025-02-01", "2025-02-28");
    expect(report.mismatches).toEqual([]);
    expect(report.summary).toEqual({ critical: 0, high: 0, medium: 0, low: 0 });
    expect(report.totalUnprocessed).toBe(0);
  });

  it("does not flag paid transactions that have a matching webhook", async () => {
    enqueue(
      [], // no unprocessed
      [{ id: "t1", status: "paid", paymentReference: "pi_1", totalAmount: "100", paidDate: "2025-01-03" }],
      [{ id: "w-match" }], // webhook match found -> no mismatch
      [], // no failed events
      [{ count: 1 }],
      [{ count: 1 }],
      [{ count: 1 }],
    );
    const report = await runReconciliation("2025-01-01", "2025-01-31");
    expect(report.mismatches).toEqual([]);
  });
});
