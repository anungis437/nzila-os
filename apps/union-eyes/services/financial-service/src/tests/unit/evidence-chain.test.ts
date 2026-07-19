import { describe, it, expect, vi, beforeEach } from "vitest";

const dbMock = vi.hoisted(() => ({ execute: vi.fn() }));

vi.mock("../../db", () => ({ db: dbMock }));

import {
  verifyEvidenceChainLinks,
  verifyEmployerExecutionEvidenceChain,
} from "../../services/employer-execution/evidence-chain";
import type { EvidenceChainLink } from "../../services/employer-execution/types";

function makeLink(overrides: Partial<EvidenceChainLink> = {}): EvidenceChainLink {
  return {
    linkId: overrides.linkId ?? "link-1",
    organizationId: overrides.organizationId ?? "org-1",
    entityType: overrides.entityType ?? "payroll_run",
    targetEntityId: overrides.targetEntityId ?? "target-1",
    parentLinkId: overrides.parentLinkId ?? null,
    parentSealHash: overrides.parentSealHash ?? null,
    manifestHash: overrides.manifestHash ?? "mh-1",
    sealHash: overrides.sealHash ?? "sh-1",
    chainDepth: overrides.chainDepth ?? 1,
    createdAt: overrides.createdAt ?? "2025-01-01T00:00:00.000Z",
  };
}

beforeEach(() => {
  dbMock.execute.mockReset();
});

describe("verifyEvidenceChainLinks", () => {
  it("is invalid for an empty chain", () => {
    const result = verifyEvidenceChainLinks([]);
    expect(result).toEqual({ valid: false, checkedLinks: 0, issues: ["No chain links found"] });
  });

  it("validates a correct parent/child chain", () => {
    const root = makeLink({ linkId: "root", sealHash: "seal-root", chainDepth: 1 });
    const child = makeLink({
      linkId: "child",
      parentLinkId: "root",
      parentSealHash: "seal-root",
      chainDepth: 2,
    });
    const result = verifyEvidenceChainLinks([root, child]);
    expect(result.valid).toBe(true);
    expect(result.checkedLinks).toBe(2);
    expect(result.issues).toEqual([]);
  });

  it("detects a missing parent link", () => {
    const child = makeLink({ linkId: "child", parentLinkId: "ghost", chainDepth: 2 });
    const result = verifyEvidenceChainLinks([child]);
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe("child");
    expect(result.issues[0]).toMatch(/Missing parent link ghost/);
  });

  it("detects a parent seal hash mismatch and bad depth transition", () => {
    const root = makeLink({ linkId: "root", sealHash: "seal-root", chainDepth: 1 });
    const child = makeLink({
      linkId: "child",
      parentLinkId: "root",
      parentSealHash: "WRONG",
      chainDepth: 5,
    });
    const result = verifyEvidenceChainLinks([root, child]);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => /Parent seal hash mismatch/.test(i))).toBe(true);
    expect(result.issues.some((i) => /Invalid chain depth transition/.test(i))).toBe(true);
  });
});

describe("verifyEmployerExecutionEvidenceChain", () => {
  it("returns invalid when no matching evidence chain link is found", async () => {
    dbMock.execute.mockResolvedValue([]);
    const result = await verifyEmployerExecutionEvidenceChain("org-1", "payroll_run", "missing");
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe("missing");
    expect(result.issues[0]).toMatch(/No evidence chain link found for payroll_run:missing/);
  });

  it("walks and verifies a stored chain by parent links", async () => {
    const root = makeLink({
      linkId: "root",
      entityType: "payroll_run",
      targetEntityId: "t-root",
      sealHash: "seal-root",
      chainDepth: 1,
    });
    const target = makeLink({
      linkId: "child",
      entityType: "remittance_run",
      targetEntityId: "t-child",
      parentLinkId: "root",
      parentSealHash: "seal-root",
      chainDepth: 2,
    });
    dbMock.execute.mockResolvedValue([
      { manifest_json: { chainLink: root } },
      { manifest_json: { chainLink: target } },
    ]);
    const result = await verifyEmployerExecutionEvidenceChain("org-1", "remittance_run", "t-child");
    expect(result.valid).toBe(true);
    expect(result.checkedLinks).toBe(2);
  });

  it("ignores malformed/incomplete chain link records", async () => {
    dbMock.execute.mockResolvedValue([
      { manifest_json: { chainLink: { linkId: "bad" } } }, // missing required fields -> dropped
      { manifest_json: {} },
    ]);
    const result = await verifyEmployerExecutionEvidenceChain("org-1", "payroll_run", "t-1");
    expect(result.valid).toBe(false);
    expect(result.issues[0]).toMatch(/No evidence chain link found/);
  });
});
