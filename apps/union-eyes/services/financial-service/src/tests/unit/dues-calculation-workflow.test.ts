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
  return { queue, cronFns, db, schema };
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
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import {
  processMonthlyDuesCalculation,
  startDuesCalculationWorkflow,
  stopDuesCalculationWorkflow,
  getDuesCalculationWorkflowStatus,
} from "../../jobs/dues-calculation-workflow";

function enqueue(...results: any[]) {
  h.queue.push(...results);
}

beforeEach(() => {
  h.queue.length = 0;
  h.db.select.mockClear();
  h.db.insert.mockClear();
  h.db.update.mockClear();
});

describe("processMonthlyDuesCalculation", () => {
  it("creates a transaction for an active member", async () => {
    enqueue(
      [{ memberId: "m1", ruleId: "r1", assignmentId: "a1" }], // active members
      [{ flatAmount: "50" }], // dues rule
      [], // no existing transaction
      [], // insert
    );
    const result = await processMonthlyDuesCalculation({ tenantId: "org-1" });
    expect(result.success).toBe(true);
    expect(result.membersProcessed).toBe(1);
    expect(result.transactionsCreated).toBe(1);
  });

  it("records an error when the dues rule is missing", async () => {
    enqueue([{ memberId: "m1", ruleId: "rX", assignmentId: "a1" }], []);
    const result = await processMonthlyDuesCalculation({ tenantId: "org-1" });
    expect(result.transactionsCreated).toBe(0);
    expect(result.errors[0].error).toContain("not found");
  });

  it("skips members who already have a transaction for the period", async () => {
    enqueue(
      [{ memberId: "m1", ruleId: "r1", assignmentId: "a1" }],
      [{ flatAmount: "50" }],
      [{ id: "existing" }], // existing transaction
    );
    const result = await processMonthlyDuesCalculation({ tenantId: "org-1" });
    expect(result.membersProcessed).toBe(1);
    expect(result.transactionsCreated).toBe(0);
  });

  it("captures member-level errors when the insert fails", async () => {
    enqueue(
      [{ memberId: "m1", ruleId: "r1", assignmentId: "a1" }],
      [{ flatAmount: "50" }],
      [],
      new Error("insert failed"),
    );
    const result = await processMonthlyDuesCalculation({ tenantId: "org-1" });
    expect(result.transactionsCreated).toBe(0);
    expect(result.errors).toHaveLength(1);
  });

  it("returns a failure result when the top-level query throws", async () => {
    enqueue(new Error("db down"));
    const result = await processMonthlyDuesCalculation({ tenantId: "org-1" });
    expect(result.success).toBe(false);
    expect(result.errors[0].memberId).toBe("system");
  });
});

describe("workflow lifecycle", () => {
  it("start/stop/getStatus operate without throwing", () => {
    expect(() => startDuesCalculationWorkflow()).not.toThrow();
    expect(() => stopDuesCalculationWorkflow()).not.toThrow();
    const status = getDuesCalculationWorkflowStatus();
    expect(status.name).toBe("Monthly Dues Calculation");
    expect(status.running).toBe(true);
  });

  it("runs the scheduled cron callback", async () => {
    await Promise.all(h.cronFns.map((fn) => fn()));
    expect(h.cronFns.length).toBeGreaterThan(0);
  });
});
