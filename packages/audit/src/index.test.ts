import { describe, it, expect } from "vitest";
import * as audit from "./index.js";

describe("audit barrel exports", () => {
  it("exposes public runtime API", () => {
    expect(audit.AuditEngine).toBeTypeOf("function");
    expect(audit.InMemoryAuditStore).toBeTypeOf("function");
    expect(audit.verifyChain).toBeTypeOf("function");
    expect(audit.verifyOrgChain).toBeTypeOf("function");
    expect(audit.createRootHashSnapshot).toBeTypeOf("function");
    expect(audit.exportAuditLog).toBeTypeOf("function");
    expect(audit.GENESIS_HASH).toHaveLength(64);
  });
});
