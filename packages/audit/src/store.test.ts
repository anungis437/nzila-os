import { describe, it, expect } from "vitest";
import { InMemoryAuditStore } from "./store.js";
import { AuditEngine } from "./engine.js";

describe("InMemoryAuditStore", () => {
  it("returns undefined for missing entry/last entry", async () => {
    const store = new InMemoryAuditStore();
    await expect(store.getEntry("missing")).resolves.toBeUndefined();
    await expect(store.getLastEntry("org-1")).resolves.toBeUndefined();
  });

  it("supports filtered pagination and counts by org", async () => {
    const store = new InMemoryAuditStore();
    const engine = new AuditEngine(store);

    const e1 = await engine.record({
      actorId: "u1",
      orgId: "org-1",
      action: "a1",
      resource: "r",
      payload: {},
    });
    const e1Ms = Date.parse(e1.timestamp);
    while (Date.now() <= e1Ms) {
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
    const e2 = await engine.record({
      actorId: "u1",
      orgId: "org-1",
      action: "a2",
      resource: "r",
      payload: {},
    });
    await engine.record({
      actorId: "u2",
      orgId: "org-2",
      action: "a3",
      resource: "r",
      payload: {},
    });

    await expect(store.getEntry(e1.id)).resolves.toMatchObject({ id: e1.id });
    await expect(store.getLastEntry("org-1")).resolves.toMatchObject({ id: e2.id });

    const fromFiltered = await store.getEntries("org-1", { fromDate: e2.timestamp });
    expect(fromFiltered).toHaveLength(1);
    expect(fromFiltered[0]?.id).toBe(e2.id);

    const toFiltered = await store.getEntries("org-1", { toDate: e1.timestamp });
    expect(toFiltered).toHaveLength(1);
    expect(toFiltered[0]?.id).toBe(e1.id);

    const paged = await store.getEntries("org-1", { offset: 1, limit: 1 });
    expect(paged).toHaveLength(1);
    expect(paged[0]?.id).toBe(e2.id);

    await expect(store.getEntryCount("org-1")).resolves.toBe(2);
    await expect(store.getEntryCount("org-2")).resolves.toBe(1);
  });
});
