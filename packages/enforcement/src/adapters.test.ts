import { describe, it, expect, vi } from "vitest";
import { withEnforcement, healthHandler } from "./nextjs.js";
import { enforcementPlugin } from "./fastify.js";
import { traceLayer } from "./layers.js";
import type { EnforcementLayer, EnforcementContext, EnforcementResult } from "./pipeline.js";

// ── Next.js adapter tests ───────────────────────────────────

describe("withEnforcement (Next.js)", () => {
  it("wraps a handler and returns a Response", async () => {
    const handler = withEnforcement(
      {
        action: "create",
        resourceType: "claim",
        route: "/api/claims",
        layers: [traceLayer()],
      },
      async (ctx) => ({
        success: true,
        status: 201,
        body: { id: "c1", orgId: ctx.orgId },
      }),
    );

    const request = new Request("http://localhost/api/claims", {
      method: "POST",
      body: JSON.stringify({ title: "test" }),
    });
    const response = await handler(request);

    expect(response.status).toBe(201);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(response.headers.get("X-Trace-Id")).toBeTruthy();
    const json = await response.json();
    expect(json.id).toBe("c1");
  });

  it("short-circuits on auth failure", async () => {
    const denyAuth: EnforcementLayer = async (_ctx, _next) => ({
      success: false,
      status: 401,
      body: { error: "Unauthorized" },
    });

    const handler = withEnforcement(
      {
        action: "create",
        resourceType: "claim",
        route: "/api/claims",
        layers: [denyAuth],
      },
      async () => ({ success: true, status: 200, body: "should not reach" }),
    );

    const request = new Request("http://localhost/api/claims", { method: "POST" });
    const response = await handler(request);

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("extracts resourceId from URL", async () => {
    let capturedId: string | undefined;
    const handler = withEnforcement(
      {
        action: "read",
        resourceType: "claim",
        route: "/api/claims/:id",
        extractResourceId: (url) => url.pathname.split("/").pop(),
        layers: [],
      },
      async (ctx) => {
        capturedId = ctx.resourceId;
        return { success: true, status: 200, body: {} };
      },
    );

    const request = new Request("http://localhost/api/claims/abc-123", { method: "GET" });
    await handler(request);

    expect(capturedId).toBe("abc-123");
  });

  it("handles GET requests without body parsing", async () => {
    const handler = withEnforcement(
      { action: "read", resourceType: "item", route: "/api/items", layers: [] },
      async (ctx) => {
        expect(ctx.body).toBeUndefined();
        return { success: true, status: 200, body: [] };
      },
    );

    const request = new Request("http://localhost/api/items", { method: "GET" });
    const response = await handler(request);
    expect(response.status).toBe(200);
  });
});

describe("healthHandler", () => {
  it("returns OK with timestamp", async () => {
    const handler = healthHandler({ version: "1.0" });
    const response = await handler();
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.status).toBe("ok");
    expect(json.version).toBe("1.0");
    expect(json.timestamp).toBeTruthy();
  });
});

// ── Fastify adapter tests ───────────────────────────────────

describe("enforcementPlugin (Fastify)", () => {
  it("adds a preHandler hook", () => {
    const addHook = vi.fn();
    const done = vi.fn();

    enforcementPlugin(
      { addHook },
      { layers: [traceLayer()], resourceType: "workflow" },
      done,
    );

    expect(addHook).toHaveBeenCalledWith("preHandler", expect.any(Function));
    expect(done).toHaveBeenCalled();
  });

  it("passes enforcement for valid requests", async () => {
    let hookFn: (request: unknown, reply: unknown) => Promise<void> = async () => {};
    const addHook = vi.fn((_, fn) => { hookFn = fn; });
    const done = vi.fn();

    enforcementPlugin(
      { addHook },
      { layers: [traceLayer()], resourceType: "workflow" },
      done,
    );

    const request = {
      method: "GET",
      url: "/api/workflows",
      headers: {},
      body: undefined,
    };
    const reply = {
      code: vi.fn(() => ({ send: vi.fn() })),
      header: vi.fn(),
    };

    await hookFn(request, reply);

    expect(reply.header).toHaveBeenCalledWith("X-Trace-Id", expect.any(String));
    expect(reply.code).not.toHaveBeenCalled();
  });

  it("blocks requests on enforcement failure", async () => {
    let hookFn: (request: unknown, reply: unknown) => Promise<void> = async () => {};
    const addHook = vi.fn((_, fn) => { hookFn = fn; });
    const done = vi.fn();

    const denyAll: EnforcementLayer = async (_ctx, _next) => ({
      success: false,
      status: 403,
      body: { error: "No access" },
    });

    enforcementPlugin(
      { addHook },
      { layers: [denyAll], resourceType: "workflow" },
      done,
    );

    const sendFn = vi.fn();
    const request = {
      method: "POST",
      url: "/api/commands",
      headers: {},
      body: { cmd: "run" },
    };
    const reply = {
      code: vi.fn(() => ({ send: sendFn })),
      header: vi.fn(),
    };

    await hookFn(request, reply);

    expect(reply.code).toHaveBeenCalledWith(403);
    expect(sendFn).toHaveBeenCalledWith({ error: "No access" });
  });

  it("skips excluded paths", async () => {
    let hookFn: (request: unknown, reply: unknown) => Promise<void> = async () => {};
    const addHook = vi.fn((_, fn) => { hookFn = fn; });
    const done = vi.fn();

    const denyAll: EnforcementLayer = async () => ({
      success: false,
      status: 403,
      body: { error: "denied" },
    });

    enforcementPlugin(
      { addHook },
      { layers: [denyAll], resourceType: "workflow", exclude: ["/health"] },
      done,
    );

    const reply = {
      code: vi.fn(() => ({ send: vi.fn() })),
      header: vi.fn(),
    };

    await hookFn({ method: "GET", url: "/health", headers: {} }, reply);

    // Should NOT have been blocked
    expect(reply.code).not.toHaveBeenCalled();
  });

  it("attaches enforcement context to request", async () => {
    let hookFn: (request: unknown, reply: unknown) => Promise<void> = async () => {};
    const addHook = vi.fn((_, fn) => { hookFn = fn; });
    const done = vi.fn();

    enforcementPlugin(
      { addHook },
      { layers: [traceLayer()], resourceType: "workflow" },
      done,
    );

    const request: Record<string, unknown> = {
      method: "POST",
      url: "/api/commands",
      headers: {},
      body: null,
    };
    const reply = {
      code: vi.fn(() => ({ send: vi.fn() })),
      header: vi.fn(),
    };

    await hookFn(request, reply);

    expect(request.enforcementContext).toBeDefined();
    const ctx = request.enforcementContext as { route: string; action: string };
    expect(ctx.route).toBe("/api/commands");
    expect(ctx.action).toBe("create");
  });
});
