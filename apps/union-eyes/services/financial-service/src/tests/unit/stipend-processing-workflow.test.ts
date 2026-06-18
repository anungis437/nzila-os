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
  const stripe = { paymentIntents: { create: vi.fn() } };
  return { queue, cronFns, db, schema, queueNotification, stripe };
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
vi.mock("@nzila/payments-stripe", () => ({ getStripeClient: vi.fn(() => h.stripe) }));
vi.mock("../../db", () => ({ db: h.db }));
vi.mock("../../db/schema", () => h.schema);
vi.mock("../../services/notification-service", () => ({ queueNotification: h.queueNotification }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import {
  processWeeklyStipends,
  processDisbursements,
  startStipendProcessingWorkflow,
  stopStipendProcessingWorkflow,
  getStipendProcessingWorkflowStatus,
} from "../../jobs/stipend-processing-workflow";

function enqueue(...results: any[]) {
  h.queue.push(...results);
}

const attendance = (memberId: string, hours: string) => ({
  memberId,
  checkInTime: new Date().toISOString(),
  hoursWorked: hours,
  coordinatorOverride: true,
  memberName: "Jane Doe",
  memberEmail: "jane@x.com",
  userId: "u1",
});

beforeEach(() => {
  h.queue.length = 0;
  h.db.select.mockClear();
  h.db.insert.mockClear();
  h.db.update.mockClear();
  h.queueNotification.mockClear();
  h.stripe.paymentIntents.create.mockReset();
});

describe("processWeeklyStipends", () => {
  it("calculates a stipend pending approval for qualifying attendance", async () => {
    enqueue(
      [{ currentBalance: "10000" }], // strike fund balance
      [attendance("m1", "8"), attendance("m1", "8")], // 2 qualifying days
      [], // no existing stipend
      [], // insert disbursement
    );
    const result = await processWeeklyStipends({ tenantId: "org-1" });
    expect(result.success).toBe(true);
    expect(result.stipendsCalculated).toBe(1);
    expect(result.pendingApproval).toBe(1);
    expect(result.membersProcessed).toBe(1);
  });

  it("auto-approves when approval is not required", async () => {
    enqueue(
      [{ currentBalance: "10000" }],
      [attendance("m1", "8")],
      [],
      [],
    );
    const result = await processWeeklyStipends({
      tenantId: "org-1",
      weekStartDate: new Date("2025-01-06"),
      rules: { requiresApproval: false },
    });
    expect(result.autoApproved).toBe(1);
  });

  it("skips days below the minimum hours", async () => {
    enqueue([{ currentBalance: "10000" }], [attendance("m1", "2")]);
    const result = await processWeeklyStipends({ tenantId: "org-1" });
    expect(result.stipendsCalculated).toBe(0);
  });

  it("skips members who already have a stipend for the week", async () => {
    enqueue([{ currentBalance: "10000" }], [attendance("m1", "8")], [{ id: "s1" }]);
    const result = await processWeeklyStipends({ tenantId: "org-1" });
    expect(result.stipendsCalculated).toBe(0);
  });

  it("tolerates a strike-fund balance lookup failure", async () => {
    enqueue(new Error("fund query failed"), []); // checkStrikeFundBalance catches -> 0, then no attendance
    const result = await processWeeklyStipends({ tenantId: "org-1" });
    expect(result.success).toBe(true);
    expect(result.stipendsCalculated).toBe(0);
  });

  it("throws when attendance lookup fails", async () => {
    enqueue([{ currentBalance: "10000" }], new Error("attendance failed"));
    await expect(processWeeklyStipends({ tenantId: "org-1" })).rejects.toThrow("attendance failed");
  });
});

describe("processDisbursements", () => {
  it("disburses an approved stipend in dev mode (no Stripe key)", async () => {
    const prev = process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_SECRET_KEY;
    enqueue([{ id: "s1", totalAmount: "200", memberId: "m1", tenantId: "org-1" }], []);
    try {
      const result = await processDisbursements({ tenantId: "org-1", stipendIds: ["s1"] });
      expect(result.disbursed).toBe(1);
      expect(result.totalAmount).toBe(200);
      expect(h.queueNotification).toHaveBeenCalled();
    } finally {
      if (prev !== undefined) process.env.STRIPE_SECRET_KEY = prev;
    }
  });

  it("disburses via Stripe when configured", async () => {
    const prev = process.env.STRIPE_SECRET_KEY;
    process.env.STRIPE_SECRET_KEY = "sk_test";
    h.stripe.paymentIntents.create.mockResolvedValue({ id: "pi_1" });
    enqueue([{ id: "s1", totalAmount: "200", memberId: "m1", tenantId: "org-1" }], []);
    try {
      const result = await processDisbursements({ tenantId: "org-1" });
      expect(result.disbursed).toBe(1);
      expect(h.stripe.paymentIntents.create).toHaveBeenCalled();
    } finally {
      if (prev === undefined) delete process.env.STRIPE_SECRET_KEY;
      else process.env.STRIPE_SECRET_KEY = prev;
    }
  });

  it("marks a stipend failed when the disbursement update throws", async () => {
    const prev = process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_SECRET_KEY;
    enqueue(
      [{ id: "s1", totalAmount: "200", memberId: "m1", tenantId: "org-1" }],
      new Error("update failed"), // disbursed update throws
      [], // failed update
    );
    try {
      const result = await processDisbursements({ tenantId: "org-1" });
      expect(result.failed).toBe(1);
      expect(result.errors[0].error).toBe("update failed");
    } finally {
      if (prev !== undefined) process.env.STRIPE_SECRET_KEY = prev;
    }
  });

  it("throws when the approved-stipends query fails", async () => {
    enqueue(new Error("db down"));
    await expect(processDisbursements({ tenantId: "org-1" })).rejects.toThrow("db down");
  });
});

describe("workflow lifecycle", () => {
  it("start/stop/getStatus operate without throwing", () => {
    expect(() => startStipendProcessingWorkflow()).not.toThrow();
    expect(() => stopStipendProcessingWorkflow()).not.toThrow();
    const status = getStipendProcessingWorkflowStatus();
    expect(status.running).toBe(true);
  });

  it("runs the scheduled cron callback", async () => {
    await Promise.all(h.cronFns.map((fn) => fn()));
    expect(h.cronFns.length).toBeGreaterThan(0);
  });
});
