import { describe, it, expect } from "vitest";
import { AuditEngine } from "./engine.js";
import { InMemoryAuditStore } from "./store.js";
import { createRootHashSnapshot, InMemorySnapshotStore } from "./snapshot.js";

describe("snapshots", () => {
  it("creates and persists a root hash snapshot", async () => {
    const auditStore = new InMemoryAuditStore();
    const snapshotStore = new InMemorySnapshotStore();
    const engine = new AuditEngine(auditStore);

    const first = await engine.record({ actorId: "u", orgId: "org-1", action: "a", resource: "r", payload: {} });
    const last = await engine.record({ actorId: "u", orgId: "org-1", action: "b", resource: "r", payload: {} });

    const snapshot = await createRootHashSnapshot(auditStore, snapshotStore, "org-1");

    expect(snapshot.orgId).toBe("org-1");
    expect(snapshot.entryCount).toBe(2);
    expect(snapshot.firstEntryId).toBe(first.id);
    expect(snapshot.lastEntryId).toBe(last.id);
    expect(snapshot.rootHash).toBe(last.hash);

    const sameDay = snapshot.timestamp.slice(0, 10);
    await expect(snapshotStore.getSnapshot("org-1", sameDay)).resolves.toMatchObject({ id: snapshot.id });
    await expect(snapshotStore.getSnapshots("org-1")).resolves.toHaveLength(1);
    await expect(snapshotStore.getSnapshots("org-2")).resolves.toEqual([]);
  });

  it("throws when creating snapshot with no entries", async () => {
    const auditStore = new InMemoryAuditStore();
    const snapshotStore = new InMemorySnapshotStore();

    await expect(createRootHashSnapshot(auditStore, snapshotStore, "org-1")).rejects.toThrow(
      "No audit entries for org org-1",
    );
  });
});
