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
      "set",
      "values",
      "returning",
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
  const parser = { parseCSV: vi.fn(), parseExcel: vi.fn(), parseXML: vi.fn() };
  const engine = { reconcile: vi.fn(), generateReport: vi.fn() };
  const multerConfig: { value: any } = { value: undefined };
  return { queue, db, schema, parser, engine, multerConfig };
});

vi.mock("multer", () => {
  const multerFn: any = (config: any) => {
    h.multerConfig.value = config;
    return { single: () => (_req: any, _res: any, n: any) => n() };
  };
  multerFn.memoryStorage = () => ({});
  return { default: multerFn };
});
vi.mock("@union-claims/financial", () => ({
  RemittanceParser: class {
    parseCSV = h.parser.parseCSV;
    parseExcel = h.parser.parseExcel;
    parseXML = h.parser.parseXML;
  },
  ReconciliationEngine: class {
    reconcile = h.engine.reconcile;
    generateReport = h.engine.generateReport;
  },
}));
vi.mock("../../db", () => ({ db: h.db, schema: h.schema }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import remittancesRouter from "../../routes/remittances";

const UUID = "11111111-1111-1111-1111-111111111111";
const ADMIN = { organizationId: "org-1", userId: "u1", id: "u1", role: "admin" };
const MEMBER = { organizationId: "org-1", userId: "u1", id: "u1", role: "member" };
const NO_ORG = { userId: "u1", role: "admin" };

function enqueue(...results: any[]) {
  h.queue.push(...results);
}

const VALID_CREATE = {
  employerId: UUID,
  employerName: "Acme",
  batchNumber: "B1",
  billingPeriodStart: "2025-01-01",
  billingPeriodEnd: "2025-01-31",
  totalAmount: 100,
  totalMembers: 5,
  remittanceDate: "2025-02-01",
  paymentMethod: "ach",
};

beforeEach(() => {
  h.queue.length = 0;
  h.db.select.mockClear();
  h.db.insert.mockClear();
  h.db.update.mockClear();
  h.parser.parseCSV.mockReset();
  h.parser.parseExcel.mockReset();
  h.parser.parseXML.mockReset();
  h.engine.reconcile.mockReset();
  h.engine.generateReport.mockReset();
});

describe("remittances routes", () => {
  it("lists remittances with filters", async () => {
    enqueue([{ id: "r1" }]);
    const r = await invokeRoute(remittancesRouter, "get", "/", {
      user: ADMIN,
      query: { employerId: UUID, status: "pending" },
    });
    expect(r.statusCode).toBe(200);
  });

  it("returns 401 when listing without org context", async () => {
    const r = await invokeRoute(remittancesRouter, "get", "/", { user: NO_ORG, query: {} });
    expect(r.statusCode).toBe(401);
  });

  it("returns 500 when listing throws", async () => {
    enqueue(new Error("db"));
    const r = await invokeRoute(remittancesRouter, "get", "/", { user: ADMIN, query: {} });
    expect(r.statusCode).toBe(500);
  });

  it("fetches a remittance by id", async () => {
    enqueue([{ id: "r1" }]);
    const r = await invokeRoute(remittancesRouter, "get", "/:id", { user: ADMIN, params: { id: "r1" } });
    expect(r.statusCode).toBe(200);
  });

  it("returns 404 for a missing remittance", async () => {
    enqueue([]);
    const r = await invokeRoute(remittancesRouter, "get", "/:id", { user: ADMIN, params: { id: "x" } });
    expect(r.statusCode).toBe(404);
  });

  it("returns 401 fetching without org context", async () => {
    const r = await invokeRoute(remittancesRouter, "get", "/:id", { user: NO_ORG, params: { id: "r1" } });
    expect(r.statusCode).toBe(401);
  });

  it("creates a remittance", async () => {
    enqueue([{ id: "r1" }]);
    const r = await invokeRoute(remittancesRouter, "post", "/", {
      user: ADMIN,
      body: { ...VALID_CREATE, referenceNumber: "REF1", notes: "n" },
    });
    expect(r.statusCode).toBe(201);
  });

  it("returns 401 creating without org context", async () => {
    const r = await invokeRoute(remittancesRouter, "post", "/", { user: NO_ORG, body: VALID_CREATE });
    expect(r.statusCode).toBe(401);
  });

  it("denies creation for non-admins", async () => {
    const r = await invokeRoute(remittancesRouter, "post", "/", { user: MEMBER, body: VALID_CREATE });
    expect(r.statusCode).toBe(403);
  });

  it("returns 400 on creation validation error", async () => {
    const r = await invokeRoute(remittancesRouter, "post", "/", { user: ADMIN, body: { employerId: "x" } });
    expect(r.statusCode).toBe(400);
  });

  it("reconciles a remittance via auto-match", async () => {
    enqueue(
      [{ id: "r1", totalAmount: "50", remittanceDate: "2025-02-01", remittancePeriodStart: "2025-01-01", remittancePeriodEnd: "2025-01-31" }],
      [{ id: "t1", totalAmount: "50", memberId: "m1" }],
      [],
      [{ id: "r1", reconciliationStatus: "reconciled" }],
    );
    const r = await invokeRoute(remittancesRouter, "post", "/:id/reconcile", {
      user: ADMIN,
      params: { id: "r1" },
      body: { autoMatch: true },
    });
    expect(r.statusCode).toBe(200);
    expect((r.body as any).data.status).toBe("reconciled");
  });

  it("reconciles a remittance with explicit transaction ids", async () => {
    enqueue(
      [{ id: "r1", totalAmount: "30", remittanceDate: "2025-02-01", remittancePeriodStart: "2025-01-01", remittancePeriodEnd: "2025-01-31" }],
      [{ id: "t1", totalAmount: "50", memberId: "m1" }],
      [],
      [{ id: "r1", reconciliationStatus: "variance_detected" }],
    );
    const r = await invokeRoute(remittancesRouter, "post", "/:id/reconcile", {
      user: ADMIN,
      params: { id: "r1" },
      body: { transactionIds: [UUID], autoMatch: false },
    });
    expect(r.statusCode).toBe(200);
    expect((r.body as any).data.status).toBe("variance_detected");
  });

  it("returns 404 reconciling a missing remittance", async () => {
    enqueue([]);
    const r = await invokeRoute(remittancesRouter, "post", "/:id/reconcile", {
      user: ADMIN,
      params: { id: "x" },
      body: { autoMatch: true },
    });
    expect(r.statusCode).toBe(404);
  });

  it("returns 400 when remittance already reconciled", async () => {
    enqueue([{ id: "r1", reconciliationStatus: "reconciled" }]);
    const r = await invokeRoute(remittancesRouter, "post", "/:id/reconcile", {
      user: ADMIN,
      params: { id: "r1" },
      body: { autoMatch: true },
    });
    expect(r.statusCode).toBe(400);
  });

  it("returns 400 when no matching transactions found", async () => {
    enqueue(
      [{ id: "r1", totalAmount: "50", remittancePeriodStart: "2025-01-01", remittancePeriodEnd: "2025-01-31" }],
      [],
    );
    const r = await invokeRoute(remittancesRouter, "post", "/:id/reconcile", {
      user: ADMIN,
      params: { id: "r1" },
      body: { autoMatch: true },
    });
    expect(r.statusCode).toBe(400);
  });

  it("returns 401 reconciling without auth context", async () => {
    const r = await invokeRoute(remittancesRouter, "post", "/:id/reconcile", {
      user: NO_ORG,
      params: { id: "r1" },
      body: {},
    });
    expect(r.statusCode).toBe(401);
  });

  it("denies reconciliation for non-admins", async () => {
    const r = await invokeRoute(remittancesRouter, "post", "/:id/reconcile", {
      user: MEMBER,
      params: { id: "r1" },
      body: {},
    });
    expect(r.statusCode).toBe(403);
  });

  it("updates a remittance", async () => {
    enqueue([{ id: "r1" }]);
    const r = await invokeRoute(remittancesRouter, "put", "/:id", {
      user: ADMIN,
      params: { id: "r1" },
      body: { notes: "updated", referenceNumber: "REF2" },
    });
    expect(r.statusCode).toBe(200);
  });

  it("returns 404 updating a missing remittance", async () => {
    enqueue([]);
    const r = await invokeRoute(remittancesRouter, "put", "/:id", {
      user: ADMIN,
      params: { id: "x" },
      body: { notes: "x" },
    });
    expect(r.statusCode).toBe(404);
  });

  it("returns 401 updating without org context", async () => {
    const r = await invokeRoute(remittancesRouter, "put", "/:id", { user: NO_ORG, params: { id: "r1" }, body: {} });
    expect(r.statusCode).toBe(401);
  });

  it("denies update for non-admins", async () => {
    const r = await invokeRoute(remittancesRouter, "put", "/:id", { user: MEMBER, params: { id: "r1" }, body: {} });
    expect(r.statusCode).toBe(403);
  });

  it("returns 400 on update validation error", async () => {
    const r = await invokeRoute(remittancesRouter, "put", "/:id", {
      user: ADMIN,
      params: { id: "r1" },
      body: { notes: 123 },
    });
    expect(r.statusCode).toBe(400);
  });

  // ---- upload route (multer mocked as passthrough) ----
  it("uploads and parses a CSV file", async () => {
    h.parser.parseCSV.mockResolvedValue({ success: true, records: [], summary: {}, errors: [] });
    const r = await invokeRoute(remittancesRouter, "post", "/upload", {
      user: ADMIN,
      body: { config: '{"delimiter":","}' },
      file: { originalname: "remit.csv", buffer: Buffer.from("a,b"), size: 3 },
    });
    expect(r.statusCode).toBe(200);
    expect(h.parser.parseCSV).toHaveBeenCalled();
  });

  it("uploads and parses an Excel file", async () => {
    h.parser.parseExcel.mockResolvedValue({ success: true, records: [], summary: {}, errors: [] });
    const r = await invokeRoute(remittancesRouter, "post", "/upload", {
      user: ADMIN,
      body: {},
      file: { originalname: "remit.xlsx", buffer: Buffer.from("x"), size: 1 },
    });
    expect(r.statusCode).toBe(200);
    expect(h.parser.parseExcel).toHaveBeenCalled();
  });

  it("uploads and parses an XML file", async () => {
    h.parser.parseXML.mockResolvedValue({ success: true, records: [], summary: {}, errors: [] });
    const r = await invokeRoute(remittancesRouter, "post", "/upload", {
      user: ADMIN,
      body: {},
      file: { originalname: "remit.xml", buffer: Buffer.from("<x/>"), size: 4 },
    });
    expect(r.statusCode).toBe(200);
    expect(h.parser.parseXML).toHaveBeenCalled();
  });

  it("rejects an unsupported upload file type", async () => {
    const r = await invokeRoute(remittancesRouter, "post", "/upload", {
      user: ADMIN,
      body: {},
      file: { originalname: "remit.pdf", buffer: Buffer.from("x"), size: 1 },
    });
    expect(r.statusCode).toBe(400);
  });

  it("returns 400 when no file uploaded", async () => {
    const r = await invokeRoute(remittancesRouter, "post", "/upload", { user: ADMIN, body: {} });
    expect(r.statusCode).toBe(400);
  });

  it("returns 400 on invalid parser config JSON", async () => {
    const r = await invokeRoute(remittancesRouter, "post", "/upload", {
      user: ADMIN,
      body: { config: "{not-json" },
      file: { originalname: "remit.csv", buffer: Buffer.from("a"), size: 1 },
    });
    expect(r.statusCode).toBe(400);
  });

  it("denies upload for non-admins", async () => {
    const r = await invokeRoute(remittancesRouter, "post", "/upload", { user: MEMBER, body: {} });
    expect(r.statusCode).toBe(403);
  });

  it("exercises the multer file filter", () => {
    const cfg = h.multerConfig.value;
    expect(cfg).toBeTruthy();
    const accept = vi.fn();
    cfg.fileFilter({}, { mimetype: "text/csv" }, accept);
    expect(accept).toHaveBeenCalledWith(null, true);
    const reject = vi.fn();
    cfg.fileFilter({}, { mimetype: "application/pdf" }, reject);
    expect(reject.mock.calls[0][0]).toBeInstanceOf(Error);
  });

  // ---- second /:id/reconcile handler (ReconciliationEngine) via matchIndex ----
  it("auto-reconciles using the reconciliation engine", async () => {
    enqueue(
      [{ id: "r1", remittanceDate: "2025-02-01", remittancePeriodStart: "2025-01-01", remittancePeriodEnd: "2025-01-31" }],
      [{ id: "t1", memberId: "m1", amount: "50", periodStart: "2025-01-01", periodEnd: "2025-01-31" }],
      [],
      [],
    );
    h.engine.reconcile.mockResolvedValue({
      success: true,
      matches: [{ transactionId: "t1" }],
      variances: [],
      summary: { totalVariance: 0, matchedCount: 1 },
    });
    h.engine.generateReport.mockReturnValue("REPORT");
    const r = await invokeRoute(remittancesRouter, "post", "/:id/reconcile", {
      user: ADMIN,
      params: { id: "r1" },
      body: { records: [{ memberId: "m1", amount: 50 }] },
      matchIndex: 1,
    });
    expect(r.statusCode).toBe(200);
    expect(h.engine.reconcile).toHaveBeenCalled();
  });

  it("auto-reconciles without applying matches when autoApply is false", async () => {
    enqueue(
      [{ id: "r1", remittanceDate: "2025-02-01", remittancePeriodStart: "2025-01-01", remittancePeriodEnd: "2025-01-31" }],
      [{ id: "t1", memberId: "m1", amount: "50", periodStart: "2025-01-01", periodEnd: "2025-01-31" }],
    );
    h.engine.reconcile.mockResolvedValue({
      success: true,
      matches: [{ transactionId: "t1" }],
      variances: [{ id: "v1" }],
      summary: { totalVariance: 5, matchedCount: 1 },
    });
    h.engine.generateReport.mockReturnValue("REPORT");
    const r = await invokeRoute(remittancesRouter, "post", "/:id/reconcile", {
      user: ADMIN,
      params: { id: "r1" },
      body: { records: [{ memberId: "m1", amount: 50 }], autoApply: false },
      matchIndex: 1,
    });
    expect(r.statusCode).toBe(200);
  });

  it("returns 404 in engine reconcile when remittance is missing", async () => {
    enqueue([]);
    const r = await invokeRoute(remittancesRouter, "post", "/:id/reconcile", {
      user: ADMIN,
      params: { id: "x" },
      body: { records: [{}] },
      matchIndex: 1,
    });
    expect(r.statusCode).toBe(404);
  });

  it("returns 400 in engine reconcile when no records provided", async () => {
    enqueue([{ id: "r1", remittancePeriodStart: "2025-01-01", remittancePeriodEnd: "2025-01-31" }]);
    const r = await invokeRoute(remittancesRouter, "post", "/:id/reconcile", {
      user: ADMIN,
      params: { id: "r1" },
      body: { records: [] },
      matchIndex: 1,
    });
    expect(r.statusCode).toBe(400);
  });

  it("returns 401 in engine reconcile without org context", async () => {
    const r = await invokeRoute(remittancesRouter, "post", "/:id/reconcile", {
      user: NO_ORG,
      params: { id: "r1" },
      body: { records: [{}] },
      matchIndex: 1,
    });
    expect(r.statusCode).toBe(401);
  });

  it("denies engine reconcile for non-admins", async () => {
    const r = await invokeRoute(remittancesRouter, "post", "/:id/reconcile", {
      user: MEMBER,
      params: { id: "r1" },
      body: { records: [{}] },
      matchIndex: 1,
    });
    expect(r.statusCode).toBe(403);
  });

  // ---- report route ----
  it("generates a JSON report", async () => {
    enqueue([{ id: "r1", totalAmount: "100", varianceAmount: "0", memberCount: 5 }]);
    const r = await invokeRoute(remittancesRouter, "get", "/:id/report", {
      user: ADMIN,
      params: { id: "r1" },
      query: { format: "json" },
    });
    expect(r.statusCode).toBe(200);
  });

  it("generates a text report", async () => {
    enqueue([{ id: "r1", totalAmount: "100", varianceAmount: "0", memberCount: 5, status: "pending" }]);
    const r = await invokeRoute(remittancesRouter, "get", "/:id/report", {
      user: ADMIN,
      params: { id: "r1" },
      query: { format: "text" },
    });
    expect(r.statusCode).toBe(200);
    expect(r.headers["Content-Type"]).toBe("text/plain");
  });

  it("returns 404 when report remittance is missing", async () => {
    enqueue([]);
    const r = await invokeRoute(remittancesRouter, "get", "/:id/report", {
      user: ADMIN,
      params: { id: "x" },
      query: {},
    });
    expect(r.statusCode).toBe(404);
  });

  it("returns 401 generating a report without org context", async () => {
    const r = await invokeRoute(remittancesRouter, "get", "/:id/report", { user: NO_ORG, params: { id: "r1" }, query: {} });
    expect(r.statusCode).toBe(401);
  });
});
