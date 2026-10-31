import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  employerExecutionEvidenceLinks,
  employerPayrollRuns,
  employerExecutionComplianceEvents,
} from "@/db/schema";

const h = vi.hoisted(() => {
  const state = {
    selects: [] as unknown[][],
    dbSelects: [] as unknown[][],
    updates: [] as unknown[][],
    inserts: [] as unknown[][],
    calls: [] as Array<Record<string, any>>,
    auditFails: false,
    rolledBack: false,
    committed: false,
    contexts: [] as unknown[],
  };

  const chain = (take: () => unknown, rec?: (prop: string, args: unknown[]) => void) => {
    const c: any = new Proxy(
      {},
      {
        get: (_t, prop: string) => {
          if (prop === "then") {
            return (res: any, rej: any) => {
              try {
                return Promise.resolve(take()).then(res, rej);
              } catch (error) {
                return Promise.reject(error).then(res, rej);
              }
            };
          }
          return (...args: unknown[]) => {
            rec?.(prop, args);
            return c;
          };
        },
      },
    );
    return c;
  };

  const tx = {
    select: () => {
      const rec: Record<string, any> = { op: "select" };
      state.calls.push(rec);
      return chain(
        () => state.selects.shift() ?? [],
        (p, a) => {
          if (p === "from") rec.table = a[0];
          if (p === "where") rec.where = a[0];
        },
      );
    },
    update: (table: unknown) => {
      const rec: Record<string, any> = { op: "update", table };
      state.calls.push(rec);
      return chain(
        () => state.updates.shift() ?? [],
        (p, a) => {
          if (p === "set") rec.set = a[0];
          if (p === "where") rec.where = a[0];
        },
      );
    },
    insert: (table: unknown) => {
      const rec: Record<string, any> = { op: "insert", table };
      state.calls.push(rec);
      return chain(
        () => state.inserts.shift() ?? [],
        (p, a) => {
          if (p === "values") rec.values = a[0];
        },
      );
    },
  };

  const db = {
    select: () => {
      const rec: Record<string, any> = { op: "db.select" };
      state.calls.push(rec);
      return chain(
        () => state.dbSelects.shift() ?? [],
        (p, a) => {
          if (p === "where") rec.where = a[0];
        },
      );
    },
    insert: () => {
      throw new Error("write outside the transaction");
    },
    update: () => {
      throw new Error("write outside the transaction");
    },
  };

  const withRLSContext = vi.fn(async (ctx: unknown, op: (t: unknown) => Promise<unknown>) => {
    state.contexts.push(ctx);
    try {
      const result = await op(tx);
      state.committed = true;
      return result;
    } catch (error) {
      state.rolledBack = true;
      throw error;
    }
  });

  const audit = vi.fn(async (_tx: unknown, entry: unknown) => {
    state.calls.push({ op: "audit", entry });
    if (state.auditFails) throw new Error("audit unavailable");
  });

  return {
    state,
    tx,
    db,
    withRLSContext,
    audit,
    requireEntitlement: vi.fn(async () => undefined),
    requireLiveFinancialMandate: vi.fn(async () => ({ mandateId: 'synthetic', ledgerWide: true, resourceIds: [], accountIds: [] })),
  };
});

vi.mock("@/lib/api/framework", async () => {
  const { ApiError } = await vi.importActual<typeof import("@/lib/api/errors")>("@/lib/api/errors");
  const { z } = await import("zod");
  return {
    ApiError,
    z,
    withApi: (cfg: unknown, handler: (ctx: unknown) => unknown) =>
      Object.assign((ctx: unknown) => handler(ctx), { cfg }),
  };
});
vi.mock("@/db", () => ({ db: h.db }));
vi.mock("@/lib/db/with-rls-context", () => ({ withRLSContext: h.withRLSContext }));
vi.mock("@/lib/audit/atomic-audit", () => ({ persistAtomicAudit: h.audit }));
vi.mock("@/lib/finance/require-live-financial-mandate", () => ({ requireLiveFinancialMandate: h.requireLiveFinancialMandate }));
vi.mock("@/services/platform-economics/entitlement-guard", () => ({
  PLATFORM_MODULES: { EMPLOYER_PAYROLL_OFFICIAL: "employer_payroll_official" },
  requireEntitlement: h.requireEntitlement,
}));

const dialect = new PgDialect();
const paramsOf = (expr: unknown) => dialect.sqlToQuery(expr as any).params;

const ORG = "11111111-1111-4111-8111-111111111111";
const RUN_ID = "22222222-2222-4222-8222-222222222222";
const BATCH_ID = "33333333-3333-4333-8333-333333333333";
const PREPARER = "user_preparer";
const APPROVER = "user_approver";
const EXECUTOR = "user_executor";

const AMOUNTS = { totalGross: "1000.00", totalNet: "800.00", totalDues: "20.00", totalBenefits: "30.00", totalPension: "40.00" };

const makeRun = (over: Record<string, unknown> = {}) => ({
  id: RUN_ID,
  organizationId: ORG,
  runCode: "pr-1",
  runType: "official",
  status: "calculated",
  periodStart: "2026-04-01",
  periodEnd: "2026-04-15",
  sourceBatchId: BATCH_ID,
  cbaRuleVersionId: null,
  engineVersion: "engine-v1",
  inputSnapshot: { creatorUserId: PREPARER },
  calcTrace: {},
  calcTraceHash: "hash",
  immutableSnapshotLocked: false,
  approvedBy: null,
  approvedAt: null,
  ...AMOUNTS,
  ...over,
});

const auditEntries = () => h.state.calls.filter((c) => c.op === "audit").map((c) => c.entry);
const writes = () => h.state.calls.filter((c) => c.op === "update" || c.op === "insert");

beforeEach(() => {
  vi.clearAllMocks();
  h.state.selects = [];
  h.state.dbSelects = [];
  h.state.updates = [];
  h.state.inserts = [];
  h.state.calls = [];
  h.state.auditFails = false;
  h.state.rolledBack = false;
  h.state.committed = false;
  h.state.contexts = [];
});

describe("payroll-runs/[id] PATCH (approve / execute)", () => {
  const load = async () => (await import("../payroll-runs/[id]/route")).PATCH as any;
  const ctx = (userId: string, action: "approve" | "seal", id = RUN_ID) => ({
    organizationId: ORG,
    userId,
    params: { id },
    body: { action, acknowledgedEventIds: [] },
  });

  it("requires the named finance authority and ignores amount/status/organization from the body", async () => {
    const PATCH = await load();
    expect(PATCH.cfg.auth).toEqual({ roles: ["secretary_treasurer"] });
    const parsed = PATCH.cfg.body.parse({
      action: "approve",
      totalGross: "999999",
      status: "posted",
      organizationId: "other-org",
    });
    expect(parsed).toEqual({ action: "approve", acknowledgedEventIds: [] });
  });

  it("approves on the caller's tx with the audit record, from the amounts on record", async () => {
    const PATCH = await load();
    h.state.selects = [[makeRun()], [], []];
    h.state.updates = [[makeRun({ status: "approved", approvedBy: APPROVER, immutableSnapshotLocked: true })]];

    const response = await PATCH(ctx(APPROVER, "approve"));

    expect(response.data.run.status).toBe("approved");
    expect(h.withRLSContext).toHaveBeenCalledWith({ organizationId: ORG, userId: APPROVER }, expect.any(Function));
    expect(h.audit).toHaveBeenCalledTimes(1);
    expect(h.audit).toHaveBeenCalledWith(
      h.tx,
      expect.objectContaining({
        organizationId: ORG,
        userId: APPROVER,
        action: "employer_execution.payroll_run.approve",
        resourceType: "employer_payroll_runs",
        resourceId: RUN_ID,
        details: expect.objectContaining({ preparedBy: PREPARER, approvers: [APPROVER], amounts: AMOUNTS }),
      }),
    );
    const update = h.state.calls.find((c) => c.op === "update" && c.table === employerPayrollRuns)!;
    expect(update.set).toMatchObject({ status: "approved", approvedBy: APPROVER, immutableSnapshotLocked: true });
    expect(update.set).not.toHaveProperty("totalGross");
    // the audit record is the last write of the transaction
    expect(h.state.calls[h.state.calls.length - 1].op).toBe("audit");
    expect(h.state.committed).toBe(true);
  });

  it("fails and rolls back the approval when the audit record cannot be written", async () => {
    const PATCH = await load();
    h.state.selects = [[makeRun()], [], []];
    h.state.updates = [[makeRun({ status: "approved" })]];
    h.state.auditFails = true;

    await expect(PATCH(ctx(APPROVER, "approve"))).rejects.toThrow("audit unavailable");
    expect(h.state.rolledBack).toBe(true);
    expect(h.state.committed).toBe(false);
  });

  it("locates the run by id AND the authenticated organization; a miss is 404 with no write and no audit", async () => {
    const PATCH = await load();
    h.state.selects = [[]];

    await expect(PATCH(ctx(APPROVER, "approve"))).rejects.toMatchObject({ code: "NOT_FOUND" });

    const lookup = h.state.calls.find((c) => c.op === "select")!;
    expect(paramsOf(lookup.where)).toEqual(expect.arrayContaining([ORG, RUN_ID]));
    expect(writes()).toEqual([]);
    expect(h.audit).not.toHaveBeenCalled();
  });

  it("treats a run of another organization as absent (cross-organization is 404)", async () => {
    const PATCH = await load();
    // RLS plus the organization predicate return nothing for a foreign run id
    h.state.selects = [[]];
    await expect(PATCH({ ...ctx(APPROVER, "seal"), organizationId: "22222222-aaaa-4222-8222-222222222222" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(h.audit).not.toHaveBeenCalled();
  });

  it("refuses self-approval: the preparer cannot approve their own run", async () => {
    const PATCH = await load();
    h.state.selects = [[makeRun()], [], []];

    await expect(PATCH(ctx(PREPARER, "approve"))).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(writes()).toEqual([]);
    expect(h.audit).not.toHaveBeenCalled();
    expect(h.state.rolledBack).toBe(true);
  });

  it("fails closed when the preparer is not recorded on the run", async () => {
    const PATCH = await load();
    h.state.selects = [[makeRun({ inputSnapshot: {} })], [], []];
    await expect(PATCH(ctx(APPROVER, "approve"))).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(h.audit).not.toHaveBeenCalled();
  });

  it("answers 409 and writes no audit when another approver changed the run first", async () => {
    const PATCH = await load();
    h.state.selects = [[makeRun()], [], []];
    h.state.updates = [[]];

    await expect(PATCH(ctx(APPROVER, "approve"))).rejects.toMatchObject({ code: "CONFLICT" });
    const update = h.state.calls.find((c) => c.op === "update")!;
    expect(paramsOf(update.where)).toEqual(expect.arrayContaining(["calculated", false]));
    expect(h.audit).not.toHaveBeenCalled();
    expect(h.state.rolledBack).toBe(true);
  });

  it("records a first approval of a dual-approval run with its own audit entry, then refuses the same person twice", async () => {
    const PATCH = await load();
    const dualRun = makeRun({ cbaRuleVersionId: "rv-1" });
    h.state.selects = [[dualRun], [], [], [{ id: "rv-1", profileId: "pf-1" }], [{ configJson: { require_dual_approval: true } }]];
    h.state.updates = [[{ id: RUN_ID }]];

    const first = await PATCH(ctx(APPROVER, "approve"));
    expect(first.data.approvalPending).toBe(true);
    expect(auditEntries()[0]).toMatchObject({
      action: "employer_execution.payroll_run.approval_recorded",
      details: expect.objectContaining({ firstApprover: APPROVER, preparedBy: PREPARER }),
    });

    h.state.calls = [];
    h.audit.mockClear();
    const secondRun = makeRun({
      cbaRuleVersionId: "rv-1",
      inputSnapshot: { creatorUserId: PREPARER, approvals: [{ userId: APPROVER }] },
    });
    h.state.selects = [[secondRun], [], [], [{ id: "rv-1", profileId: "pf-1" }], [{ configJson: { require_dual_approval: true } }]];
    await expect(PATCH(ctx(APPROVER, "approve"))).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(h.audit).not.toHaveBeenCalled();
  });

  it("completes a dual approval with a second distinct approver and records both", async () => {
    const PATCH = await load();
    const run = makeRun({
      cbaRuleVersionId: "rv-1",
      inputSnapshot: { creatorUserId: PREPARER, approvals: [{ userId: APPROVER }] },
    });
    h.state.selects = [[run], [], [], [{ id: "rv-1", profileId: "pf-1" }], [{ configJson: { require_dual_approval: true } }]];
    h.state.updates = [[makeRun({ status: "approved", approvedBy: "user_second" })]];

    await PATCH(ctx("user_second", "approve"));
    expect(auditEntries()[0].details).toMatchObject({ approvers: [APPROVER, "user_second"], dualApproval: true });
  });

  it("executes (seals) with a third person, recording preparer, approver and executor", async () => {
    const PATCH = await load();
    const approved = makeRun({ status: "approved", approvedBy: APPROVER, immutableSnapshotLocked: true });
    h.state.selects = [[approved]];
    h.state.updates = [[{ ...approved, status: "posted" }]];

    const response = await PATCH(ctx(EXECUTOR, "seal"));

    expect(response.data.run.status).toBe("posted");
    expect(h.audit).toHaveBeenCalledWith(
      h.tx,
      expect.objectContaining({
        action: "employer_execution.payroll_run.execute",
        details: expect.objectContaining({ preparedBy: PREPARER, approvers: [APPROVER], executedBy: EXECUTOR, amounts: AMOUNTS }),
      }),
    );
    const update = h.state.calls.find((c) => c.op === "update")!;
    expect(paramsOf(update.where)).toEqual(expect.arrayContaining(["approved"]));
    const event = h.state.calls.find((c) => c.op === "insert" && c.table === employerExecutionComplianceEvents)!;
    expect(event.values).toMatchObject({ eventCode: "official_run_posted", details: expect.objectContaining({ executedBy: EXECUTOR }) });
  });

  it("refuses self-execution and execution by the approver", async () => {
    const PATCH = await load();
    const approved = makeRun({ status: "approved", approvedBy: APPROVER, immutableSnapshotLocked: true });

    h.state.selects = [[approved]];
    await expect(PATCH(ctx(PREPARER, "seal"))).rejects.toMatchObject({ code: "FORBIDDEN", message: expect.stringContaining("prepared") });

    h.state.selects = [[approved]];
    await expect(PATCH(ctx(APPROVER, "seal"))).rejects.toMatchObject({ code: "FORBIDDEN", message: expect.stringContaining("approved") });

    expect(writes()).toEqual([]);
    expect(h.audit).not.toHaveBeenCalled();
  });

  it("refuses a second execution: a lost race is 409 and a finished run is refused", async () => {
    const PATCH = await load();
    const approved = makeRun({ status: "approved", approvedBy: APPROVER, immutableSnapshotLocked: true });

    h.state.selects = [[approved]];
    h.state.updates = [[]];
    await expect(PATCH(ctx(EXECUTOR, "seal"))).rejects.toMatchObject({ code: "CONFLICT" });

    h.state.selects = [[{ ...approved, status: "posted" }]];
    await expect(PATCH(ctx(EXECUTOR, "seal"))).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    expect(h.audit).not.toHaveBeenCalled();
  });

  it("refuses to execute a run that was never approved", async () => {
    const PATCH = await load();
    h.state.selects = [[makeRun()]];
    await expect(PATCH(ctx(EXECUTOR, "seal"))).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(writes()).toEqual([]);
  });

  it("fails and rolls back an execution whose audit record cannot be written", async () => {
    const PATCH = await load();
    const approved = makeRun({ status: "approved", approvedBy: APPROVER, immutableSnapshotLocked: true });
    h.state.selects = [[approved]];
    h.state.updates = [[{ ...approved, status: "posted" }]];
    h.state.auditFails = true;

    await expect(PATCH(ctx(EXECUTOR, "seal"))).rejects.toThrow("audit unavailable");
    expect(h.state.rolledBack).toBe(true);
  });
});

describe("remittance-runs POST (execute)", () => {
  const load = async () => (await import("../remittance-runs/route")).POST as any;
  const approvedRun = () => makeRun({ status: "approved", approvedBy: APPROVER, immutableSnapshotLocked: true });
  const item = (dues: string, benefits: string, pension: string) => ({
    employeeExternalId: "E",
    duesAmount: dues,
    benefitAmount: benefits,
    pensionAmount: pension,
    grossPay: "100.00",
    netPay: "80.00",
  });
  const ctx = (userId: string) => ({ organizationId: ORG, userId, body: { payrollRunId: RUN_ID } });

  it("requires the named finance authority and takes only the payroll run id from the body", async () => {
    const POST = await load();
    expect(POST.cfg.auth).toEqual({ roles: ["secretary_treasurer"] });
    expect(POST.cfg.body.parse({ payrollRunId: RUN_ID, totalDue: 1, status: "submitted" })).toEqual({ payrollRunId: RUN_ID });
  });

  it("generates from the items on record in integer cents and audits on the same tx", async () => {
    const POST = await load();
    h.state.selects = [[approvedRun()], [], [], [item("0.10", "0.20", "1.00"), item("0.20", "0.10", "2.00")]];
    h.state.inserts = [[{ id: "rr-1", runCode: "rr-9", status: "generated", generatedAt: new Date() }]];

    const response = await POST(ctx(EXECUTOR));

    expect(response.data.remittanceRun.id).toBe("rr-1");
    const run = h.state.calls.find((c) => c.op === "insert" && c.values?.totalDue !== undefined)!;
    expect(run.values.totalDue).toBe("3.6");
    expect(run.values.packageSummary).toMatchObject({ dues: 0.3, benefits: 0.3, pension: 3 });
    expect(run.values.generatedBy).toBe(EXECUTOR);
    expect(h.audit).toHaveBeenCalledWith(
      h.tx,
      expect.objectContaining({
        action: "employer_execution.remittance_run.generate",
        resourceId: "rr-1",
        details: expect.objectContaining({
          preparedBy: PREPARER,
          approvers: [APPROVER],
          executedBy: EXECUTOR,
          totalDue: 3.6,
          payrollRunAmounts: AMOUNTS,
        }),
      }),
    );
    expect(h.state.calls[h.state.calls.length - 1].op).toBe("audit");
    // every write went through the transaction handle
    expect(h.state.committed).toBe(true);
  });

  it("chains the remittance from the run's own seal, not from a replay manifest", async () => {
    const POST = await load();
    const replay = { manifestJson: { chainLink: { entityType: "replay", linkId: "replay-link", sealHash: "rs", chainDepth: 2 } } };
    const own = { manifestJson: { chainLink: { entityType: "payroll_run", linkId: "own-link", sealHash: "os", chainDepth: 1 } } };
    h.state.selects = [[approvedRun()], [], [replay, own], [item("1.00", "1.00", "1.00")]];
    h.state.inserts = [[{ id: "rr-1", runCode: "rr-9", status: "generated", generatedAt: new Date() }]];

    await POST(ctx(EXECUTOR));

    const link = h.state.calls.find((c) => c.op === "insert" && c.table === employerExecutionEvidenceLinks)!;
    expect(link.values.parentLinkId).toBe("own-link");
  });

  it("is 404 with no write and no audit when the run is not in the organization", async () => {
    const POST = await load();
    h.state.selects = [[]];
    await expect(POST(ctx(EXECUTOR))).rejects.toMatchObject({ code: "NOT_FOUND" });
    const lookup = h.state.calls.find((c) => c.op === "select")!;
    expect(paramsOf(lookup.where)).toEqual(expect.arrayContaining([ORG, RUN_ID]));
    expect(writes()).toEqual([]);
    expect(h.audit).not.toHaveBeenCalled();
  });

  it("refuses runs that are not approved", async () => {
    const POST = await load();
    h.state.selects = [[makeRun()]];
    await expect(POST(ctx(EXECUTOR))).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(h.audit).not.toHaveBeenCalled();
  });

  it("refuses the preparer and the approver as executor", async () => {
    const POST = await load();
    h.state.selects = [[approvedRun()]];
    await expect(POST(ctx(PREPARER))).rejects.toMatchObject({ code: "FORBIDDEN" });
    h.state.selects = [[approvedRun()]];
    await expect(POST(ctx(APPROVER))).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(writes()).toEqual([]);
    expect(h.audit).not.toHaveBeenCalled();
  });

  it("refuses to execute the same payroll run twice (409)", async () => {
    const POST = await load();
    h.state.selects = [[approvedRun()], [{ id: "rr-existing" }]];
    await expect(POST(ctx(EXECUTOR))).rejects.toMatchObject({ code: "CONFLICT" });
    expect(writes()).toEqual([]);
    expect(h.audit).not.toHaveBeenCalled();
  });

  it("fails and rolls back when the audit record cannot be written", async () => {
    const POST = await load();
    h.state.selects = [[approvedRun()], [], [], [item("1.00", "1.00", "1.00")]];
    h.state.inserts = [[{ id: "rr-1", runCode: "rr-9", status: "generated", generatedAt: new Date() }]];
    h.state.auditFails = true;
    await expect(POST(ctx(EXECUTOR))).rejects.toThrow("audit unavailable");
    expect(h.state.rolledBack).toBe(true);
    expect(h.state.committed).toBe(false);
  });
});

describe("payroll-runs POST (prepare)", () => {
  const load = async () => (await import("../payroll-runs/route")).POST as any;
  const body = { timesheetBatchId: BATCH_ID, periodStart: "2026-04-01", periodEnd: "2026-04-15", runType: "preview", engineVersion: "engine-v1" };
  const batch = (status = "validated") => ({ id: BATCH_ID, organizationId: ORG, employerId: "e", worksiteId: null, bargainingUnitId: null, status, sourceFileHash: "fh" });
  const entry = {
    rowNumber: 2,
    employeeExternalId: "EMP-1",
    shiftDate: "2026-04-01",
    regularHours: "8",
    overtimeHours: "0",
    doubletimeHours: "0",
    travelHours: "0",
    premiumCode: null,
    jobClassificationId: "jc",
    memberEmploymentId: "me",
  };
  const ruleVersion = {
    id: "rv-1",
    ruleVersionCode: "v1",
    sourceHash: "sh",
    rulesJson: { base_rate: 52, overtime: 1.5, double_time: 2, shift_premium: 0.1, travel: 0.5, dues: 0.02, benefits: 0.03, pension: 0.04 },
  };
  const happyReads = () => {
    h.state.dbSelects = [[batch()], [entry], [ruleVersion], []];
    h.state.inserts = [[{ id: RUN_ID, runCode: "pr-1", totalGross: "416.00", totalNet: "1", totalDues: "1", totalBenefits: "1", totalPension: "1" }]];
  };
  const ctx = (userId: string | null) => ({ organizationId: ORG, userId, body });

  it("requires the named finance authority", async () => {
    expect((await load()).cfg.auth).toEqual({ roles: ["secretary_treasurer"] });
  });

  it("records the preparer in the run and audits on the same tx", async () => {
    const POST = await load();
    happyReads();

    const response = await POST(ctx(PREPARER));

    expect(response.data.run.id).toBe(RUN_ID);
    const runInsert = h.state.calls.find((c) => c.op === "insert" && c.values?.runCode)!;
    expect(runInsert.values.inputSnapshot.creatorUserId).toBe(PREPARER);
    expect(runInsert.values.status).toBe("calculated");
    expect(h.audit).toHaveBeenCalledWith(
      h.tx,
      expect.objectContaining({
        action: "employer_execution.payroll_run.prepare",
        resourceId: RUN_ID,
        details: expect.objectContaining({ preparedBy: PREPARER, timesheetBatchId: BATCH_ID }),
      }),
    );
    expect(h.state.calls[h.state.calls.length - 1].op).toBe("audit");
  });

  it("fails and rolls back when the audit record cannot be written", async () => {
    const POST = await load();
    happyReads();
    h.state.auditFails = true;
    await expect(POST(ctx(PREPARER))).rejects.toThrow("audit unavailable");
    expect(h.state.rolledBack).toBe(true);
  });

  it("is 404 with no write and no audit when the batch is not in the organization", async () => {
    const POST = await load();
    h.state.dbSelects = [[]];
    await expect(POST(ctx(PREPARER))).rejects.toMatchObject({ code: "NOT_FOUND" });
    const lookup = h.state.calls.find((c) => c.op === "db.select")!;
    expect(paramsOf(lookup.where)).toEqual(expect.arrayContaining([ORG, BATCH_ID]));
    expect(h.withRLSContext).toHaveBeenCalledTimes(1);
    expect(h.audit).not.toHaveBeenCalled();
  });

  it("will not prepare a run from a batch that was not validated", async () => {
    const POST = await load();
    h.state.dbSelects = [[batch("rejected")]];
    await expect(POST(ctx(PREPARER))).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(h.withRLSContext).toHaveBeenCalledTimes(1);
    expect(h.audit).not.toHaveBeenCalled();
  });

  it("refuses an unauthenticated actor", async () => {
    const POST = await load();
    await expect(POST(ctx(null))).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(h.audit).not.toHaveBeenCalled();
  });
});

describe("replay/[runId] POST", () => {
  const load = async () => (await import("../replay/[runId]/route")).POST as any;
  const sourceRun = () => makeRun({ status: "approved", approvedBy: APPROVER, immutableSnapshotLocked: true, cbaRuleVersionId: "rv-1" });
  const entry = {
    rowNumber: 2,
    employeeExternalId: "EMP-1",
    shiftDate: "2026-04-01",
    regularHours: "8",
    overtimeHours: "0",
    doubletimeHours: "0",
    travelHours: "0",
    premiumCode: null,
  };
  const ruleVersion = {
    id: "rv-1",
    ruleVersionCode: "v1",
    sourceHash: "sh",
    rulesJson: { base_rate: 52, overtime: 1.5, double_time: 2, shift_premium: 0.1, travel: 0.5, dues: 0.02, benefits: 0.03, pension: 0.04 },
  };
  const ctx = { organizationId: ORG, userId: EXECUTOR, params: { runId: RUN_ID }, body: { mode: "exact" } };
  const happyReads = (manifests: unknown[] = []) => {
    h.state.dbSelects = [[sourceRun()], [], manifests, [entry], [ruleVersion], []];
    h.state.inserts = [[{ id: "rp-1", diffHash: "dh" }]];
  };

  it("requires the named finance authority", async () => {
    expect((await load()).cfg.auth).toEqual({ roles: ["secretary_treasurer"] });
  });

  it("adds records beside the run, never touches the run's recorded outcome, and audits on the same tx", async () => {
    const POST = await load();
    happyReads();

    const response = await POST(ctx);

    expect(response.data.replay.id).toBe("rp-1");
    expect(h.state.calls.filter((c) => c.op === "update")).toEqual([]);
    expect(h.state.calls.some((c) => c.op === "insert" && c.table === employerPayrollRuns)).toBe(false);
    expect(h.audit).toHaveBeenCalledWith(
      h.tx,
      expect.objectContaining({
        action: "employer_execution.replay.create",
        resourceType: "employer_execution_replays",
        resourceId: "rp-1",
        details: expect.objectContaining({ sourcePayrollRunId: RUN_ID, mode: "exact", sourceAmounts: AMOUNTS }),
      }),
    );
    expect(h.state.calls[h.state.calls.length - 1].op).toBe("audit");
  });

  it("chains the replay from the run's own seal, not from an earlier replay", async () => {
    const POST = await load();
    const earlierReplay = { manifestJson: { chainLink: { entityType: "replay", linkId: "replay-link", sealHash: "rs", chainDepth: 2 } } };
    const own = { manifestJson: { chainLink: { entityType: "payroll_run", linkId: "own-link", sealHash: "os", chainDepth: 1 } } };
    happyReads([earlierReplay, own]);

    await POST(ctx);

    const link = h.state.calls.find((c) => c.op === "insert" && c.table === employerExecutionEvidenceLinks)!;
    expect(link.values.parentLinkId).toBe("own-link");
  });

  it("finds the source run by id AND the authenticated organization; a miss is 404 with no audit", async () => {
    const POST = await load();
    h.state.dbSelects = [[]];

    await expect(POST(ctx)).rejects.toMatchObject({ code: "NOT_FOUND" });

    const lookup = h.state.calls.find((c) => c.op === "db.select")!;
    expect(paramsOf(lookup.where)).toEqual(expect.arrayContaining([ORG, RUN_ID]));
    expect(h.requireLiveFinancialMandate).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "finance:view", resourceId: RUN_ID }));
    expect(h.audit).not.toHaveBeenCalled();
  });

  it("fails and rolls back the replay when the audit record cannot be written", async () => {
    const POST = await load();
    happyReads();
    h.state.auditFails = true;
    await expect(POST(ctx)).rejects.toThrow("audit unavailable");
    expect(h.state.rolledBack).toBe(true);
  });
});

describe("compliance POST", () => {
  const load = async () => (await import("../compliance/route")).POST as any;
  const body = { eventCode: "late_remittance", severity: "warning", summary: "late", details: { raisedBy: "forged" }, blocking: "no", payrollRunId: RUN_ID };
  const ctx = { organizationId: ORG, userId: PREPARER, body };

  it("persists the event and audits on the same tx; the raiser cannot be forged", async () => {
    const POST = await load();
    h.state.selects = [[{ id: RUN_ID }]];
    h.state.inserts = [[{ id: "ev-1" }]];

    const response = await POST(ctx);

    expect(response.data.id).toBe("ev-1");
    const insert = h.state.calls.find((c) => c.op === "insert")!;
    expect(insert.values.details.raisedBy).toBe(PREPARER);
    expect(h.audit).toHaveBeenCalledWith(
      h.tx,
      expect.objectContaining({ action: "employer_execution.compliance_event.create", resourceId: "ev-1", userId: PREPARER }),
    );
  });

  it("is 404 with no insert and no audit when the run belongs to another organization", async () => {
    const POST = await load();
    h.state.selects = [[]];

    await expect(POST(ctx)).rejects.toMatchObject({ code: "NOT_FOUND" });

    const lookup = h.state.calls.find((c) => c.op === "select")!;
    expect(paramsOf(lookup.where)).toEqual(expect.arrayContaining([ORG, RUN_ID]));
    expect(writes()).toEqual([]);
    expect(h.audit).not.toHaveBeenCalled();
  });

  it("fails and rolls back when the audit record cannot be written", async () => {
    const POST = await load();
    h.state.selects = [[{ id: RUN_ID }]];
    h.state.inserts = [[{ id: "ev-1" }]];
    h.state.auditFails = true;
    await expect(POST(ctx)).rejects.toThrow("audit unavailable");
    expect(h.state.rolledBack).toBe(true);
  });
});

describe("timesheets POST (ingest)", () => {
  const load = async () => (await import("../timesheets/route")).POST as any;
  const EMPLOYER = "44444444-4444-4444-8444-444444444444";
  const body = {
    employerId: EMPLOYER,
    periodStart: "2026-04-01",
    periodEnd: "2026-04-15",
    sourceFileName: "t.csv",
    csvContent: "employee_external_id,shift_date,regular_hours\nE1,2026-04-01,8",
  };
  const ctx = { organizationId: ORG, userId: PREPARER, body };

  it("ingests and audits on the same tx", async () => {
    const POST = await load();
    h.state.selects = [[{ id: EMPLOYER }], []];
    h.state.inserts = [[{ id: "b-1", batchCode: "ts-1", status: "validated" }]];

    const response = await POST(ctx);

    expect(response.data.batch.id).toBe("b-1");
    const batchInsert = h.state.calls.find((c) => c.op === "insert")!;
    expect(batchInsert.values.uploadedBy).toBe(PREPARER);
    expect(h.audit).toHaveBeenCalledWith(
      h.tx,
      expect.objectContaining({ action: "employer_execution.timesheet_batch.ingest", resourceId: "b-1" }),
    );
    expect(h.state.calls[h.state.calls.length - 1].op).toBe("audit");
  });

  it("is 404 with no insert and no audit when the employer is not in the organization", async () => {
    const POST = await load();
    h.state.selects = [[]];
    await expect(POST(ctx)).rejects.toMatchObject({ code: "NOT_FOUND" });
    const lookup = h.state.calls.find((c) => c.op === "select")!;
    expect(paramsOf(lookup.where)).toEqual(expect.arrayContaining([ORG, EMPLOYER]));
    expect(writes()).toEqual([]);
    expect(h.audit).not.toHaveBeenCalled();
  });

  it("refuses to ingest the same file twice for the employer and period (409)", async () => {
    const POST = await load();
    h.state.selects = [[{ id: EMPLOYER }], [{ id: "b-existing" }]];
    await expect(POST(ctx)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(writes()).toEqual([]);
    expect(h.audit).not.toHaveBeenCalled();
  });

  it("fails and rolls back when the audit record cannot be written", async () => {
    const POST = await load();
    h.state.selects = [[{ id: EMPLOYER }], []];
    h.state.inserts = [[{ id: "b-1", batchCode: "ts-1", status: "validated" }]];
    h.state.auditFails = true;
    await expect(POST(ctx)).rejects.toThrow("audit unavailable");
    expect(h.state.rolledBack).toBe(true);
  });
});
