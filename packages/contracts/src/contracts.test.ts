import { describe, it, expect } from "vitest";
import { validateDomainEvent, parseDomainEvent, safeParseDomainEvent } from "./validators.js";
import { createDefaultRegistry } from "./registry.js";

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
});
