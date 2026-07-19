import { describe, expect, it } from "vitest";

import {
  DEFAULT_WORKSPACE_TAB,
  WORKSPACE_CLIENT_TELEMETRY_EVENTS,
  WORKSPACE_DERIVED_TELEMETRY_EVENTS,
  WORKSPACE_TABS,
  WORKSPACE_TELEMETRY_EVENTS,
  WORKSPACE_TELEMETRY_PAYLOAD_KEYS,
  getWorkspaceTab,
  isAllowedTelemetryRoute,
} from "../workspace-config";

/**
 * Guards the Club360-style workspace contract.
 * Doctrine: docs/workspace/UNION_EYES_WORKSPACE_DOCTRINE.md
 */
describe("workspace-config", () => {
  it("defines exactly seven canonical tabs in the documented order", () => {
    expect(WORKSPACE_TABS.map((t) => t.id)).toEqual([
      "overview",
      "case-operations",
      "members",
      "governance",
      "continuity",
      "financial",
      "documents",
    ]);
  });

  it("does not expose Intelligence as a top-level tab in v1", () => {
    expect(WORKSPACE_TABS.some((t) => t.id === ("intelligence" as string))).toBe(false);
    expect(
      WORKSPACE_TABS.some((t) => /intelligence/i.test(t.label)),
    ).toBe(false);
  });

  it("keeps OCI/OCRA under Continuity, not as a top-level tab", () => {
    expect(WORKSPACE_TABS.some((t) => /^oci$|^ocra$/i.test(t.id))).toBe(false);
    const continuity = getWorkspaceTab("continuity");
    expect(continuity).toBeDefined();
    const hrefs = continuity!.deepWork.map((l) => l.href);
    expect(hrefs).toContain("/organizational-continuity-risk");
    expect(hrefs).toContain("/institutional-continuity-risk");
  });

  it("makes Continuity own officer transition, knowledge transfer, and institutional memory (not just assessments)", () => {
    const continuity = getWorkspaceTab("continuity");
    const hrefs = continuity!.deepWork.map((l) => l.href);
    expect(hrefs).toContain("/dashboard/leadership"); // officer transitions / leadership continuity
    expect(hrefs).toContain("/dashboard/knowledge-transfer");
    expect(hrefs).toContain("/dashboard/institutional-memory");
  });

  it("enforces the Overview invariant: Overview owns no deep workflow not owned by another tab", () => {
    const overview = getWorkspaceTab("overview");
    expect(overview).toBeDefined();

    // Every route owned by any NON-overview tab.
    const ownedElsewhere = new Set(
      WORKSPACE_TABS.filter((t) => t.id !== "overview").flatMap((t) =>
        t.deepWork.map((l) => l.href.split("?")[0]),
      ),
    );

    for (const link of overview!.deepWork) {
      expect(ownedElsewhere.has(link.href.split("?")[0])).toBe(true);
    }
  });

  it("gives every tab the universal contract (Current State, Required Actions, Deep Work)", () => {
    for (const tab of WORKSPACE_TABS) {
      expect(tab.question.length).toBeGreaterThan(0);
      expect(tab.currentState.length).toBeGreaterThan(0);
      expect(tab.requiredActions.emptyState.length).toBeGreaterThan(0);
      expect(tab.deepWork.length).toBeGreaterThan(0);
      // Honest empty states only — never a fabricated number.
      for (const signal of tab.currentState) {
        expect(signal.emptyState.length).toBeGreaterThan(0);
        expect(/^\d+$/.test(signal.emptyState.trim())).toBe(false);
      }
    }
  });

  it("stores deep-work hrefs without a locale prefix", () => {
    for (const tab of WORKSPACE_TABS) {
      for (const link of tab.deepWork) {
        expect(link.href.startsWith("/")).toBe(true);
        // Locale is prefixed at render time, never baked into config.
        expect(link.href.startsWith("/en")).toBe(false);
        expect(link.href.startsWith("/fr")).toBe(false);
      }
    }
  });

  it("defaults to the overview tab", () => {
    expect(DEFAULT_WORKSPACE_TAB).toBe("overview");
    expect(getWorkspaceTab(DEFAULT_WORKSPACE_TAB)).toBeDefined();
  });

  it("allow-lists only the privacy-safe telemetry events and payload keys", () => {
    expect([...WORKSPACE_TELEMETRY_EVENTS]).toEqual([
      "workspace.view",
      "tab.view",
      "deep_work.clicked",
      "legacy_page.visited",
      "absorbed_by_workspace",
    ]);
    expect([...WORKSPACE_TELEMETRY_PAYLOAD_KEYS]).toEqual([
      "workspace",
      "tab",
      "route",
      "timestamp",
    ]);
  });

  it("keeps absorbed_by_workspace derived-only (never client-emittable)", () => {
    expect([...WORKSPACE_CLIENT_TELEMETRY_EVENTS]).toEqual([
      "workspace.view",
      "tab.view",
      "deep_work.clicked",
      "legacy_page.visited",
    ]);
    expect([...WORKSPACE_DERIVED_TELEMETRY_EVENTS]).toEqual(["absorbed_by_workspace"]);
    expect(WORKSPACE_CLIENT_TELEMETRY_EVENTS).not.toContain("absorbed_by_workspace");
  });

  it("accepts known static telemetry routes and rejects dynamic / identifier-bearing ones", () => {
    // Known static routes from the config are allowed.
    expect(isAllowedTelemetryRoute("/dashboard/cases")).toBe(true);
    expect(isAllowedTelemetryRoute("/organizational-continuity-risk")).toBe(true);
    // Query strings are tolerated (stripped to the known base route).
    expect(isAllowedTelemetryRoute("/dashboard/inbox?type=intake")).toBe(true);

    // Dynamic / identifier-bearing routes are rejected.
    expect(isAllowedTelemetryRoute("/dashboard/cases/123")).toBe(false);
    expect(
      isAllowedTelemetryRoute(
        "/dashboard/cases/2f1c8a9e-1b2c-4d5e-8f90-abc123def456",
      ),
    ).toBe(false);
    expect(isAllowedTelemetryRoute("/dashboard/members/deadbeefdeadbeef")).toBe(false);
    // Unknown static routes are also rejected (allow-list, not deny-list).
    expect(isAllowedTelemetryRoute("/dashboard/secret-area")).toBe(false);
    expect(isAllowedTelemetryRoute("not-a-route")).toBe(false);
  });
});
