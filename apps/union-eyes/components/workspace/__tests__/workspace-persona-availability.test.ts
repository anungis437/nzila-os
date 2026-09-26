import { describe, expect, it } from "vitest";

import { WORKSPACE_TABS } from "../workspace-config";
import {
  R6_PERSONA_CLASSES,
  WORKSPACE_PERSONA_TAB_AVAILABILITY,
  availabilityFromCell,
  gateWorkspaceDeepWork,
  getWorkspaceTabAvailability,
  initialWorkspaceTab,
  resolveWorkspacePersonaClass,
  selectWorkspaceRoleInput,
} from "../workspace-persona-availability";

describe("workspace persona availability map", () => {
  it("covers exactly the six R6 classes and the seven canonical tabs", () => {
    expect([...R6_PERSONA_CLASSES]).toEqual([
      "executive",
      "steward",
      "governance",
      "onboarding",
      "procurement",
      "degraded-runtime",
    ]);
    expect(Object.keys(WORKSPACE_PERSONA_TAB_AVAILABILITY).sort()).toEqual(
      [...R6_PERSONA_CLASSES].sort(),
    );

    const tabIds = WORKSPACE_TABS.map((tab) => tab.id);
    expect(tabIds).toEqual([
      "overview",
      "case-operations",
      "members",
      "governance",
      "continuity",
      "financial",
      "documents",
    ]);
    expect(tabIds).not.toContain("intelligence");

    for (const persona of R6_PERSONA_CLASSES) {
      expect(Object.keys(WORKSPACE_PERSONA_TAB_AVAILABILITY[persona])).toEqual(tabIds);
      for (const tabId of tabIds) {
        expect(["available", "stub", "unavailable"]).toContain(
          WORKSPACE_PERSONA_TAB_AVAILABILITY[persona][tabId],
        );
      }
      const allAvailable = tabIds.every(
        (tabId) => WORKSPACE_PERSONA_TAB_AVAILABILITY[persona][tabId] === "available",
      );
      expect(allAvailable).toBe(false);
    }
  });

  it("encodes recon hypotheses as in-role and unknown cells as stub", () => {
    expect(getWorkspaceTabAvailability("executive", "overview")).toBe("available");
    expect(getWorkspaceTabAvailability("executive", "governance")).toBe("available");
    expect(getWorkspaceTabAvailability("executive", "continuity")).toBe("available");
    expect(getWorkspaceTabAvailability("executive", "financial")).toBe("stub");
    expect(getWorkspaceTabAvailability("executive", "case-operations")).toBe("stub");

    expect(getWorkspaceTabAvailability("steward", "case-operations")).toBe("available");
    expect(getWorkspaceTabAvailability("steward", "members")).toBe("available");
    expect(getWorkspaceTabAvailability("steward", "financial")).toBe("stub");
    expect(getWorkspaceTabAvailability("steward", "documents")).toBe("stub");

    expect(getWorkspaceTabAvailability("governance", "governance")).toBe("available");
    expect(getWorkspaceTabAvailability("governance", "members")).toBe("stub");

    for (const persona of ["onboarding", "procurement", "degraded-runtime"] as const) {
      for (const tab of WORKSPACE_TABS) {
        expect(getWorkspaceTabAvailability(persona, tab.id)).toBe("stub");
      }
    }
  });

  it("fail-closes unknown roles, blanks, and missing cells to stub", () => {
    for (const role of [null, undefined, "", "   ", "member", "admin", "app_owner", "not-a-role"]) {
      for (const tab of WORKSPACE_TABS) {
        expect(getWorkspaceTabAvailability(role, tab.id)).toBe("stub");
      }
      expect(resolveWorkspacePersonaClass(role)).toBeNull();
    }

    expect(availabilityFromCell(undefined)).toBe("stub");
    expect(availabilityFromCell("unknown")).toBe("stub");
    expect(availabilityFromCell("AVAILABLE")).toBe("stub");
    expect(availabilityFromCell("available")).toBe("available");
  });

  it("accepts seed role strings and the RBAC aliases getUserRole collapses to", () => {
    expect(resolveWorkspacePersonaClass("EXECUTIVE")).toBe("executive");
    expect(resolveWorkspacePersonaClass("degraded")).toBe("degraded-runtime");
    expect(resolveWorkspacePersonaClass("degraded_runtime")).toBe("degraded-runtime");
    expect(resolveWorkspacePersonaClass("chief_steward")).toBe("steward");
    expect(resolveWorkspacePersonaClass("president")).toBe("executive");
    expect(resolveWorkspacePersonaClass("officer")).toBe("governance");
    expect(getWorkspaceTabAvailability("president", "overview")).toBe("available");
    expect(getWorkspaceTabAvailability("officer", "governance")).toBe("available");
    expect(getWorkspaceTabAvailability("chief_steward", "case-operations")).toBe("available");
  });

  it("prefers the raw org role over a collapsed resolved role", () => {
    expect(
      selectWorkspaceRoleInput({ orgRole: "executive", resolvedRole: "president" }),
    ).toBe("executive");
    expect(selectWorkspaceRoleInput({ orgRole: "  ", resolvedRole: "steward" })).toBe("steward");
    expect(selectWorkspaceRoleInput({ orgRole: null, resolvedRole: null })).toBeNull();
    expect(selectWorkspaceRoleInput({})).toBeNull();
  });

  it("opens on the first in-role tab and otherwise stays on overview as a stub", () => {
    expect(initialWorkspaceTab("executive")).toBe("overview");
    expect(initialWorkspaceTab("procurement")).toBe("overview");
    expect(initialWorkspaceTab(null)).toBe("overview");
    expect(getWorkspaceTabAvailability(null, initialWorkspaceTab(null))).toBe("stub");
  });

  it("gates deep-work links through the existing path policy and never for unknown roles", () => {
    expect(
      gateWorkspaceDeepWork("steward", "case-operations", "/dashboard/inbox?type=intake", true),
    ).toEqual({ allowed: true });
    expect(
      gateWorkspaceDeepWork("steward", "case-operations", "/dashboard/cases", false),
    ).toEqual({ allowed: false, reason: "out-of-role" });
    expect(gateWorkspaceDeepWork("steward", "financial", "/dashboard/dues", false)).toEqual({
      allowed: false,
      reason: "stub-section",
    });
    expect(
      gateWorkspaceDeepWork("executive", "governance", "/dashboard/governance-center", false),
    ).toEqual({ allowed: true });
    expect(
      gateWorkspaceDeepWork(
        "executive",
        "continuity",
        "/dashboard/executive-operating-intelligence",
        true,
      ),
    ).toEqual({ allowed: false, reason: "out-of-role" });
    expect(
      gateWorkspaceDeepWork(
        "executive",
        "continuity",
        "/dashboard/executive-operating-intelligence",
        false,
      ),
    ).toEqual({ allowed: true });
    expect(gateWorkspaceDeepWork(null, "overview", "/dashboard/documents", false)).toEqual({
      allowed: false,
      reason: "unknown-role",
    });
    expect(gateWorkspaceDeepWork("member", "documents", "/dashboard/documents", false)).toEqual({
      allowed: false,
      reason: "unknown-role",
    });
    expect(gateWorkspaceDeepWork("onboarding", "overview", "/dashboard/documents", false)).toEqual({
      allowed: false,
      reason: "stub-section",
    });
  });
});
