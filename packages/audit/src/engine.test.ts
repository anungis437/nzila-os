import { describe, it, expect } from "vitest";
import { AuditEngine } from "./engine.js";
import { InMemoryAuditStore } from "./store.js";
import { verifyChain } from "./verify.js";
import { GENESIS_HASH } from "./schema.js";

describe("AuditEngine", () => {
  it("records entries with chained hashes", async () => {
    const store = new InMemoryAuditStore();
    const engine = new AuditEngine(store);

    const e1 = await engine.record({
      actorId: "user1",
      tenantId: "t1",
      action: "create",
      resource: "claim",
      payload: { claimId: "c1" },
    });

    expect(e1.prevHash).toBe(GENESIS_HASH);
    expect(e1.hash).not.toBe(GENESIS_HASH);
    expect(e1.hash).toHaveLength(64); // SHA-256 hex

    const e2 = await engine.record({
      actorId: "user1",
      tenantId: "t1",
      action: "update",
      resource: "claim",
      payload: { claimId: "c1", status: "approved" },
    });

    expect(e2.prevHash).toBe(e1.hash);
    expect(e2.hash).not.toBe(e1.hash);
  });

  it("produces different hashes for different payloads", async () => {
    const store = new InMemoryAuditStore();
    const engine = new AuditEngine(store);

    const e1 = await engine.record({
      actorId: "u1",
      tenantId: "t1",
      action: "create",
      resource: "a",
      payload: { x: 1 },
    });
    const e2 = await engine.record({
      actorId: "u1",
      tenantId: "t1",
      action: "create",
      resource: "a",
      payload: { x: 2 },
    });

    expect(e1.hash).not.toBe(e2.hash);
  });
});

describe("verifyChain", () => {
  it("verifies a valid chain", async () => {
    const store = new InMemoryAuditStore();
    const engine = new AuditEngine(store);

    await engine.record({ actorId: "u", tenantId: "t", action: "a", resource: "r", payload: {} });
    await engine.record({ actorId: "u", tenantId: "t", action: "b", resource: "r", payload: {} });
    await engine.record({ actorId: "u", tenantId: "t", action: "c", resource: "r", payload: {} });

    const entries = store.getAll();
    const result = verifyChain(entries);
    expect(result.valid).toBe(true);
    expect(result.entriesChecked).toBe(3);
  });

  it("detects a tampered entry", async () => {
    const store = new InMemoryAuditStore();
    const engine = new AuditEngine(store);

    await engine.record({ actorId: "u", tenantId: "t", action: "a", resource: "r", payload: {} });
    const e2 = await engine.record({ actorId: "u", tenantId: "t", action: "b", resource: "r", payload: {} });

    const entries = store.getAll();
    // Tamper with the second entry's action (top-level hash field)
    const tampered = entries.map((e, i) =>
      i === 1 ? { ...e, action: "tampered" } : e,
    );

    const result = verifyChain(tampered);
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(e2.id);
  });
});
