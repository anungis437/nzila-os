import { describe, it, expect } from "vitest";
import { RateLimiter, InMemoryRateLimitStore } from "./rate-limit.js";
import { ServiceAuthVerifier, ServiceAuthError } from "./auth.js";
import { EnvSecretsProvider, CachedSecretsProvider, requireSecret } from "./secrets.js";
import { assertTenantOwnership, TenantIsolationError, withTenantScope } from "./isolation.js";
import { validateInput, UUIDSchema, PaginationSchema } from "./validation.js";
import { z } from "zod";

// ── Rate Limiter ────────────────────────────────────────────

describe("RateLimiter", () => {
  it("allows requests within the limit", async () => {
    const store = new InMemoryRateLimitStore();
    const limiter = new RateLimiter(store, { maxRequests: 5, windowMs: 60_000 });

    const result = await limiter.check("tenant1", "/api/data");
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

  it("isolates tenants", async () => {
    const store = new InMemoryRateLimitStore();
    const limiter = new RateLimiter(store, { maxRequests: 2, windowMs: 60_000 });

    await limiter.check("t1", "/api");
    await limiter.check("t1", "/api");
    const r1 = await limiter.check("t1", "/api");
    const r2 = await limiter.check("t2", "/api");

    expect(r1.allowed).toBe(false);
    expect(r2.allowed).toBe(true);
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
});

// ── Tenant Isolation ────────────────────────────────────────

describe("Tenant Isolation", () => {
  it("passes for matching tenant", () => {
    expect(() =>
      assertTenantOwnership({ tenantId: "t1" }, { tenantId: "t1" }),
    ).not.toThrow();
  });

  it("throws for mismatched tenant", () => {
    expect(() =>
      assertTenantOwnership({ tenantId: "t2" }, { tenantId: "t1" }),
    ).toThrow(TenantIsolationError);
  });

  it("withTenantScope adds tenantId to query", () => {
    const scoped = withTenantScope({ status: "active" }, { tenantId: "t1" });
    expect(scoped.tenantId).toBe("t1");
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
});
