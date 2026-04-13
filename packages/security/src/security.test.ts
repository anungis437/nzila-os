import { describe, it, expect, vi } from "vitest";
import { RateLimiter, InMemoryRateLimitStore, rateLimitKey } from "./rate-limit.js";
import { ServiceAuthVerifier, ServiceAuthError } from "./auth.js";
import { EnvSecretsProvider, CachedSecretsProvider, requireSecret } from "./secrets.js";
import { assertOrgOwnership, assertAllSameOrg, OrgIsolationError, withOrgScope } from "./isolation.js";
import { validateInput, strictValidate, UUIDSchema, OrgIdSchema, PaginationSchema, SortSchema } from "./validation.js";
import { z } from "zod";

// ── Rate Limiter ────────────────────────────────────────────

describe("RateLimiter", () => {
  it("allows requests within the limit", async () => {
    const store = new InMemoryRateLimitStore();
    const limiter = new RateLimiter(store, { maxRequests: 5, windowMs: 60_000 });

    const result = await limiter.check("org1", "/api/data");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("denies after exceeding the limit", async () => {
    const store = new InMemoryRateLimitStore();
    const limiter = new RateLimiter(store, { maxRequests: 3, windowMs: 60_000 });

    await limiter.check("t1", "/api");
    await limiter.check("t1", "/api");
    await limiter.check("t1", "/api");
    const result = await limiter.check("t1", "/api");

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("isolates orgs", async () => {
    const store = new InMemoryRateLimitStore();
    const limiter = new RateLimiter(store, { maxRequests: 2, windowMs: 60_000 });

    await limiter.check("t1", "/api");
    await limiter.check("t1", "/api");
    const r1 = await limiter.check("t1", "/api");
    const r2 = await limiter.check("t2", "/api");

    expect(r1.allowed).toBe(false);
    expect(r2.allowed).toBe(true);
  });

  it("resets a route bucket and rebuilds remaining capacity", async () => {
    const store = new InMemoryRateLimitStore();
    const limiter = new RateLimiter(store, { maxRequests: 2, windowMs: 60_000 });

    await limiter.check("t1", "/api");
    await limiter.check("t1", "/api");
    await limiter.reset("t1", "/api");

    const result = await limiter.check("t1", "/api");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
  });

  it("builds stable composite rate limit keys", () => {
    expect(rateLimitKey("tenant-1", "/api/orders")).toBe("rl:tenant-1:/api/orders");
  });
});

// ── Service Auth ────────────────────────────────────────────

describe("ServiceAuthVerifier", () => {
  const secret = "test-secret-key-12345";
  const serviceId = "svc-orders";

  it("signs and verifies round-trip", () => {
    const verifier = new ServiceAuthVerifier([{ serviceId, secret }]);
    const body = JSON.stringify({ orderId: "o1" });
    const headers = ServiceAuthVerifier.sign(serviceId, secret, body);

    const result = verifier.verify(headers, body);
    expect(result).toBe(serviceId);
  });

  it("rejects unknown service ID", () => {
    const verifier = new ServiceAuthVerifier([{ serviceId, secret }]);
    const headers = ServiceAuthVerifier.sign("unknown-svc", "other-secret", "body");

    expect(() => verifier.verify(headers, "body")).toThrow(ServiceAuthError);
  });

  it("rejects tampered body", () => {
    const verifier = new ServiceAuthVerifier([{ serviceId, secret }]);
    const body = "original";
    const headers = ServiceAuthVerifier.sign(serviceId, secret, body);

    expect(() => verifier.verify(headers, "tampered")).toThrow(ServiceAuthError);
  });

  it("rejects missing headers", () => {
    const verifier = new ServiceAuthVerifier([{ serviceId, secret }]);
    expect(() => verifier.verify({}, "body")).toThrow(ServiceAuthError);
  });

  it("rejects malformed signatures before timing-safe comparison", () => {
    const verifier = new ServiceAuthVerifier([{ serviceId, secret }]);
    const headers = ServiceAuthVerifier.sign(serviceId, secret, "body");

    expect(() =>
      verifier.verify({
        ...headers,
        "x-service-signature": "deadbeef",
      }, "body"),
    ).toThrow("Invalid signature");
  });

  it("rejects invalid timestamps", () => {
    const verifier = new ServiceAuthVerifier([{ serviceId, secret }]);
    const headers = ServiceAuthVerifier.sign(serviceId, secret, "body");

    expect(() =>
      verifier.verify({
        ...headers,
        "x-service-timestamp": "not-a-date",
      }, "body"),
    ).toThrow("Invalid timestamp");
  });

  it("rejects timestamps outside the allowed clock skew", () => {
    const verifier = new ServiceAuthVerifier([{ serviceId, secret }], { maxClockSkewMs: 1000 });
    const headers = ServiceAuthVerifier.sign(serviceId, secret, "body");

    expect(() =>
      verifier.verify({
        ...headers,
        "x-service-timestamp": "2000-01-01T00:00:00.000Z",
      }, "body"),
    ).toThrow("Timestamp outside allowed clock skew");
  });
});

// ── Secrets ─────────────────────────────────────────────────

describe("Secrets", () => {
  it("EnvSecretsProvider reads from process.env", async () => {
    process.env.TEST_SECRET_KEY = "s3cr3t";
    const provider = new EnvSecretsProvider();
    expect(await provider.get("TEST_SECRET_KEY")).toBe("s3cr3t");
    delete process.env.TEST_SECRET_KEY;
  });

  it("CachedSecretsProvider caches values", async () => {
    const inner = new EnvSecretsProvider();
    process.env.CACHED_KEY = "val";
    const cached = new CachedSecretsProvider(inner);

    await cached.get("CACHED_KEY");
    delete process.env.CACHED_KEY;
    // Still cached
    expect(await cached.get("CACHED_KEY")).toBe("val");

    cached.invalidate("CACHED_KEY");
    expect(await cached.get("CACHED_KEY")).toBeUndefined();
  });

  it("requireSecret throws on missing key", async () => {
    const provider = new EnvSecretsProvider();
    await expect(requireSecret(provider, "MISSING_KEY")).rejects.toThrow(
      'Required secret "MISSING_KEY" is not configured',
    );
  });

  it("EnvSecretsProvider.has checks key presence", async () => {
    process.env.TEST_SECRET_PRESENT = "yes";
    const provider = new EnvSecretsProvider();

    await expect(provider.has("TEST_SECRET_PRESENT")).resolves.toBe(true);
    delete process.env.TEST_SECRET_PRESENT;
    await expect(provider.has("TEST_SECRET_PRESENT")).resolves.toBe(false);
  });

  it("CachedSecretsProvider.has uses cache hits and invalidateAll clears them", async () => {
    const inner = {
      get: vi.fn(async (key: string) => (key === "KNOWN_SECRET" ? "value" : undefined)),
      has: vi.fn(async (key: string) => key === "KNOWN_SECRET"),
    };
    const cached = new CachedSecretsProvider(inner);

    await cached.get("KNOWN_SECRET");
    await cached.get("UNKNOWN_SECRET");

    await expect(cached.has("KNOWN_SECRET")).resolves.toBe(true);
    await expect(cached.has("UNKNOWN_SECRET")).resolves.toBe(false);
    expect(inner.has).not.toHaveBeenCalled();

    cached.invalidateAll();
    await expect(cached.has("KNOWN_SECRET")).resolves.toBe(true);
    expect(inner.has).toHaveBeenCalledWith("KNOWN_SECRET");
  });

  it("requireSecret returns a configured value", async () => {
    process.env.REQUIRED_SECRET_KEY = "configured";
    const provider = new EnvSecretsProvider();

    await expect(requireSecret(provider, "REQUIRED_SECRET_KEY")).resolves.toBe("configured");
    delete process.env.REQUIRED_SECRET_KEY;
  });
});

// ── Org Isolation ────────────────────────────────────────

describe("Org Isolation", () => {
  it("passes for matching org", () => {
    expect(() =>
      assertOrgOwnership({ orgId: "t1" }, { orgId: "t1" }),
    ).not.toThrow();
  });

  it("throws for mismatched org", () => {
    expect(() =>
      assertOrgOwnership({ orgId: "t2" }, { orgId: "t1" }),
    ).toThrow(OrgIsolationError);
  });

  it("assertAllSameOrg throws when any record crosses org boundaries", () => {
    expect(() =>
      assertAllSameOrg(
        [{ orgId: "t1" }, { orgId: "t2" }],
        { orgId: "t1" },
      ),
    ).toThrow(OrgIsolationError);
  });

  it("withOrgScope adds orgId to query", () => {
    const scoped = withOrgScope({ status: "active" }, { orgId: "t1" });
    expect(scoped.orgId).toBe("t1");
    expect(scoped.status).toBe("active");
  });
});

// ── Validation ──────────────────────────────────────────────

describe("Validation", () => {
  it("validates correct UUID", () => {
    const result = validateInput(UUIDSchema, "550e8400-e29b-41d4-a716-446655440000");
    expect(result.success).toBe(true);
  });

  it("rejects invalid UUID", () => {
    const result = validateInput(UUIDSchema, "not-a-uuid");
    expect(result.success).toBe(false);
    expect(result.errors!.length).toBeGreaterThan(0);
  });

  it("validates pagination with defaults", () => {
    const result = validateInput(PaginationSchema, {});
    expect(result.success).toBe(true);
    expect(result.data!.page).toBe(1);
    expect(result.data!.pageSize).toBe(20);
  });

  it("validates custom schema", () => {
    const schema = z.object({ name: z.string().min(1), age: z.number().positive() });
    const result = validateInput(schema, { name: "Alice", age: 30 });
    expect(result.success).toBe(true);
    expect(result.data!.name).toBe("Alice");
  });

  it("strictValidate parses valid input and throws on invalid input", () => {
    expect(strictValidate(OrgIdSchema, "org-1")).toBe("org-1");
    expect(() => strictValidate(OrgIdSchema, "")).toThrow();
  });

  it("applies sort defaults", () => {
    const result = validateInput(SortSchema, { sortBy: "createdAt" });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ sortBy: "createdAt", sortOrder: "asc" });
  });
});

describe("package index", () => {
  it("re-exports the public security API", async () => {
    const api = await import("./index.js");

    expect(api.RateLimiter).toBe(RateLimiter);
    expect(api.ServiceAuthVerifier).toBe(ServiceAuthVerifier);
    expect(api.EnvSecretsProvider).toBe(EnvSecretsProvider);
    expect(api.assertOrgOwnership).toBe(assertOrgOwnership);
    expect(api.strictValidate).toBe(strictValidate);
  });
});
