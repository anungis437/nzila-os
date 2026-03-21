import { describe, it, expect } from "vitest";
import { exportAuditLog } from "./export.js";
import { AuditEngine } from "./engine.js";
import { InMemoryAuditStore } from "./store.js";

describe("exportAuditLog", () => {
  it("exports as JSON", async () => {
    const store = new InMemoryAuditStore();
    const engine = new AuditEngine(store);

    await engine.record({ actorId: "u1", orgId: "t1", action: "create", resource: "r", payload: { a: 1 } });
    await engine.record({ actorId: "u2", orgId: "t1", action: "delete", resource: "r", payload: { a: 2 } });

    const result = await exportAuditLog(store, { orgId: "t1", format: "json" });
    expect(result.entryCount).toBe(2);
    expect(result.format).toBe("json");
    const parsed = JSON.parse(result.data);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].actorId).toBe("u1");
  });

  it("exports as CSV with headers", async () => {
    const store = new InMemoryAuditStore();
    const engine = new AuditEngine(store);

    await engine.record({ actorId: "u1", orgId: "t1", action: "read", resource: "item", payload: {} });

    const result = await exportAuditLog(store, { orgId: "t1", format: "csv" });
    const lines = result.data.trim().split("\n");
    expect(lines).toHaveLength(2); // header + 1 row
    expect(lines[0]).toContain("id,timestamp,actorId,orgId,action,resource");
  });
});
