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
      "groupBy",
      "set",
      "values",
      "returning",
      "innerJoin",
      "leftJoin",
      "onConflictDoUpdate",
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
    delete: vi.fn(() => makeChain()),
  };
  function makeTable(name: string) {
    return new Proxy(
      { __name: name },
      { get: (o: any, col: string) => (col in o ? o[col] : { __col: col }) },
    );
  }
  const schema: any = new Proxy(
    {},
    {
      get: (_t, table: string) => {
        if (table === "__esModule") return true;
        return makeTable(table);
      },
      has: () => true,
    },
  );
  return { queue, db, schema, makeTable };
});

vi.mock("../../db", () => ({ db: h.db, schema: h.schema }));
vi.mock("../../db/index", () => ({ db: h.db, schema: h.schema }));
vi.mock("../../db/schema", () => ({ duesRules: h.makeTable("duesRules") }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import assignmentsRouter from "../../routes/dues-assignments";
import rulesRouter from "../../routes/dues-rules";
import rulesCompleteRouter from "../../routes/dues-rules-complete";
import rulesBackupRouter from "../../routes/dues-rules-backup";

const UUID = "11111111-1111-1111-1111-111111111111";
const ADMIN = { organizationId: "org-1", userId: "u1", id: "u1", role: "admin" };
const MEMBER = { organizationId: "org-1", userId: "u1", id: "u1", role: "member" };

function enqueue(...results: any[]) {
  h.queue.push(...results);
}

beforeEach(() => {
  h.queue.length = 0;
  h.db.select.mockClear();
  h.db.insert.mockClear();
  h.db.update.mockClear();
});

describe("dues-assignments routes", () => {
  it("lists assignments with filters", async () => {
    enqueue([{ assignment: { id: "a1" }, rule: { id: "r1" } }]);
    const r = await invokeRoute(assignmentsRouter, "get", "/", {
      user: ADMIN,
      query: { memberId: UUID, active: "true" },
    });
    expect(r.statusCode).toBe(200);
  });

  it("returns 500 when listing assignments throws", async () => {
    enqueue(new Error("db"));
    const r = await invokeRoute(assignmentsRouter, "get", "/", { user: ADMIN, query: {} });
    expect(r.statusCode).toBe(500);
  });

  it("fetches an assignment by id", async () => {
    enqueue([{ assignment: { id: "a1" }, rule: null }]);
    const r = await invokeRoute(assignmentsRouter, "get", "/:id", { user: ADMIN, params: { id: "a1" } });
    expect(r.statusCode).toBe(200);
  });

  it("returns 404 for a missing assignment", async () => {
    enqueue([]);
    const r = await invokeRoute(assignmentsRouter, "get", "/:id", { user: ADMIN, params: { id: "x" } });
    expect(r.statusCode).toBe(404);
  });

  it("creates an assignment", async () => {
    enqueue([{ id: "r1" }], [{ id: "a1" }]);
    const r = await invokeRoute(assignmentsRouter, "post", "/", {
      user: ADMIN,
      body: { memberId: UUID, ruleId: UUID, effectiveDate: "2025-01-01" },
    });
    expect(r.statusCode).toBe(201);
  });

  it("returns 404 when assignment rule does not exist", async () => {
    enqueue([]);
    const r = await invokeRoute(assignmentsRouter, "post", "/", {
      user: ADMIN,
      body: { memberId: UUID, ruleId: UUID, effectiveDate: "2025-01-01" },
    });
    expect(r.statusCode).toBe(404);
  });

  it("denies assignment creation for non-admins", async () => {
    const r = await invokeRoute(assignmentsRouter, "post", "/", { user: MEMBER, body: {} });
    expect(r.statusCode).toBe(403);
  });

  it("returns 400 on assignment validation error", async () => {
    const r = await invokeRoute(assignmentsRouter, "post", "/", { user: ADMIN, body: { memberId: "x" } });
    expect(r.statusCode).toBe(400);
  });

  it("updates an assignment", async () => {
    enqueue([{ id: "a1" }]);
    const r = await invokeRoute(assignmentsRouter, "put", "/:id", {
      user: ADMIN,
      params: { id: "a1" },
      body: { effectiveDate: "2025-02-01", endDate: "2025-03-01", overrideAmount: 12 },
    });
    expect(r.statusCode).toBe(200);
  });

  it("returns 404 when updating a missing assignment", async () => {
    enqueue([]);
    const r = await invokeRoute(assignmentsRouter, "put", "/:id", {
      user: ADMIN,
      params: { id: "x" },
      body: {},
    });
    expect(r.statusCode).toBe(404);
  });

  it("denies assignment update for non-admins", async () => {
    const r = await invokeRoute(assignmentsRouter, "put", "/:id", { user: MEMBER, params: { id: "a1" }, body: {} });
    expect(r.statusCode).toBe(403);
  });

  it("returns 400 on assignment update validation error", async () => {
    const r = await invokeRoute(assignmentsRouter, "put", "/:id", {
      user: ADMIN,
      params: { id: "a1" },
      body: { memberId: "not-a-uuid" },
    });
    expect(r.statusCode).toBe(400);
  });

  it("ends an assignment", async () => {
    enqueue([{ id: "a1" }]);
    const r = await invokeRoute(assignmentsRouter, "delete", "/:id", { user: ADMIN, params: { id: "a1" } });
    expect(r.statusCode).toBe(200);
  });

  it("returns 404 when ending a missing assignment", async () => {
    enqueue([]);
    const r = await invokeRoute(assignmentsRouter, "delete", "/:id", { user: ADMIN, params: { id: "x" } });
    expect(r.statusCode).toBe(404);
  });

  it("denies assignment deletion for non-admins", async () => {
    const r = await invokeRoute(assignmentsRouter, "delete", "/:id", { user: MEMBER, params: { id: "a1" } });
    expect(r.statusCode).toBe(403);
  });
});

// Shared suite for the three dues-rules variants (same surface area)
function rulesSuite(name: string, router: any, opts: { hasOrgCheck?: boolean } = {}) {
  describe(`${name} routes`, () => {
    it("lists rules", async () => {
      enqueue([{ id: "r1" }]);
      const r = await invokeRoute(router, "get", "/", { user: ADMIN, query: { active: "true" } });
      expect(r.statusCode).toBe(200);
    });

    it("returns 500 when listing rules throws", async () => {
      enqueue(new Error("db"));
      const r = await invokeRoute(router, "get", "/", { user: ADMIN, query: {} });
      expect(r.statusCode).toBe(500);
    });

    it("fetches a rule by id", async () => {
      enqueue([{ id: "r1" }]);
      const r = await invokeRoute(router, "get", "/:id", { user: ADMIN, params: { id: "r1" } });
      expect(r.statusCode).toBe(200);
    });

    it("returns 404 for a missing rule", async () => {
      enqueue([]);
      const r = await invokeRoute(router, "get", "/:id", { user: ADMIN, params: { id: "x" } });
      expect(r.statusCode).toBe(404);
    });

    it("creates a rule", async () => {
      enqueue([{ id: "r1" }]);
      const r = await invokeRoute(router, "post", "/", {
        user: ADMIN,
        body: {
          ruleName: "Standard",
          ruleCode: "STD",
          calculationType: "flat_rate",
          billingFrequency: "monthly",
          flatAmount: 25,
          effectiveDate: "2025-01-01",
          effectiveFrom: "2025-01-01",
          effectiveTo: "2025-12-31",
        },
      });
      expect(r.statusCode).toBe(201);
    });

    it("denies rule creation for non-admins", async () => {
      const r = await invokeRoute(router, "post", "/", { user: MEMBER, body: {} });
      expect(r.statusCode).toBe(403);
    });

    it("returns 400 on rule creation validation error", async () => {
      const r = await invokeRoute(router, "post", "/", { user: ADMIN, body: { ruleName: "" } });
      expect(r.statusCode).toBe(400);
    });

    it("updates a rule", async () => {
      enqueue([{ id: "r1" }]);
      const r = await invokeRoute(router, "put", "/:id", {
        user: ADMIN,
        params: { id: "r1" },
        body: { ruleName: "Updated", percentageRate: 2.5 },
      });
      expect(r.statusCode).toBe(200);
    });

    it("returns 404 when updating a missing rule", async () => {
      enqueue([]);
      const r = await invokeRoute(router, "put", "/:id", { user: ADMIN, params: { id: "x" }, body: {} });
      expect(r.statusCode).toBe(404);
    });

    it("denies rule update for non-admins", async () => {
      const r = await invokeRoute(router, "put", "/:id", { user: MEMBER, params: { id: "r1" }, body: {} });
      expect(r.statusCode).toBe(403);
    });

    it("returns 400 on rule update validation error", async () => {
      const r = await invokeRoute(router, "put", "/:id", {
        user: ADMIN,
        params: { id: "r1" },
        body: { calculationType: "bogus" },
      });
      expect(r.statusCode).toBe(400);
    });

    it("deletes a rule", async () => {
      enqueue([{ id: "r1" }]);
      const r = await invokeRoute(router, "delete", "/:id", { user: ADMIN, params: { id: "r1" } });
      expect(r.statusCode).toBe(200);
    });

    it("returns 404 when deleting a missing rule", async () => {
      enqueue([]);
      const r = await invokeRoute(router, "delete", "/:id", { user: ADMIN, params: { id: "x" } });
      expect(r.statusCode).toBe(404);
    });

    it("denies rule deletion for non-admins", async () => {
      const r = await invokeRoute(router, "delete", "/:id", { user: MEMBER, params: { id: "r1" } });
      expect(r.statusCode).toBe(403);
    });

    it("duplicates a rule", async () => {
      enqueue([{ id: "r1", ruleName: "Original", ruleCode: "ORIG" }], [{ id: "r2" }]);
      const r = await invokeRoute(router, "post", "/:id/duplicate", {
        user: ADMIN,
        params: { id: "r1" },
        body: { newCode: "NEW", newName: "New Rule", newRuleCode: "NEW", newRuleName: "New Rule" },
      });
      expect(r.statusCode).toBe(201);
    });

    it("returns 404 when duplicating a missing rule", async () => {
      enqueue([]);
      const r = await invokeRoute(router, "post", "/:id/duplicate", {
        user: ADMIN,
        params: { id: "x" },
        body: { newCode: "NEW", newName: "New Rule", newRuleCode: "NEW", newRuleName: "New Rule" },
      });
      expect(r.statusCode).toBe(404);
    });

    it("denies rule duplication for non-admins", async () => {
      const r = await invokeRoute(router, "post", "/:id/duplicate", {
        user: MEMBER,
        params: { id: "r1" },
        body: {},
      });
      expect(r.statusCode).toBe(403);
    });

    if (opts.hasOrgCheck) {
      it("returns 401 when organization context is missing", async () => {
        const r = await invokeRoute(router, "get", "/", { user: { role: "admin" }, query: {} });
        expect(r.statusCode).toBe(401);
      });
    }
  });
}

rulesSuite("dues-rules", rulesRouter);
rulesSuite("dues-rules-complete", rulesCompleteRouter, { hasOrgCheck: true });
rulesSuite("dues-rules-backup", rulesBackupRouter);
