import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Gate 13 focused proof suite (issue #713 regression correction).
 *
 * Exercises JobCancellationService directly against a mocked db, proving:
 *  1. execution state can be created
 *  2. a running job can observe a cancellation request
 *  4. completion records final state correctly
 *  5. failure records structured failure details correctly
 *  6. organization boundaries are preserved (org id present in every WHERE)
 *  7. audit events are persisted for cancellation transitions
 *  9. repeated cancellation/finalization operations are idempotent
 * (3 and 8 are covered by the workflow-level tests; 10 is covered below via
 * the schema structural assertions.)
 */

const h = vi.hoisted(() => {
  const inserted: Array<{ table: string; values: any }> = [];
  const updated: Array<{ table: string; set: any; where: any }> = [];
  const selectResults: any[] = [];

  function makeInsertChain(table: string) {
    let values: any;
    const chain: any = {
      values: vi.fn((v: any) => {
        values = v;
        inserted.push({ table, values: v });
        return chain;
      }),
      onConflictDoNothing: vi.fn(() => chain),
      returning: vi.fn(() => chain),
      then: (resolve: (v: any) => void) =>
        Promise.resolve().then(() => resolve([{ id: `${table}-generated-id`, ...values }])),
    };
    return chain;
  }

  function makeUpdateChain(table: string) {
    let setValues: any;
    const chain: any = {
      set: vi.fn((v: any) => {
        setValues = v;
        return chain;
      }),
      where: vi.fn((cond: any) => {
        updated.push({ table, set: setValues, where: cond });
        return chain;
      }),
      then: (resolve: (v: any) => void) => Promise.resolve().then(() => resolve(undefined)),
    };
    return chain;
  }

  function makeSelectChain() {
    const chain: any = {
      from: vi.fn(() => chain),
      where: vi.fn((cond: any) => {
        chain.__where = cond;
        return chain;
      }),
      limit: vi.fn(() => chain),
      then: (resolve: (v: any) => void) =>
        Promise.resolve().then(() => resolve(selectResults.shift() ?? [])),
    };
    return chain;
  }

  const db: any = {
    insert: vi.fn((table: { __name: string }) => makeInsertChain(table.__name)),
    update: vi.fn((table: { __name: string }) => makeUpdateChain(table.__name)),
    select: vi.fn(() => makeSelectChain()),
  };

  const schema: any = new Proxy(
    {},
    {
      get: (_t, table: string) => (table === "__esModule" ? true : { __name: table }),
      has: () => true,
    },
  );

  return { inserted, updated, selectResults, db, schema };
});

vi.mock("../../db", () => ({ db: h.db }));
vi.mock("../../db/schema", () => h.schema);
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { JobCancellationService } from "../../services/job-cancellation-service";

function whereContains(cond: unknown, needle: string): boolean {
  return JSON.stringify(cond).includes(needle);
}

describe("JobCancellationService (Gate 13)", () => {
  beforeEach(() => {
    h.inserted.length = 0;
    h.updated.length = 0;
    h.selectResults.length = 0;
    vi.clearAllMocks();
  });

  it("1. creates an execution state record", async () => {
    const service = new JobCancellationService();
    const state = await service.startJobExecution({
      organizationId: "org-1",
      jobType: "payment-collection-workflow",
      jobRunId: "run-1",
    });

    expect(state.id).toBe("jobExecutionState-generated-id");
    const insertedState = h.inserted.find((i) => i.table === "jobExecutionState");
    expect(insertedState?.values.organizationId).toBe("org-1");
    expect(insertedState?.values.status).toBe("running");
    // audit event recorded for job_started
    const auditEvent = h.inserted.find((i) => i.table === "jobCancellationAuditEvent");
    expect(auditEvent?.values.eventType).toBe("job_started");
  });

  it("2. a running job can observe a cancellation request", async () => {
    h.selectResults.push([{ cancellationRequested: true }]);
    const service = new JobCancellationService();

    const cancelled = await service.isJobCancelled({
      executionStateId: "exec-1",
      organizationId: "org-1",
    });

    expect(cancelled).toBe(true);
  });

  it("4. completion records final state correctly", async () => {
    const service = new JobCancellationService();
    await service.completeJob({
      executionStateId: "exec-1",
      organizationId: "org-1",
      result: { paymentsProcessed: 3 },
    });

    const update = h.updated.find((u) => u.table === "jobExecutionState");
    expect(update?.set.status).toBe("completed");
    expect(update?.set.result).toEqual({ paymentsProcessed: 3 });
    expect(typeof update?.set.completedAt).toBe("string"); // ISO string, not a Date

    const auditEvent = h.inserted.find((i) => i.table === "jobCancellationAuditEvent");
    expect(auditEvent?.values.eventType).toBe("job_completed");
    expect(auditEvent?.values.isTerminal).toBe(true);
  });

  it("5. failure records structured failure details correctly (Error input)", async () => {
    const service = new JobCancellationService();
    await service.failJob({
      executionStateId: "exec-1",
      organizationId: "org-1",
      error: new Error("boom"),
    });

    const update = h.updated.find((u) => u.table === "jobExecutionState");
    expect(update?.set.status).toBe("failed");
    expect(update?.set.error).toMatchObject({ name: "Error", message: "boom" });
    expect(typeof update?.set.error.stack).toBe("string");

    const auditEvent = h.inserted.find((i) => i.table === "jobCancellationAuditEvent");
    expect(auditEvent?.values.eventType).toBe("job_failed");
    expect(auditEvent?.values.details).toMatchObject({ message: "boom" });
  });

  it("5b. failure records structured failure details correctly (plain object input)", async () => {
    const service = new JobCancellationService();
    await service.failJob({
      executionStateId: "exec-1",
      organizationId: "org-1",
      error: { message: "plain failure", stack: undefined },
    });

    const update = h.updated.find((u) => u.table === "jobExecutionState");
    expect(update?.set.error).toEqual({ message: "plain failure", stack: undefined });
  });

  it("6. organization boundaries are preserved on every state-transition query", async () => {
    const service = new JobCancellationService();

    await service.isJobCancelled({ executionStateId: "exec-1", organizationId: "org-scope-1" });
    await service.completeJob({ executionStateId: "exec-1", organizationId: "org-scope-1" });
    await service.failJob({ executionStateId: "exec-1", organizationId: "org-scope-1", error: new Error("x") });
    await service.cancelJob({ executionStateId: "exec-1", organizationId: "org-scope-1" });

    for (const u of h.updated) {
      expect(whereContains(u.where, "org-scope-1")).toBe(true);
    }
  });

  it("7. audit events are persisted for cancellation transitions", async () => {
    const service = new JobCancellationService();
    await service.cancelJob({ executionStateId: "exec-1", organizationId: "org-1", cancelledBy: "operator-1" });

    const update = h.updated.find((u) => u.table === "jobExecutionState");
    expect(update?.set.status).toBe("cancelled");
    expect(update?.set.cancelledBy).toBe("operator-1");

    const auditEvent = h.inserted.find((i) => i.table === "jobCancellationAuditEvent");
    expect(auditEvent?.values.eventType).toBe("job_cancelled");
    expect(auditEvent?.values.actor).toBe("operator-1");
    expect(auditEvent?.values.isTerminal).toBe(true);
  });

  it("9. repeated cancellation requests are idempotent (onConflictDoNothing path)", async () => {
    // First call: no existing execution state found -> request is a no-op.
    h.selectResults.push([]); // requestCancellation's initial lookup
    const service = new JobCancellationService();

    await service.requestCancellation({
      organizationId: "org-1",
      idempotencyKey: "idem-key-1",
      requestedBy: "operator-1",
    });

    // No execution state matched -> no insert/update should have occurred.
    expect(h.inserted.find((i) => i.table === "jobCancellationRequest")).toBeUndefined();

    // Second call: execution state exists, insert conflicts (duplicate), already marked requested.
    h.selectResults.push([{ id: "exec-1", cancellationRequested: true }]);
    const insertChain = {
      values: vi.fn().mockReturnThis(),
      onConflictDoNothing: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnThis(),
      then: (resolve: (v: any) => void) => Promise.resolve().then(() => resolve([undefined])),
    };
    h.db.insert.mockReturnValueOnce(insertChain);

    await service.requestCancellation({
      organizationId: "org-1",
      idempotencyKey: "idem-key-1",
      requestedBy: "operator-1",
    });

    // Already-requested state is not re-updated (idempotent no-op).
    expect(h.updated.find((u) => u.table === "jobExecutionState")).toBeUndefined();
  });

  it("10. schema contract: job execution/cancellation/audit tables are defined", async () => {
    const schema = await vi.importActual<typeof import("../../db/schema")>("../../db/schema");
    expect(schema.jobExecutionState).toBeDefined();
    expect(schema.jobCancellationRequest).toBeDefined();
    expect(schema.jobCancellationAuditEvent).toBeDefined();
  });
});
