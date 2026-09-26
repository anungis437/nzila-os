import { describe, expect, it } from "vitest";

import { getWorkspaceTab, WORKSPACE_TABS } from "../workspace-config";
import {
  canAccessDashboardPath,
  getAllowedPrefixesByExperience,
  getRoleLandingPath,
} from "@/lib/dashboard/role-experience";
import {
  R6_PERSONA_CLASSES,
  WORKSPACE_DEEP_WORK_COHERENCE_SCOPE,
  WORKSPACE_PERSONA_TAB_AVAILABILITY,
  availabilityFromCell,
  gateWorkspaceDeepWork,
  getWorkspaceTabAvailability,
  initialWorkspaceTab,
  resolveWorkspaceDeepWork,
  resolveWorkspacePersonaClass,
  selectWorkspaceRoleInput,
  type WorkspaceTabId,
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

describe("workspace deep-work path coherence", () => {
  it("keeps the EC-003 availability cells unchanged", () => {
    expect(WORKSPACE_PERSONA_TAB_AVAILABILITY.steward["case-operations"]).toBe("available");
    expect(WORKSPACE_PERSONA_TAB_AVAILABILITY).toEqual({
      executive: {
        overview: "available",
        "case-operations": "stub",
        members: "stub",
        governance: "available",
        continuity: "available",
        financial: "stub",
        documents: "stub",
      },
      steward: {
        overview: "available",
        "case-operations": "available",
        members: "available",
        governance: "stub",
        continuity: "available",
        financial: "stub",
        documents: "stub",
      },
      governance: {
        overview: "available",
        "case-operations": "stub",
        members: "stub",
        governance: "available",
        continuity: "available",
        financial: "stub",
        documents: "stub",
      },
      onboarding: {
        overview: "stub",
        "case-operations": "stub",
        members: "stub",
        governance: "stub",
        continuity: "stub",
        financial: "stub",
        documents: "stub",
      },
      procurement: {
        overview: "stub",
        "case-operations": "stub",
        members: "stub",
        governance: "stub",
        continuity: "stub",
        financial: "stub",
        documents: "stub",
      },
      "degraded-runtime": {
        overview: "stub",
        "case-operations": "stub",
        members: "stub",
        governance: "stub",
        continuity: "stub",
        financial: "stub",
        documents: "stub",
      },
    });
  });

  it("does not widen the staff allow-list to cases, claims, grievances, or priorities", () => {
    const staff = getAllowedPrefixesByExperience().staff;
    expect(staff).not.toContain("/dashboard/cases");
    expect(staff).not.toContain("/dashboard/claims");
    expect(staff).not.toContain("/dashboard/grievances");
    expect(staff).not.toContain("/dashboard/priorities");
    expect(canAccessDashboardPath("/dashboard/cases", "staff", false)).toBe(false);
    expect(canAccessDashboardPath("/dashboard/workbench", "staff", true)).toBe(true);
  });

  it("remaps steward case operations primary deep work onto the casework console", () => {
    expect(getWorkspaceTabAvailability("steward", "case-operations")).toBe("available");
    expect(getWorkspaceTabAvailability("chief_steward", "case-operations")).toBe("available");

    for (const role of ["steward", "chief_steward"]) {
      for (const pilot of [true, false]) {
        const cases = resolveWorkspaceDeepWork(role, "case-operations", "/dashboard/cases", pilot);
        expect(cases.kind).toBe("remapped");
        if (cases.kind !== "remapped") continue;
        expect(cases.href).toBe("/dashboard/workbench");
        expect(cases.labelFallback).toBe("Casework console");
        expect(cases.labelFallback.toLowerCase()).not.toBe("cases");
        expect(gateWorkspaceDeepWork(role, "case-operations", cases.href, pilot)).toEqual({
          allowed: true,
        });
        expect(gateWorkspaceDeepWork(role, "case-operations", "/dashboard/cases", pilot)).toEqual({
          allowed: false,
          reason: "out-of-role",
        });

        const priorities = resolveWorkspaceDeepWork(
          role,
          "case-operations",
          "/dashboard/priorities",
          pilot,
        );
        expect(priorities.kind).toBe("blocked");
        if (priorities.kind !== "blocked") continue;
        expect(priorities.recovery?.href).toBe("/dashboard/workbench");
        expect(priorities.recovery?.labelFallback).toBe("Casework console");

        expect(
          resolveWorkspaceDeepWork(role, "case-operations", "/dashboard/inbox?type=intake", pilot),
        ).toEqual({ kind: "reachable" });

        for (const href of ["/dashboard/claims", "/dashboard/grievances"]) {
          const blocked = resolveWorkspaceDeepWork(role, "case-operations", href, pilot);
          expect(blocked.kind).toBe("blocked");
          if (blocked.kind !== "blocked") continue;
          expect(blocked.reason).toBe("out-of-role");
          expect(blocked.recovery?.href).toBe("/dashboard/workbench");
          expect(blocked.recovery?.labelFallback).toBe("Casework console");
          expect(
            gateWorkspaceDeepWork(role, "case-operations", blocked.recovery!.href, pilot).allowed,
          ).toBe(true);
        }
      }
    }
  });

  it("gives every in-scope available tab a reachable, remapped, or recoverable deep work", () => {
    for (const scope of WORKSPACE_DEEP_WORK_COHERENCE_SCOPE) {
      const tab = getWorkspaceTab(scope.tabId);
      expect(tab).toBeDefined();
      expect(getWorkspaceTabAvailability(scope.role, scope.tabId)).toBe("available");

      for (const pilot of [true, false]) {
        const resolutions = tab!.deepWork.map((link) =>
          resolveWorkspaceDeepWork(scope.role, scope.tabId, link.href, pilot),
        );
        const allBlockedWithoutRecovery = resolutions.every(
          (resolution) => resolution.kind === "blocked" && !resolution.recovery,
        );
        expect(allBlockedWithoutRecovery).toBe(false);

        for (const resolution of resolutions) {
          if (resolution.kind === "remapped") {
            expect(resolution.labelFallback.length).toBeGreaterThan(0);
            expect(resolution.labelFallback.startsWith("/")).toBe(false);
            expect(resolution.reasonFallback.length).toBeGreaterThan(0);
            expect(
              gateWorkspaceDeepWork(scope.role, scope.tabId, resolution.href, pilot).allowed,
            ).toBe(true);
          }
          if (resolution.kind === "blocked" && resolution.recovery) {
            expect(resolution.recovery.labelFallback.startsWith("/")).toBe(false);
            expect(
              gateWorkspaceDeepWork(scope.role, scope.tabId, resolution.recovery.href, pilot)
                .allowed,
            ).toBe(true);
          }
        }
      }
    }
  });

  it("keeps executive continuity intelligence reachable and does not remap it", () => {
    expect(
      resolveWorkspaceDeepWork(
        "executive",
        "continuity",
        "/dashboard/continuity-intelligence",
        true,
      ),
    ).toEqual({ kind: "reachable" });
    expect(
      gateWorkspaceDeepWork(
        "executive",
        "continuity",
        "/dashboard/executive-operating-intelligence",
        true,
      ),
    ).toEqual({ allowed: false, reason: "out-of-role" });
  });

  it("does not add a recovery path on stub sections", () => {
    const financial = getWorkspaceTab("financial");
    for (const link of financial!.deepWork) {
      const resolution = resolveWorkspaceDeepWork("steward", "financial", link.href, true);
      expect(resolution).toEqual({ kind: "blocked", reason: "stub-section" });
    }
  });

  it("keeps steward case operations off page dead-ends and unrelated personas unchanged", () => {
    const staffPrefixes = [
      "/dashboard",
      "/dashboard/workspace",
      "/dashboard/workbench",
      "/dashboard/operations",
      "/dashboard/inbox",
      "/dashboard/intelligence",
      "/dashboard/members",
      "/dashboard/documents",
      "/dashboard/correspondence",
      "/dashboard/notifications",
      "/dashboard/settings",
      "/dashboard/profile",
    ];
    expect(getAllowedPrefixesByExperience().staff).toEqual(staffPrefixes);
    expect(getRoleLandingPath("steward")).toBe("/dashboard/workbench");
    expect(getRoleLandingPath("chief_steward")).toBe("/dashboard/workbench");

    const caseOps = getWorkspaceTab("case-operations")!;
    const deniedDoctrine = [
      "/dashboard/cases",
      "/dashboard/claims",
      "/dashboard/grievances",
      "/dashboard/priorities",
    ];
    for (const pilot of [true, false]) {
      for (const href of deniedDoctrine) {
        expect(gateWorkspaceDeepWork("steward", "case-operations", href, pilot)).toEqual({
          allowed: false,
          reason: "out-of-role",
        });
        expect(canAccessDashboardPath(href, "staff", pilot)).toBe(false);
      }

      for (const link of caseOps.deepWork) {
        const resolution = resolveWorkspaceDeepWork("steward", "case-operations", link.href, pilot);
        const launched =
          resolution.kind === "remapped"
            ? resolution.href
            : resolution.kind === "reachable"
              ? link.href.split("?")[0]
              : resolution.recovery?.href;
        expect(launched).toBeDefined();
        expect(launched).not.toBe("/dashboard/operations");
        expect(deniedDoctrine).not.toContain(launched);
        expect(canAccessDashboardPath(launched!, "staff", pilot)).toBe(true);
        expect(gateWorkspaceDeepWork("steward", "case-operations", launched!, pilot).allowed).toBe(
          true,
        );
      }

      const cases = resolveWorkspaceDeepWork("steward", "case-operations", "/dashboard/cases", pilot);
      expect(cases).toMatchObject({
        kind: "remapped",
        href: getRoleLandingPath("steward"),
        labelFallback: "Casework console",
      });
    }

    for (const role of ["executive", "governance", "onboarding", "procurement", "degraded-runtime", "member", null]) {
      for (const link of caseOps.deepWork) {
        const resolution = resolveWorkspaceDeepWork(role, "case-operations", link.href, true);
        expect(resolution.kind).toBe("blocked");
        if (resolution.kind !== "blocked") continue;
        expect(resolution.recovery).toBeUndefined();
        expect(resolution.kind === "blocked" && "href" in resolution).toBe(false);
      }
    }

    expect(getWorkspaceTabAvailability("executive", "case-operations")).toBe("stub");
    expect(resolveWorkspaceDeepWork("executive", "case-operations", "/dashboard/cases", false)).toEqual({
      kind: "blocked",
      reason: "stub-section",
    });
  });

  it("covers the named coherence tabs and no new workspace tab", () => {
    const tabIds = WORKSPACE_DEEP_WORK_COHERENCE_SCOPE.map((scope) => scope.tabId);
    expect(new Set(tabIds)).toEqual(
      new Set<WorkspaceTabId>(["case-operations", "members", "continuity", "governance"]),
    );
    expect(WORKSPACE_TABS.map((tab) => tab.id)).not.toContain("intelligence");
  });
});
