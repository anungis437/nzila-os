import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => {
  const queue: any[] = [];
  const cronFns: Array<() => unknown> = [];
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
  };
  const schema: any = new Proxy(
    {},
    {
      get: (_t, table: string) => (table === "__esModule" ? true : { __name: table }),
      has: () => true,
    },
  );
  const queueNotification = vi.fn(async () => "n1");
  return { queue, cronFns, db, schema, queueNotification };
});

vi.mock("node-cron", () => ({
  default: {
    schedule: vi.fn((..._args: any[]) => {
      const fn = _args.find((a) => typeof a === "function");
      if (fn) h.cronFns.push(fn);
      return { start: vi.fn(), stop: vi.fn() };
    }),
  },
}));
vi.mock("../../db", () => ({ db: h.db }));
vi.mock("../../db/schema", () => h.schema);
vi.mock("../../services/notification-service", () => ({ queueNotification: h.queueNotification }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
// Gate 13 governance tracking is exercised by dedicated job-cancellation-service tests;
// stub it here so it doesn't consume the shared business-logic mock db queue above.
vi.mock("../../services/job-cancellation-service", () => {
  class JobCancellationService {
    async startJobExecution() { return { id: "test-exec-state-id" }; }
    async requestCancellation() { /* no-op */ }
    async isJobCancelled() { return false; }
    async completeJob() { /* no-op */ }
    async failJob() { /* no-op */ }
    async cancelJob() { /* no-op */ }
    async recordAuditEvent() { /* no-op */ }
    async getExecutionState() { return null; }
  }
  return { JobCancellationService, jobCancellationService: new JobCancellationService() };
});

import {
  processPaymentCollection,
  startPaymentCollectionWorkflow,
  stopPaymentCollectionWorkflow,
  getPaymentCollectionWorkflowStatus,
} from "../../jobs/payment-collection-workflow";

function enqueue(...results: any[]) {
  h.queue.push(...results);
}

const payment = (overrides: Record<string, unknown> = {}) => ({
  id: "p1",
  memberId: "m1",
  amount: "100",
  currency: "usd",
  status: "pending",
  paymentMethod: "card",
  processorPaymentId: " proc1",
  memberFirstName: "Jane",
  memberLastName: "Doe",
  memberEmail: "jane@x.com",
  memberUserId: "u1",
  createdAt: "2025-01-01T00:00:00.000Z",
  ...overrides,
});

beforeEach(() => {
  h.queue.length = 0;
  h.db.select.mockClear();
  h.db.insert.mockClear();
  h.db.update.mockClear();
  h.queueNotification.mockClear();
});

describe("processPaymentCollection", () => {
  it("matches a payment to a pending transaction and issues a receipt", async () => {
    enqueue(
      [payment()], // pending payments
      [{ id: "t1", amount: "100", status: "pending" }], // matching transactions
      [], // update dues transaction
      [], // update payment
      [{ organizationId: "org-1" }], // member lookup
    );
    const result = await processPaymentCollection({ tenantId: "org-1" });
    expect(result.success).toBe(true);
    expect(result.paymentsProcessed).toBe(1);
    expect(result.transactionsUpdated).toBe(1);
    expect(result.receiptsIssued).toBe(1);
    expect(h.queueNotification).toHaveBeenCalled();
  });

  it("resolves arrears when paying an overdue transaction", async () => {
    enqueue(
      [payment()],
      [{ id: "t1", amount: "100", status: "overdue" }], // overdue
      [], // update dues transaction
      [{ id: "ar1" }], // arrears record found
      [], // update arrears
      [], // update payment
      [{ organizationId: "org-1" }], // member lookup
    );
    const result = await processPaymentCollection({ tenantId: "org-1" });
    expect(result.arrearsUpdated).toBe(1);
  });

  it("flags a payment with no memberId", async () => {
    enqueue([payment({ memberId: null })]);
    const result = await processPaymentCollection({ tenantId: "org-1" });
    expect(result.errors[0].error).toContain("no memberId");
  });

  it("marks a payment failed when no outstanding transactions exist", async () => {
    enqueue([payment()], []); // no matching transactions
    const result = await processPaymentCollection({ tenantId: "org-1" });
    expect(result.errors[0].error).toContain("No outstanding");
    expect(result.success).toBe(false);
  });

  it("captures an error when transaction matching throws", async () => {
    enqueue([payment()], new Error("match failed"));
    const result = await processPaymentCollection({ tenantId: "org-1" });
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error).toBe("match failed");
  });

  it("returns a graceful failure result when the top-level query fails", async () => {
    // Regression test for #713: a variable-scoping bug previously caused this
    // path to throw a ReferenceError instead of returning {success:false,...},
    // matching the contract used by arrears/dues/analytics workflows.
    enqueue(new Error("db down"));
    const result = await processPaymentCollection({ tenantId: "org-1" });
    expect(result.success).toBe(false);
    expect(result.errors).toEqual([]);
  });

  it("logs but tolerates a failed 'unmatched' status update", async () => {
    enqueue([payment()], [], new Error("update unmatched failed"));
    const result = await processPaymentCollection({ tenantId: "org-1" });
    expect(result.errors[0].error).toContain("No outstanding");
  });

  it("logs but tolerates a failed payment status update on the happy path", async () => {
    enqueue(
      [payment()],
      [{ id: "t1", amount: "100", status: "pending" }],
      [], // update dues transaction
      new Error("update payment failed"), // update payment .catch
      [{ organizationId: "org-1" }], // member lookup
    );
    const result = await processPaymentCollection({ tenantId: "org-1" });
    expect(result.paymentsProcessed).toBe(1);
  });

  it("logs but tolerates a failed 'mark failed' update after a payment error", async () => {
    enqueue(
      [payment()],
      new Error("match failed"), // matching transactions throws -> outer catch
      new Error("mark failed update failed"), // failed-status update .catch
    );
    const result = await processPaymentCollection({ tenantId: "org-1" });
    expect(result.errors[0].error).toBe("match failed");
  });
});

describe("workflow lifecycle", () => {
  it("start/stop/getStatus operate without throwing", () => {
    expect(() => startPaymentCollectionWorkflow()).not.toThrow();
    expect(() => stopPaymentCollectionWorkflow()).not.toThrow();
    const status = getPaymentCollectionWorkflowStatus();
    expect(status.running).toBe(true);
  });

  it("runs the scheduled cron callback", async () => {
    await Promise.all(h.cronFns.map((fn) => fn()));
    expect(h.cronFns.length).toBeGreaterThan(0);
  });
});
