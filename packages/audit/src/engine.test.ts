import { describe, it, expect } from "vitest";
import { AuditEngine, computeAuditHash } from "./engine.js";
import { InMemoryAuditStore } from "./store.js";
import { verifyChain, verifyOrgChain } from "./verify.js";
import { GENESIS_HASH } from "./schema.js";

describe("AuditEngine", () => {
  it("records entries with chained hashes", async () => {
    const store = new InMemoryAuditStore();
    const engine = new AuditEngine(store);

    const e1 = await engine.record({
      actorId: "user1",
      orgId: "t1",
      action: "create",
      resource: "claim",
      payload: { claimId: "c1" },
    });

    expect(e1.prevHash).toBe(GENESIS_HASH);
    expect(e1.hash).not.toBe(GENESIS_HASH);
    expect(e1.hash).toHaveLength(64); // SHA-256 hex

    const e2 = await engine.record({
      actorId: "user1",
      orgId: "t1",
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
      orgId: "t1",
      action: "create",
      resource: "a",
      payload: { x: 1 },
    });
    const e2 = await engine.record({
      actorId: "u1",
      orgId: "t1",
      action: "create",
      resource: "a",
      payload: { x: 2 },
    });

    expect(e1.hash).not.toBe(e2.hash);
  });
});

describe("verifyChain", () => {
  it("returns valid for empty chain", () => {
    const result = verifyChain([]);
    expect(result.valid).toBe(true);
    expect(result.entriesChecked).toBe(0);
  });

  it("verifies a valid chain", async () => {
    const store = new InMemoryAuditStore();
    const engine = new AuditEngine(store);

    await engine.record({ actorId: "u", orgId: "t", action: "a", resource: "r", payload: {} });
    await engine.record({ actorId: "u", orgId: "t", action: "b", resource: "r", payload: {} });
    await engine.record({ actorId: "u", orgId: "t", action: "c", resource: "r", payload: {} });

    const entries = store.getAll();
    const result = verifyChain(entries);
    expect(result.valid).toBe(true);
    expect(result.entriesChecked).toBe(3);
  });

  it("detects a tampered entry", async () => {
    const store = new InMemoryAuditStore();
    const engine = new AuditEngine(store);

    await engine.record({ actorId: "u", orgId: "t", action: "a", resource: "r", payload: {} });
    const e2 = await engine.record({ actorId: "u", orgId: "t", action: "b", resource: "r", payload: {} });

    const entries = store.getAll();
    // Tamper with the second entry's action (top-level hash field)
    const tampered = entries.map((e, i) =>
      i === 1 ? { ...e, action: "tampered" } : e,
    );

    const result = verifyChain(tampered);
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(e2.id);
  });

  it("detects invalid genesis linkage on first entry", async () => {
    const store = new InMemoryAuditStore();
    const engine = new AuditEngine(store);
    const first = await engine.record({
      actorId: "u",
      orgId: "t",
      action: "a",
      resource: "r",
      payload: {},
    });

    const tampered = [{ ...first, prevHash: "not-genesis" }];
    const result = verifyChain(tampered);

    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(first.id);
  });

  it("detects broken prevHash linkage between entries", async () => {
    const store = new InMemoryAuditStore();
    const engine = new AuditEngine(store);

    await engine.record({ actorId: "u", orgId: "t", action: "a", resource: "r", payload: {} });
    await engine.record({ actorId: "u", orgId: "t", action: "b", resource: "r", payload: {} });

    const entries = store.getAll();
    const tampered = entries.map((e, i) => {
      if (i !== 1) return e;

      const prevHash = "0".repeat(64);
      const payload = {
        id: e.id,
        timestamp: e.timestamp,
        actorId: e.actorId,
        orgId: e.orgId,
        action: e.action,
        resource: e.resource,
        resourceId: e.resourceId,
        payload: e.payload,
      };

      return {
        ...e,
        prevHash,
        hash: computeAuditHash(prevHash, payload),
      };
    });

    const result = verifyChain(tampered);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("prevHash does not match previous entry hash");
  });

  it("verifies an org chain through store lookup", async () => {
    const store = new InMemoryAuditStore();
    const engine = new AuditEngine(store);

    await engine.record({ actorId: "u", orgId: "org-1", action: "a", resource: "r", payload: {} });
    await engine.record({ actorId: "u", orgId: "org-1", action: "b", resource: "r", payload: {} });

    const result = await verifyOrgChain(store, "org-1");
    expect(result.valid).toBe(true);
    expect(result.entriesChecked).toBe(2);
  });
});
