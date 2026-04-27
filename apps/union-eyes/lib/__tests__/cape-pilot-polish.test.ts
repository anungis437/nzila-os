/**
 * Unit Tests — CAPE Pilot Polish
 *
 * Tests for the final CAPE workflow improvements:
 * 1. Draft recovery modal (ResumeDraftModal)
 * 2. Steward workload calculation (computeLoadLevel, StewardWorkloadList)
 * 3. Communication template rendering (EMPLOYER_TEMPLATES, getTemplateById)
 * 4. Pilot readiness checks (buildReadinessChecklist)
 */
import { describe, it, expect } from "vitest";

// ─── 1. Draft Recovery Modal ────────────────────────────────────────────────

import { ResumeDraftModal } from "@/components/grievances/resume-draft-modal";

describe("ResumeDraftModal", () => {
  it("exports a component function", () => {
    expect(typeof ResumeDraftModal).toBe("function");
  });

  it("accepts required props shape", () => {
    const props = {
      open: true,
      onResume: () => {},
      onDiscard: () => {},
    };
    // Type-level check — just ensure construction doesn't throw
    expect(props.open).toBe(true);
    expect(typeof props.onResume).toBe("function");
    expect(typeof props.onDiscard).toBe("function");
  });

  it("accepts optional draftSavedAt prop", () => {
    const props = {
      open: true,
      draftSavedAt: "3/6/2026, 10:00:00 AM",
      onResume: () => {},
      onDiscard: () => {},
    };
    expect(props.draftSavedAt).toContain("2026");
  });
});

// ─── 2. Steward Workload Calculation ────────────────────────────────────────

import {
  computeLoadLevel,
  type StewardSummary,
  type StewardWorkload,
} from "@/components/grievances/steward-load-card";

describe("computeLoadLevel", () => {
  it("returns 'light' for < 10 active cases", () => {
    expect(computeLoadLevel(0)).toBe("light");
    expect(computeLoadLevel(5)).toBe("light");
    expect(computeLoadLevel(9)).toBe("light");
  });

  it("returns 'moderate' for 10–19 active cases", () => {
    expect(computeLoadLevel(10)).toBe("moderate");
    expect(computeLoadLevel(15)).toBe("moderate");
    expect(computeLoadLevel(19)).toBe("moderate");
  });

  it("returns 'heavy' for >= 20 active cases", () => {
    expect(computeLoadLevel(20)).toBe("heavy");
    expect(computeLoadLevel(50)).toBe("heavy");
  });
});

describe("StewardSummary type", () => {
  it("supports the expected fields", () => {
    const summary: StewardSummary = {
      stewardId: "s-001",
      stewardName: "Jane Steward",
      activeCases: 12,
      overdueCases: 3,
    };
    expect(summary.stewardId).toBe("s-001");
    expect(summary.activeCases).toBe(12);
    expect(summary.overdueCases).toBe(3);
  });

  it("identifies overdue flag correctly", () => {
    const steward: StewardSummary = {
      stewardId: "s-002",
      stewardName: "Bob Delegate",
      activeCases: 8,
      overdueCases: 0,
    };
    expect(steward.overdueCases).toBe(0);
  });
});

describe("StewardWorkload type", () => {
  it("aggregates expected metrics", () => {
    const wl: StewardWorkload = {
      activeCases: 15,
      overdueCases: 2,
      avgDaysInState: 4.5,
      casesThisWeek: 3,
    };
    expect(wl.avgDaysInState).toBe(4.5);
    expect(wl.casesThisWeek).toBe(3);
  });
});

// ─── 3. Communication Template Rendering ────────────────────────────────────

import {
  EMPLOYER_TEMPLATES,
  getTemplateById,
  getTemplatesByCategory,
} from "@/lib/employers/communication-templates";

describe("EMPLOYER_TEMPLATES", () => {
  it("contains 5 templates", () => {
    expect(EMPLOYER_TEMPLATES).toHaveLength(5);
  });

  it("includes all required template types", () => {
    const ids = EMPLOYER_TEMPLATES.map((t) => t.id);
    expect(ids).toContain("tpl_grievance_notification");
    expect(ids).toContain("tpl_documentation_request");
    expect(ids).toContain("tpl_meeting_request");
    expect(ids).toContain("tpl_response_reminder");
    expect(ids).toContain("tpl_resolution_proposal");
  });

  it("every template has subject, body, and category", () => {
    for (const t of EMPLOYER_TEMPLATES) {
      expect(t.subject.length).toBeGreaterThan(0);
      expect(t.body.length).toBeGreaterThan(0);
      expect(t.category.length).toBeGreaterThan(0);
    }
  });

  it("templates contain {{variable}} placeholders", () => {
    const notification = EMPLOYER_TEMPLATES.find((t) => t.id === "tpl_grievance_notification")!;
    expect(notification.body).toContain("{{grievanceNumber}}");
    expect(notification.body).toContain("{{recipientName}}");
    expect(notification.body).toContain("{{grievantName}}");
    expect(notification.body).toContain("{{employerName}}");
  });

  it("each template declares its variables", () => {
    for (const t of EMPLOYER_TEMPLATES) {
      expect(Array.isArray(t.variables)).toBe(true);
      expect(t.variables!.length).toBeGreaterThan(0);
    }
  });
});

describe("getTemplateById", () => {
  it("returns the correct template", () => {
    const tmpl = getTemplateById("tpl_meeting_request");
    expect(tmpl).toBeDefined();
    expect(tmpl!.name).toBe("Meeting Request");
  });

  it("returns undefined for unknown id", () => {
    expect(getTemplateById("nonexistent")).toBeUndefined();
  });
});

describe("getTemplatesByCategory", () => {
  it("returns templates matching the category", () => {
    const results = getTemplatesByCategory("meeting_request");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((t) => t.category === "meeting_request")).toBe(true);
  });

  it("returns empty array for unmatched category", () => {
    expect(getTemplatesByCategory("general")).toHaveLength(0);
  });
});

// ─── 4. Pilot Readiness Checks ──────────────────────────────────────────────

import {
  buildReadinessChecklist,
  buildChecklistFromFlags,
  type PilotReadinessData,
} from "@/components/pilot/pilot-readiness-checklist";

describe("buildReadinessChecklist", () => {
  const FULL_DATA: PilotReadinessData = {
    users: 5,
    contracts: 2,
    employers: 3,
    grievances: 1,
    roles: 4,
    evidenceExport: true,
  };

  const EMPTY_DATA: PilotReadinessData = {
    users: 0,
    contracts: 0,
    employers: 0,
    grievances: 0,
    roles: 0,
    evidenceExport: false,
  };

  it("returns 6 checklist items", () => {
    const items = buildReadinessChecklist(FULL_DATA);
    expect(items).toHaveLength(6);
  });

  it("all items completed with full data", () => {
    const items = buildReadinessChecklist(FULL_DATA);
    expect(items.every((i) => i.completed)).toBe(true);
  });

  it("no items completed with empty data", () => {
    const items = buildReadinessChecklist(EMPTY_DATA);
    expect(items.every((i) => !i.completed)).toBe(true);
  });

  it("marks individual categories correctly", () => {
    const partial: PilotReadinessData = {
      users: 3,
      contracts: 0,
      employers: 1,
      grievances: 0,
      roles: 2,
      evidenceExport: false,
    };
    const items = buildReadinessChecklist(partial);
    const map = Object.fromEntries(items.map((i) => [i.id, i.completed]));

    expect(map.users).toBe(true);
    expect(map.contracts).toBe(false);
    expect(map.employers).toBe(true);
    expect(map.grievances).toBe(false);
    expect(map.roles).toBe(true);
    expect(map.evidence_export).toBe(false);
  });

  it("includes expected checklist item ids", () => {
    const items = buildReadinessChecklist(FULL_DATA);
    const ids = items.map((i) => i.id);
    expect(ids).toContain("users");
    expect(ids).toContain("contracts");
    expect(ids).toContain("employers");
    expect(ids).toContain("grievances");
    expect(ids).toContain("roles");
    expect(ids).toContain("evidence_export");
  });

  it("includes action hrefs for incomplete items", () => {
    const items = buildReadinessChecklist(EMPTY_DATA);
    for (const item of items) {
      expect(item.actionHref).toBeDefined();
      expect(item.actionHref!.startsWith("/")).toBe(true);
    }
  });

  it("maps pilot onboarding API flags to checklist completion", () => {
    const items = buildChecklistFromFlags({
      'org-seeded': true,
      'users-invited': true,
      'roles-assigned': false,
      'contracts-uploaded': true,
      'employers-imported': false,
      'integrations-configured': true,
      'export-verified': false,
    });

    const map = Object.fromEntries(items.map((i) => [i.id, i.completed]));
    expect(map.org_seeded).toBe(true);
    expect(map.users_invited).toBe(true);
    expect(map.roles_assigned).toBe(false);
    expect(map.contracts_uploaded).toBe(true);
    expect(map.employers_imported).toBe(false);
    expect(map.integrations_configured).toBe(true);
    expect(map.export_verified).toBe(false);
  });

  it("dynamically reflects counts in descriptions", () => {
    const data: PilotReadinessData = {
      users: 7,
      contracts: 1,
      employers: 0,
      grievances: 3,
      roles: 2,
      evidenceExport: true,
    };
    const items = buildReadinessChecklist(data);
    const usersItem = items.find((i) => i.id === "users")!;
    expect(usersItem.description).toContain("7");

    const contractsItem = items.find((i) => i.id === "contracts")!;
    expect(contractsItem.description).toContain("1 agreement");
  });
});
