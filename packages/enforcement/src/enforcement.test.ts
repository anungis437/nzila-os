import { describe, it, expect, vi } from "vitest";
import { composePipeline } from "./pipeline.js";
import { traceLayer, authLayer, rateLimitLayer, governanceLayer, auditLayer } from "./layers.js";
import { createContext, createEnforcedHandler } from "./handler.js";
import type { EnforcementContext, EnforcementLayer, EnforcementResult } from "./pipeline.js";

function makeCtx(overrides: Partial<EnforcementContext> = {}): EnforcementContext {
  return createContext({
    action: "read",
    resourceType: "claim",
    route: "/api/claims",
    headers: {},
    ...overrides,
  });
}

describe("composePipeline", () => {
  it("executes layers in order", async () => {
    const order: number[] = [];
    const layers: EnforcementLayer[] = [
      async (_ctx, next) => { order.push(1); return next(); },
      async (_ctx, next) => { order.push(2); return next(); },
      async (_ctx, _next) => { order.push(3); return { success: true, status: 200, body: "ok" }; },
    ];

    const pipeline = composePipeline(layers);
    const result = await pipeline(makeCtx());

    expect(order).toEqual([1, 2, 3]);
    expect(result.status).toBe(200);
  });

  it("short-circuits on early return", async () => {
    const layers: EnforcementLayer[] = [
      async (_ctx, _next) => ({ success: false, status: 401, body: "denied" }),
      async (_ctx, _next) => ({ success: true, status: 200, body: "ok" }),
    ];

    const pipeline = composePipeline(layers);
    const result = await pipeline(makeCtx());

    expect(result.status).toBe(401);
  });
});

describe("traceLayer", () => {
  it("adds timing metadata", async () => {
    const ctx = makeCtx();
    const layer = traceLayer();
    const result = await layer(ctx, async () => ({
      success: true, status: 200,
    }));

    expect(result.status).toBe(200);
    expect(ctx.metadata.durationMs).toBeDefined();
  });
});

describe("authLayer", () => {
  it("rejects unauthenticated requests", async () => {
    const layer = authLayer({
      extractActor: async () => null,
    });
    const result = await layer(makeCtx(), async () => ({ success: true, status: 200 }));
    expect(result.status).toBe(401);
  });

  it("populates context on success", async () => {
    const ctx = makeCtx();
    const layer = authLayer({
      extractActor: async () => ({
        tenantId: "t1",
        actorId: "u1",
        roles: ["admin"],
      }),
    });
    await layer(ctx, async () => ({ success: true, status: 200 }));

    expect(ctx.tenantId).toBe("t1");
    expect(ctx.actorId).toBe("u1");
    expect(ctx.roles).toEqual(["admin"]);
  });
});

describe("rateLimitLayer", () => {
  it("returns 429 when rate limited", async () => {
    const layer = rateLimitLayer({
      check: async () => ({ allowed: false, remaining: 0, resetAt: Date.now() + 60000 }),
    });
    const ctx = makeCtx();
    ctx.tenantId = "t1";
    const result = await layer(ctx, async () => ({ success: true, status: 200 }));
    expect(result.status).toBe(429);
  });
});

describe("governanceLayer", () => {
  it("returns 403 on deny", async () => {
    const layer = governanceLayer({
      evaluate: async () => ({ outcome: "deny", reason: "Policy violation" }),
    });
    const result = await layer(makeCtx(), async () => ({ success: true, status: 200 }));
    expect(result.status).toBe(403);
  });

  it("passes through on allow", async () => {
    const layer = governanceLayer({
      evaluate: async () => ({ outcome: "allow", reason: "ok" }),
    });
    const result = await layer(makeCtx(), async () => ({ success: true, status: 200 }));
    expect(result.status).toBe(200);
  });
});

describe("auditLayer", () => {
  it("records audit after handler completes", async () => {
    const recorded = vi.fn();
    const layer = auditLayer({ record: recorded });
    const ctx = makeCtx();
    ctx.actorId = "u1";
    ctx.tenantId = "t1";

    await layer(ctx, async () => ({ success: true, status: 200 }));

    expect(recorded).toHaveBeenCalledTimes(1);
    expect(recorded.mock.calls[0]![0].actorId).toBe("u1");
    expect(recorded.mock.calls[0]![0].status).toBe(200);
  });
});

describe("createEnforcedHandler", () => {
  it("wires layers + handler into a single function", async () => {
    const handler = createEnforcedHandler(
      [traceLayer()],
      async (_ctx) => ({ success: true, status: 200, body: { data: "ok" } }),
    );

    const result = await handler(makeCtx());
    expect(result.success).toBe(true);
    expect(result.body).toEqual({ data: "ok" });
  });
});
