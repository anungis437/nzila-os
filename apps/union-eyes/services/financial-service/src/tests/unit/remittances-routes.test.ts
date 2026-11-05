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
      "for",
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
    // The handler reconciles inside one transaction; the transaction shares the same result queue.
    transaction: vi.fn(async (work: (tx: any) => Promise<unknown>) => work(db)),
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
  const multerConfig: { value: any } = { value: undefined };
  return { queue, db, schema, parser, multerConfig };
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
}));
vi.mock("../../db", () => ({ db: h.db, schema: h.schema }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import remittancesRouter from "../../routes/remittances";

const UUID = "11111111-1111-1111-1111-111111111111";
const UUID2 = "33333333-3333-3333-3333-333333333333";
// A strict (RFC 4122) UUID: the report only accepts recorded transaction references of this form.
const MATCHED_ID = "22222222-2222-4222-8222-222222222222";
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
  h.db.transaction.mockClear();
  h.parser.parseCSV.mockReset();
  h.parser.parseExcel.mockReset();
  h.parser.parseXML.mockReset();
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

  describe("reconcile", () => {
    const remittance = (over: Record<string, unknown> = {}) => ({
      id: "r1",
      totalAmount: "50",
      remittanceDate: "2025-02-01",
      remittancePeriodStart: "2025-01-01",
      remittancePeriodEnd: "2025-01-31",
      ...over,
    });
    const pending = (over: Record<string, unknown> = {}) => ({ id: "r1", reconciliationStatus: "pending", metadata: { carried: "yes" }, ...over });
    // The nth update chain started by the handler: 0 marks the dues transactions paid, 1 records the reconciliation on the remittance.
    const updateSet = (nth: number) => h.db.update.mock.results[nth].value.set.mock.calls[0][0];
    const reconcile = (body: unknown) =>
      invokeRoute(remittancesRouter, "post", "/:id/reconcile", { user: ADMIN, params: { id: "r1" }, body });

    it("reconciles by auto-match in one transaction: transactions paid, evidence recorded, existing metadata kept", async () => {
      enqueue([remittance()], [{ id: "t1", totalAmount: "50", memberId: "m1" }], [pending()], [{ id: "t1" }], [{ id: "r1", reconciliationStatus: "reconciled" }]);
      const r = await reconcile({ autoMatch: true });
      expect(r.statusCode).toBe(200);
      expect((r.body as any).data).toMatchObject({ status: "reconciled", matchedTransactions: 1, matchedAmount: 50, expectedAmount: 50, variance: 0 });
      expect(h.db.transaction).toHaveBeenCalledTimes(1);
      expect(h.db.update).toHaveBeenCalledTimes(2);
      expect(updateSet(0)).toMatchObject({ paidDate: "2025-02-01", status: "paid", notes: "Paid via remittance r1" });
      expect(updateSet(1)).toMatchObject({
        reconciliationStatus: "reconciled",
        varianceAmount: "0.00",
        reconciledBy: "u1",
        metadata: { carried: "yes", matchedTransactions: 1, matchedTransactionIds: ["t1"], matchedAmount: 50 },
      });
    });

    it("records a variance for an explicit transaction list that does not add up", async () => {
      enqueue([remittance({ totalAmount: "30" })], [{ id: UUID, totalAmount: "50", memberId: "m1" }], [pending({ metadata: null })], [{ id: UUID }], [{ id: "r1", reconciliationStatus: "variance_detected" }]);
      const r = await reconcile({ transactionIds: [UUID], autoMatch: false });
      expect(r.statusCode).toBe(200);
      expect((r.body as any).data).toMatchObject({ status: "variance_detected", variance: -20, matchedAmount: 50, expectedAmount: 30 });
      expect(updateSet(1)).toMatchObject({ reconciliationStatus: "variance_detected", varianceAmount: "-20.00", metadata: { matchedTransactionIds: [UUID] } });
    });

    it("compares exact cents, so 0.10 plus 0.20 matches 0.30", async () => {
      enqueue([remittance({ totalAmount: "0.30" })], [{ id: "t1", totalAmount: "0.10", memberId: "m1" }, { id: "t2", totalAmount: "0.20", memberId: "m2" }], [pending()], [{ id: "t1" }, { id: "t2" }], [{ id: "r1", reconciliationStatus: "reconciled" }]);
      const r = await reconcile({});
      expect((r.body as any).data).toMatchObject({ status: "reconciled", variance: 0, matchedAmount: 0.3 });
      expect(updateSet(1).varianceAmount).toBe("0.00");
    });

    it("refuses an explicit list in which any transaction is unavailable, and changes nothing", async () => {
      enqueue([remittance()], [{ id: UUID, totalAmount: "10.00", memberId: "m1" }]);
      const r = await reconcile({ transactionIds: [UUID, UUID2], autoMatch: false });
      expect(r.statusCode).toBe(409);
      expect((r.body as any).error).toBe("One or more transactions are unavailable for reconciliation");
      expect(h.db.transaction).not.toHaveBeenCalled();
      expect(h.db.update).not.toHaveBeenCalled();
    });

    it("refuses a duplicate transaction id as a validation error before reading anything", async () => {
      const r = await reconcile({ transactionIds: [UUID, UUID] });
      expect(r.statusCode).toBe(400);
      expect((r.body as any).error).toBe("Validation error");
      expect(h.db.select).not.toHaveBeenCalled();
    });

    it("refuses a batch over the limit", async () => {
      enqueue([remittance()], Array.from({ length: 501 }, (_, i) => ({ id: `t${i}`, totalAmount: "1.00", memberId: "m" })));
      const r = await reconcile({});
      expect(r.statusCode).toBe(413);
      expect(h.db.transaction).not.toHaveBeenCalled();
    });

    it("fails closed on a dues transaction without a total: a generic 500, nothing written", async () => {
      enqueue([remittance()], [{ id: "t1", memberId: "m1" }]);
      const r = await reconcile({});
      expect(r.statusCode).toBe(500);
      expect(r.body).toEqual({ success: false, error: "Internal server error" });
      expect(h.db.transaction).not.toHaveBeenCalled();
      expect(h.db.update).not.toHaveBeenCalled();
    });

    it("writes nothing when the remittance was reconciled by someone else after it was read", async () => {
      enqueue([remittance()], [{ id: "t1", totalAmount: "50", memberId: "m1" }], [pending({ reconciliationStatus: "reconciled" })]);
      const r = await reconcile({});
      expect(r.statusCode).toBe(500);
      expect(h.db.update).not.toHaveBeenCalled();
    });

    it("never records the reconciliation when a transaction changed underneath it (the transaction rolls back)", async () => {
      enqueue([remittance()], [{ id: "t1", totalAmount: "25", memberId: "m1" }, { id: "t2", totalAmount: "25", memberId: "m2" }], [pending()], [{ id: "t1" }]);
      const r = await reconcile({});
      expect(r.statusCode).toBe(500);
      expect(h.db.update).toHaveBeenCalledTimes(1);
    });

    it("returns 404 for a missing remittance", async () => {
      enqueue([]);
      const r = await invokeRoute(remittancesRouter, "post", "/:id/reconcile", {
        user: ADMIN,
        params: { id: "x" },
        body: { autoMatch: true },
      });
      expect(r.statusCode).toBe(404);
    });

    it("returns 400 when the remittance is already reconciled", async () => {
      enqueue([{ id: "r1", reconciliationStatus: "reconciled" }]);
      expect((await reconcile({ autoMatch: true })).statusCode).toBe(400);
    });

    it("returns 400 when no matching transactions are found", async () => {
      enqueue([remittance()], []);
      expect((await reconcile({ autoMatch: true })).statusCode).toBe(400);
    });

    it("returns 401 without auth context", async () => {
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
      expect(h.db.select).not.toHaveBeenCalled();
    });
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

  it("reports the transactions named by the recorded references of a reconciled remittance", async () => {
    enqueue(
      [{ id: "r1", totalAmount: "50", varianceAmount: "0.00", memberCount: 1, reconciliationStatus: "reconciled", metadata: { matchedTransactionIds: [MATCHED_ID] } }],
      [{ id: MATCHED_ID, memberId: "m1", amount: "50.00", status: "paid", paidDate: "2025-02-01" }],
    );
    const r = await invokeRoute(remittancesRouter, "get", "/:id/report", { user: ADMIN, params: { id: "r1" }, query: {} });
    expect(r.statusCode).toBe(200);
    expect((r.body as any).data.summary).toMatchObject({ matchedCount: 1, totalReconciled: 50 });
    expect((r.body as any).data.transactions).toEqual([{ id: MATCHED_ID, memberId: "m1", amount: "50.00", status: "paid", paidDate: "2025-02-01" }]);
  });

  it("refuses a report for a reconciled remittance that carries no transaction references, instead of reporting zero matches", async () => {
    enqueue([{ id: "r1", totalAmount: "50", reconciliationStatus: "reconciled", metadata: { matchedTransactions: 3 } }]);
    const r = await invokeRoute(remittancesRouter, "get", "/:id/report", { user: ADMIN, params: { id: "r1" }, query: {} });
    expect(r.statusCode).toBe(409);
    expect((r.body as any).error).toBe("Reconciliation evidence unavailable");
  });

  it("refuses a report when a recorded reference no longer resolves to a transaction of this organisation", async () => {
    enqueue(
      [{ id: "r1", totalAmount: "50", reconciliationStatus: "variance_detected", metadata: { matchedTransactionIds: [MATCHED_ID] } }],
      [],
    );
    const r = await invokeRoute(remittancesRouter, "get", "/:id/report", { user: ADMIN, params: { id: "r1" }, query: {} });
    expect(r.statusCode).toBe(409);
  });
});
