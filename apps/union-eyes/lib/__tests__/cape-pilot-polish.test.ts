/**
 * Unit Tests — CAPE Pilot Polish
 *
 * Pilot readiness checks (buildReadinessChecklist, buildChecklistFromFlags). The draft-recovery modal, the steward workload card and the employer message
 * templates this file once covered were removed with the unmounted screens that used them (scripts/runtime/orphan-census.ts).
 */
import { describe, it, expect } from "vitest";

// ─── Pilot Readiness Checks ─────────────────────────────────────────────────

import {
  apiItemIdOf,
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

  it("names every step to the onboarding API by the id the API knows, which is not the id the checklist shows it under", async () => {
    const { CHECKLIST_ITEM_IDS } = await import("@/lib/pilot/onboarding-checklist-evidence");
    const shown = buildChecklistFromFlags({}).map((item) => item.id);
    expect(shown.map((id) => apiItemIdOf(id))).toEqual([...CHECKLIST_ITEM_IDS]);
    expect(apiItemIdOf("not_a_step")).toBeNull();
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
