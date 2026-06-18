import { describe, it, expect, vi, beforeEach } from "vitest";
import { invokeRoute } from "./_route-harness";

const h = vi.hoisted(() => {
  const queue: any[] = [];
  function next() {
    const v = queue.shift();
    if (v instanceof Error) throw v;
    return v ?? [];
  }
  const db: any = { execute: vi.fn(async () => next()) };
  return { queue, db };
});

vi.mock("../../db", () => ({ db: h.db }));

import replayRouter from "../../routes/employer-replay";
import complianceRouter from "../../routes/employer-compliance";
import timesheetsRouter from "../../routes/employer-timesheets";
import remittanceRunsRouter from "../../routes/employer-remittance-runs";
import payrollRunsRouter from "../../routes/employer-payroll-runs";

const USER = { organizationId: "org-1", id: "user-1" };

function enqueue(...results: any[]) {
  h.queue.push(...results);
}

beforeEach(() => {
  h.queue.length = 0;
  h.db.execute.mockClear();
});

describe("employer-replay routes", () => {
  const validBody = {
    sourceRunId: "11111111-1111-1111-1111-111111111111",
    replayRunId: "22222222-2222-2222-2222-222222222222",
    mode: "exact",
    sourceEngineVersion: "v1",
    replayEngineVersion: "v1",
  };
  const run = { total_gross: 100, total_net: 80, total_dues: 5, total_benefits: 5, total_pension: 5 };

  it("rejects when organization context is missing", async () => {
    const r = await invokeRoute(replayRouter, "post", "/", { body: validBody });
    expect(r.statusCode).toBe(400);
  });

  it("returns 400 on validation failure", async () => {
    const r = await invokeRoute(replayRouter, "post", "/", { user: USER, body: { mode: "exact" } });
    expect(r.statusCode).toBe(400);
    expect((r.body as any).error).toBe("Validation failed");
  });

  it("returns 404 when a run is missing", async () => {
    enqueue([], []);
    const r = await invokeRoute(replayRouter, "post", "/", { user: USER, body: validBody });
    expect(r.statusCode).toBe(404);
  });

  it("creates a replay diff", async () => {
    enqueue([run], [run], [{ id: "replay-1" }]);
    const r = await invokeRoute(replayRouter, "post", "/", { user: USER, body: validBody });
    expect(r.statusCode).toBe(201);
    expect((r.body as any).data.replayId).toBe("replay-1");
  });

  it("returns 500 on unexpected error", async () => {
    enqueue(new Error("db boom"));
    const r = await invokeRoute(replayRouter, "post", "/", { user: USER, body: validBody });
    expect(r.statusCode).toBe(500);
  });
});

describe("employer-compliance routes", () => {
  it("rejects POST /run without org", async () => {
    const r = await invokeRoute(complianceRouter, "post", "/run", { body: {} });
    expect(r.statusCode).toBe(400);
  });

  it("runs compliance checks and persists events", async () => {
    enqueue([], [], [], [], [], []);
    const r = await invokeRoute(complianceRouter, "post", "/run", {
      user: USER,
      body: { ruleVersionExpired: true, missingClassificationCount: 2, remittanceGenerated: true, officialApprovalAttempted: true },
    });
    expect(r.statusCode).toBe(200);
    expect((r.body as any).success).toBe(true);
    expect(Array.isArray((r.body as any).data.events)).toBe(true);
  });

  it("returns 400 on validation failure", async () => {
    const r = await invokeRoute(complianceRouter, "post", "/run", {
      user: USER,
      body: { missingClassificationCount: -1 },
    });
    expect(r.statusCode).toBe(400);
  });

  it("lists compliance events", async () => {
    enqueue([{ id: "e1" }]);
    const r = await invokeRoute(complianceRouter, "get", "/", { user: USER });
    expect(r.statusCode).toBe(200);
  });

  it("rejects GET / without org", async () => {
    const r = await invokeRoute(complianceRouter, "get", "/", {});
    expect(r.statusCode).toBe(400);
  });
});

describe("employer-timesheets routes", () => {
  const csv = [
    "employee_external_id,shift_date,regular_hours,overtime_hours,doubletime_hours,travel_hours",
    "emp-1,2025-01-01,8,0,0,0",
  ].join("\n");
  const uploadBody = {
    employerId: "11111111-1111-1111-1111-111111111111",
    periodStart: "2025-01-01",
    periodEnd: "2025-01-07",
    fileName: "ts.csv",
    csvContent: csv,
  };

  it("rejects upload without org", async () => {
    const r = await invokeRoute(timesheetsRouter, "post", "/upload", { body: uploadBody });
    expect(r.statusCode).toBe(400);
  });

  it("uploads a timesheet batch", async () => {
    enqueue([{ id: "batch-1" }], []); // batch insert, then 1 entry insert
    const r = await invokeRoute(timesheetsRouter, "post", "/upload", { user: USER, body: uploadBody });
    expect(r.statusCode).toBe(201);
    expect((r.body as any).data.batchId).toBe("batch-1");
  });

  it("returns 400 on upload validation failure", async () => {
    const r = await invokeRoute(timesheetsRouter, "post", "/upload", { user: USER, body: { fileName: "x" } });
    expect(r.statusCode).toBe(400);
  });

  it("lists batches", async () => {
    enqueue([{ id: "batch-1" }]);
    const r = await invokeRoute(timesheetsRouter, "get", "/", { user: USER });
    expect(r.statusCode).toBe(200);
  });

  it("rejects list without org", async () => {
    const r = await invokeRoute(timesheetsRouter, "get", "/", {});
    expect(r.statusCode).toBe(400);
  });

  it("fetches a batch by id", async () => {
    enqueue([{ id: "batch-1" }], [{ id: "entry-1" }]);
    const r = await invokeRoute(timesheetsRouter, "get", "/:id", { user: USER, params: { id: "batch-1" } });
    expect(r.statusCode).toBe(200);
  });

  it("returns 404 for a missing batch", async () => {
    enqueue([]);
    const r = await invokeRoute(timesheetsRouter, "get", "/:id", { user: USER, params: { id: "nope" } });
    expect(r.statusCode).toBe(404);
  });

  it("rejects get by id without org", async () => {
    const r = await invokeRoute(timesheetsRouter, "get", "/:id", { params: { id: "x" } });
    expect(r.statusCode).toBe(400);
  });
});

describe("employer-remittance-runs routes", () => {
  const createBody = { payrollRunId: "11111111-1111-1111-1111-111111111111", periodEnd: "2025-01-31" };
  const item = {
    employee_external_id: "emp-1",
    gross_pay: "100",
    net_pay: "80",
    dues_amount: "5",
    benefit_amount: "5",
    pension_amount: "5",
  };

  it("rejects create without org", async () => {
    const r = await invokeRoute(remittanceRunsRouter, "post", "/", { body: createBody });
    expect(r.statusCode).toBe(400);
  });

  it("returns 400 when payroll run has no items", async () => {
    enqueue([]);
    const r = await invokeRoute(remittanceRunsRouter, "post", "/", { user: USER, body: createBody });
    expect(r.statusCode).toBe(400);
  });

  it("creates a remittance run", async () => {
    enqueue([item], [{ id: "rr-1" }], []);
    const r = await invokeRoute(remittanceRunsRouter, "post", "/", { user: USER, body: createBody });
    expect(r.statusCode).toBe(201);
    expect((r.body as any).data.remittanceRunId).toBe("rr-1");
  });

  it("returns 400 on validation failure", async () => {
    const r = await invokeRoute(remittanceRunsRouter, "post", "/", { user: USER, body: {} });
    expect(r.statusCode).toBe(400);
  });

  it("lists remittance runs", async () => {
    enqueue([{ id: "rr-1" }]);
    const r = await invokeRoute(remittanceRunsRouter, "get", "/", { user: USER });
    expect(r.statusCode).toBe(200);
  });

  it("fetches a run by id", async () => {
    enqueue([{ id: "rr-1" }], [{ id: "art-1" }]);
    const r = await invokeRoute(remittanceRunsRouter, "get", "/:id", { user: USER, params: { id: "rr-1" } });
    expect(r.statusCode).toBe(200);
  });

  it("returns 404 for a missing run", async () => {
    enqueue([]);
    const r = await invokeRoute(remittanceRunsRouter, "get", "/:id", { user: USER, params: { id: "nope" } });
    expect(r.statusCode).toBe(404);
  });

  it("rejects list/get without org", async () => {
    expect((await invokeRoute(remittanceRunsRouter, "get", "/", {})).statusCode).toBe(400);
    expect((await invokeRoute(remittanceRunsRouter, "get", "/:id", { params: { id: "x" } })).statusCode).toBe(400);
  });
});

describe("employer-payroll-runs routes", () => {
  const createBody = {
    periodStart: "2025-01-01",
    periodEnd: "2025-01-07",
    runType: "preview",
    entries: [
      {
        rowNumber: 2,
        employeeExternalId: "emp-1",
        shiftDate: "2025-01-01",
        regularHours: 8,
        overtimeHours: 0,
        doubletimeHours: 0,
        travelHours: 0,
      },
    ],
  };

  it("rejects create without org", async () => {
    const r = await invokeRoute(payrollRunsRouter, "post", "/", { body: createBody });
    expect(r.statusCode).toBe(400);
  });

  it("returns 500 when the inline rule set is incomplete (missing shift_premium)", async () => {
    enqueue([{ id: "pr-1" }], []);
    const r = await invokeRoute(payrollRunsRouter, "post", "/", { user: USER, body: createBody });
    expect(r.statusCode).toBe(500);
    expect((r.body as any).error).toContain("shift_premium");
  });

  it("returns 400 on validation failure", async () => {
    const r = await invokeRoute(payrollRunsRouter, "post", "/", { user: USER, body: { periodStart: "x" } });
    expect(r.statusCode).toBe(400);
  });

  it("lists payroll runs", async () => {
    enqueue([{ id: "pr-1" }]);
    const r = await invokeRoute(payrollRunsRouter, "get", "/", { user: USER });
    expect(r.statusCode).toBe(200);
  });

  it("fetches a run by id", async () => {
    enqueue([{ id: "pr-1" }], [{ id: "item-1" }]);
    const r = await invokeRoute(payrollRunsRouter, "get", "/:id", { user: USER, params: { id: "pr-1" } });
    expect(r.statusCode).toBe(200);
  });

  it("returns 404 for a missing run", async () => {
    enqueue([]);
    const r = await invokeRoute(payrollRunsRouter, "get", "/:id", { user: USER, params: { id: "nope" } });
    expect(r.statusCode).toBe(404);
  });

  it("rejects list/get without org", async () => {
    expect((await invokeRoute(payrollRunsRouter, "get", "/", {})).statusCode).toBe(400);
    expect((await invokeRoute(payrollRunsRouter, "get", "/:id", { params: { id: "x" } })).statusCode).toBe(400);
  });
});
