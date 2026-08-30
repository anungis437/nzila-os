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
    schedule: vi.fn((_expr: string, fn: () => unknown) => {
      h.cronFns.push(fn);
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
  processArrearsManagement,
  startArrearsManagementWorkflow,
  stopArrearsManagementWorkflow,
  getArrearsManagementWorkflowStatus,
} from "../../jobs/arrears-management-workflow";

function enqueue(...results: any[]) {
  h.queue.push(...results);
}

const overdue = (overrides: Record<string, unknown> = {}) => ({
  transactionId: "t1",
  memberId: "m1",
  amount: "100",
  dueDate: "2020-01-01",
  periodStart: "2019-12-01",
  periodEnd: "2019-12-31",
  memberName: "Jane Doe",
  memberEmail: "jane@x.com",
  ...overrides,
});

beforeEach(() => {
  h.queue.length = 0;
  h.db.select.mockClear();
  h.db.insert.mockClear();
  h.db.update.mockClear();
  h.queueNotification.mockClear();
});

describe("processArrearsManagement", () => {
  it("creates a new arrears record and notifies the member", async () => {
    enqueue([overdue()], []); // overdue records, then no existing arrears
    const result = await processArrearsManagement({ tenantId: "org-1" });
    expect(result.success).toBe(true);
    expect(result.overdueTransactions).toBe(1);
    expect(result.arrearsCreated).toBe(1);
    expect(result.notificationsSent).toBe(1);
    expect(h.queueNotification).toHaveBeenCalled();
  });

  it("updates an existing arrears record", async () => {
    enqueue([overdue()], [{ id: "ar1", totalOwed: "50" }]);
    const result = await processArrearsManagement({ tenantId: "org-1" });
    expect(result.arrearsCreated).toBe(0);
    expect(result.notificationsSent).toBe(1);
  });

  it("uses the reminder stage for recently overdue transactions", async () => {
    const recent = new Date();
    recent.setDate(recent.getDate() - 5);
    enqueue([overdue({ dueDate: recent.toISOString().split("T")[0] })], []);
    const result = await processArrearsManagement({ tenantId: "org-1" });
    expect(result.notificationsSent).toBe(1);
  });

  it("captures a per-record error", async () => {
    enqueue([overdue()], [], new Error("insert arrears failed"));
    const result = await processArrearsManagement({ tenantId: "org-1" });
    expect(result.arrearsCreated).toBe(0);
    expect(result.errors).toHaveLength(1);
  });

  it("returns a failure result when the top-level query throws", async () => {
    enqueue(new Error("db down"));
    const result = await processArrearsManagement({ tenantId: "org-1" });
    expect(result.success).toBe(false);
    expect(result.errors[0].transactionId).toBe("system");
  });
});

describe("workflow lifecycle", () => {
  it("start/stop/getStatus operate without throwing", () => {
    expect(() => startArrearsManagementWorkflow()).not.toThrow();
    expect(() => stopArrearsManagementWorkflow()).not.toThrow();
    const status = getArrearsManagementWorkflowStatus();
    expect(status.name).toContain("Arrears");
  });

  it("runs the scheduled cron callback", async () => {
    await Promise.all(h.cronFns.map((fn) => fn()));
    expect(h.cronFns.length).toBeGreaterThan(0);
  });
});
