import { describe, it, expect } from "vitest";
import { validateDomainEvent, parseDomainEvent, safeParseDomainEvent } from "./validators.js";
import {
  ContractRegistry,
  createDefaultRegistry,
  getContractRegistry,
  setContractRegistry,
  validateEventPayload,
} from "./registry.js";
import * as packageExports from "./index.js";

describe("validateDomainEvent", () => {
  it("validates a well-formed domain event", () => {
    const event = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      type: "claim.created",
      version: 1,
      timestamp: new Date().toISOString(),
      metadata: {
        orgId: "t1",
        actorId: "u1",
        source: "test",
      },
      payload: {
        claimId: "c1",
        claimantId: "u1",
        amount: 1000,
        currency: "USD",
      },
    };
    const result = validateDomainEvent(event);
    expect(result.valid).toBe(true);
  });

  it("rejects events without required fields", () => {
    const result = validateDomainEvent({ type: "test" });
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
  });
});

describe("parseDomainEvent", () => {
  it("parses valid events", () => {
    const event = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      type: "test.event",
      version: 1,
      timestamp: new Date().toISOString(),
      metadata: { orgId: "t1", actorId: "u1", source: "test" },
      payload: {},
    };
    const parsed = parseDomainEvent(event);
    expect(parsed.type).toBe("test.event");
  });

  it("throws for invalid events", () => {
    expect(() => parseDomainEvent({})).toThrow();
  });
});

describe("safeParseDomainEvent", () => {
  it("returns success for valid events", () => {
    const result = safeParseDomainEvent({
      id: "550e8400-e29b-41d4-a716-446655440000",
      type: "ev",
      version: 1,
      timestamp: new Date().toISOString(),
      metadata: { orgId: "t", actorId: "a", source: "test" },
      payload: {},
    });
    expect(result.success).toBe(true);
  });

  it("returns failure for invalid events", () => {
    const result = safeParseDomainEvent({ bad: true });
    expect(result.success).toBe(false);
  });
});

describe("ContractRegistry", () => {
  it("validates known event types", () => {
    const registry = createDefaultRegistry();
    const result = registry.validate("ClaimCreated", 1, {
      claimId: "550e8400-e29b-41d4-a716-446655440000",
      claimType: "insurance",
      claimantId: "u1",
      description: "test claim",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects invalid payloads for known types", () => {
    const registry = createDefaultRegistry();
    const result = registry.validate("ClaimCreated", 1, { bad: "data" });
    expect(result.valid).toBe(false);
  });

  it("returns an error for unknown contract version", () => {
    const registry = createDefaultRegistry();
    const result = registry.validate("ClaimCreated", 99, { any: "payload" });
    expect(result.valid).toBe(false);
    expect(result.errors?.[0]).toContain("No contract registered");
  });

  it("lists registered contracts", () => {
    const registry = createDefaultRegistry();
    const contracts = registry.listContracts();
    expect(contracts.length).toBeGreaterThan(0);
    expect(contracts.some((c) => c.eventType === "ClaimCreated" && c.version === 1)).toBe(true);
  });

  it("supports global registry lifecycle and helper validation", () => {
    const custom = new ContractRegistry();
    custom.register("CustomEvent", 1, {
      safeParse(value: unknown) {
        return value && typeof value === "object" && "ok" in (value as Record<string, unknown>)
          ? { success: true, data: value }
          : {
              success: false,
              error: {
                issues: [{ path: ["ok"], message: "Required" }],
              },
            };
      },
    } as unknown as Parameters<ContractRegistry["register"]>[2]);

    setContractRegistry(custom);
    const helperResult = validateEventPayload("CustomEvent" as never, 1, { ok: true });
    expect(helperResult.valid).toBe(true);

    const singleton = getContractRegistry();
    expect(singleton).toBe(custom);

    setContractRegistry(undefined as unknown as ContractRegistry);
    const recreated = getContractRegistry();
    expect(recreated).not.toBe(custom);
    expect(recreated.listContracts().length).toBeGreaterThan(0);
  });
});

describe("package barrel exports", () => {
  it("exports canonical, domain, registry, and validator APIs", () => {
    expect(packageExports.CANONICAL_SCHEMA_VERSION).toBeTruthy();
    expect(packageExports.EVENT_CONTRACTS).toBeDefined();
    expect(packageExports.ContractRegistry).toBeDefined();
    expect(packageExports.validateDomainEvent).toBeTypeOf("function");
    expect(packageExports.createDefaultRegistry).toBeTypeOf("function");
  });
});
