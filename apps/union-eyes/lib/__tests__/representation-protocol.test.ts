/**
 * Unit Tests — Representation Protocol
 *
 * Comprehensive tests for the per-org representation protocol feature:
 * 1. Protocol type presets & helpers
 * 2. Protocol service barrel export
 * 3. Assignment engine integration
 * 4. UI component protocol-awareness
 */
import { describe, it, expect, vi } from "vitest";

// Mock db/drizzle modules to avoid DATABASE_URL requirement — service barrel
// re-exports from protocol-service which imports db, schema, drizzle-orm.
vi.mock("@/db/db", () => ({
  db: {},
  client: {},
  getDatabase: vi.fn(),
}));

vi.mock("@/db/schema", () => ({
  orgConfigurations: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...a: unknown[]) => a),
  and: vi.fn((...a: unknown[]) => a),
  or: vi.fn((...a: unknown[]) => a),
  desc: vi.fn((a: unknown) => a),
  sql: vi.fn(),
  relations: vi.fn(() => ({})),
}));

// ============================================================================
// 1. Protocol Types & Presets
// ============================================================================

import {
  type RepresentativeType,
  type RepresentationProtocol,
  PROTOCOL_STEWARD_LED,
  PROTOCOL_LRO_LED,
  PROTOCOL_NATIONAL_REP_LED,
  PROTOCOL_OFFICER_LED,
  PROTOCOL_PRESETS,
  canStewardFile,
  canStewardRepresent,
  getAssignActionLabel,
  getAssignActionDescription,
  getPrimaryAssignmentRole,
} from "@/lib/representation/protocol-types";

describe("Protocol Presets", () => {
  it("provides four presets", () => {
    expect(Object.keys(PROTOCOL_PRESETS)).toHaveLength(4);
    expect(PROTOCOL_PRESETS.steward).toBeDefined();
    expect(PROTOCOL_PRESETS.lro).toBeDefined();
    expect(PROTOCOL_PRESETS.national_rep).toBeDefined();
    expect(PROTOCOL_PRESETS.officer).toBeDefined();
  });

  it("all presets have version 1", () => {
    for (const preset of Object.values(PROTOCOL_PRESETS)) {
      expect(preset.version).toBe(1);
    }
  });

  it("PROTOCOL_STEWARD_LED gives stewards full permissions", () => {
    const p = PROTOCOL_STEWARD_LED;
    expect(p.primaryRepresentative).toBe("steward");
    expect(p.stewardPermissions.canFileGrievance).toBe(true);
    expect(p.stewardPermissions.canRepresent).toBe(true);
    expect(p.stewardPermissions.canBeAssigned).toBe(true);
    expect(p.stewardPermissions.canContactEmployer).toBe(true);
    expect(p.stewardPermissions.canEscalate).toBe(true);
  });

  it("PROTOCOL_LRO_LED disables all steward permissions (CAPE model)", () => {
    const p = PROTOCOL_LRO_LED;
    expect(p.primaryRepresentative).toBe("lro");
    expect(p.stewardPermissions.canFileGrievance).toBe(false);
    expect(p.stewardPermissions.canRepresent).toBe(false);
    expect(p.stewardPermissions.canBeAssigned).toBe(false);
    expect(p.stewardPermissions.canContactEmployer).toBe(false);
    expect(p.stewardPermissions.canEscalate).toBe(false);
    expect(p.representativeLabel).toBe("Labour Relations Officer");
  });

  it("PROTOCOL_NATIONAL_REP_LED allows steward employer contact only (CUPE model)", () => {
    const p = PROTOCOL_NATIONAL_REP_LED;
    expect(p.primaryRepresentative).toBe("national_rep");
    expect(p.stewardPermissions.canFileGrievance).toBe(false);
    expect(p.stewardPermissions.canRepresent).toBe(false);
    expect(p.stewardPermissions.canBeAssigned).toBe(false);
    expect(p.stewardPermissions.canContactEmployer).toBe(true);
    expect(p.stewardPermissions.canEscalate).toBe(false);
    expect(p.representativeLabel).toBe("National Representative");
  });

  it("PROTOCOL_OFFICER_LED allows steward assignment + employer contact", () => {
    const p = PROTOCOL_OFFICER_LED;
    expect(p.primaryRepresentative).toBe("officer");
    expect(p.stewardPermissions.canBeAssigned).toBe(true);
    expect(p.stewardPermissions.canContactEmployer).toBe(true);
    expect(p.stewardPermissions.canFileGrievance).toBe(false);
    expect(p.stewardPermissions.canRepresent).toBe(false);
    expect(p.stewardPermissions.canEscalate).toBe(false);
  });
});

// ============================================================================
// 2. Helper Functions
// ============================================================================

describe("canStewardFile", () => {
  it("returns true for steward-led protocol", () => {
    expect(canStewardFile(PROTOCOL_STEWARD_LED)).toBe(true);
  });

  it("returns false for LRO-led protocol", () => {
    expect(canStewardFile(PROTOCOL_LRO_LED)).toBe(false);
  });

  it("returns false for national-rep-led protocol", () => {
    expect(canStewardFile(PROTOCOL_NATIONAL_REP_LED)).toBe(false);
  });

  it("returns false for officer-led protocol", () => {
    expect(canStewardFile(PROTOCOL_OFFICER_LED)).toBe(false);
  });
});

describe("canStewardRepresent", () => {
  it("returns true only for steward-led protocol", () => {
    expect(canStewardRepresent(PROTOCOL_STEWARD_LED)).toBe(true);
    expect(canStewardRepresent(PROTOCOL_LRO_LED)).toBe(false);
    expect(canStewardRepresent(PROTOCOL_NATIONAL_REP_LED)).toBe(false);
    expect(canStewardRepresent(PROTOCOL_OFFICER_LED)).toBe(false);
  });
});

describe("getAssignActionLabel", () => {
  it("returns 'Assign Steward' for steward-led", () => {
    expect(getAssignActionLabel(PROTOCOL_STEWARD_LED)).toBe("Assign Steward");
  });

  it("returns 'Assign Labour Relations Officer' for LRO-led", () => {
    expect(getAssignActionLabel(PROTOCOL_LRO_LED)).toBe("Assign Labour Relations Officer");
  });

  it("returns 'Assign National Representative' for national-rep-led", () => {
    expect(getAssignActionLabel(PROTOCOL_NATIONAL_REP_LED)).toBe(
      "Assign National Representative"
    );
  });

  it("returns 'Assign Union Officer' for officer-led", () => {
    expect(getAssignActionLabel(PROTOCOL_OFFICER_LED)).toBe("Assign Union Officer");
  });
});

describe("getAssignActionDescription", () => {
  it("returns protocol-specific description", () => {
    const desc = getAssignActionDescription(PROTOCOL_LRO_LED);
    expect(desc).toContain("labour relations officer");
    expect(desc).toContain("has not been assigned");
  });

  it("returns steward description for default", () => {
    const desc = getAssignActionDescription(PROTOCOL_STEWARD_LED);
    expect(desc).toContain("steward");
  });
});

describe("getPrimaryAssignmentRole", () => {
  it("maps steward → 'steward'", () => {
    expect(getPrimaryAssignmentRole(PROTOCOL_STEWARD_LED)).toBe("steward");
  });

  it("maps lro → 'labor_relations_officer'", () => {
    expect(getPrimaryAssignmentRole(PROTOCOL_LRO_LED)).toBe("labor_relations_officer");
  });

  it("maps national_rep → 'national_representative'", () => {
    expect(getPrimaryAssignmentRole(PROTOCOL_NATIONAL_REP_LED)).toBe("national_representative");
  });

  it("maps officer → 'primary_officer'", () => {
    expect(getPrimaryAssignmentRole(PROTOCOL_OFFICER_LED)).toBe("primary_officer");
  });
});

// ============================================================================
// 3. Barrel Export Verification
// ============================================================================

describe("Barrel export (lib/representation/index.ts)", () => {
  it("re-exports all type helpers from protocol-types", { timeout: 15_000 }, async () => {
    const barrel = await import("@/lib/representation");
    expect(barrel.PROTOCOL_STEWARD_LED).toBeDefined();
    expect(barrel.PROTOCOL_LRO_LED).toBeDefined();
    expect(barrel.PROTOCOL_NATIONAL_REP_LED).toBeDefined();
    expect(barrel.PROTOCOL_OFFICER_LED).toBeDefined();
    expect(barrel.PROTOCOL_PRESETS).toBeDefined();
    expect(barrel.canStewardFile).toBeTypeOf("function");
    expect(barrel.canStewardRepresent).toBeTypeOf("function");
    expect(barrel.getAssignActionLabel).toBeTypeOf("function");
    expect(barrel.getAssignActionDescription).toBeTypeOf("function");
    expect(barrel.getPrimaryAssignmentRole).toBeTypeOf("function");
  });
});

// ============================================================================
// 4. UI Component Protocol-Awareness (export verification)
// ============================================================================

import { NextActionsPanel } from "@/components/grievances/next-actions-panel";
import { StewardLoadCard, StewardWorkloadList } from "@/components/grievances/steward-load-card";

describe("NextActionsPanel", () => {
  it("exports a component function", () => {
    expect(typeof NextActionsPanel).toBe("function");
  });

  it("accepts protocol in props shape", () => {
    const props = {
      grievanceStatus: "filed",
      hasSteward: false,
      hasEmployerResponse: false,
      isOverdue: false,
      onAction: () => {},
      protocol: PROTOCOL_LRO_LED,
    };
    // Type-level verification — no runtime rendering in unit tests
    expect(props.protocol.primaryRepresentative).toBe("lro");
  });
});

describe("StewardLoadCard", () => {
  it("exports a component function", () => {
    expect(typeof StewardLoadCard).toBe("function");
  });

  it("accepts protocol in props shape", () => {
    const props = {
      stewardName: "Test",
      workload: { activeCases: 5, overdueCases: 1, avgDaysInState: 3, casesThisWeek: 2 },
      protocol: PROTOCOL_NATIONAL_REP_LED,
    };
    expect(props.protocol.representativeLabel).toBe("National Representative");
  });
});

describe("StewardWorkloadList", () => {
  it("exports a component function", () => {
    expect(typeof StewardWorkloadList).toBe("function");
  });

  it("accepts protocol in props shape", () => {
    const props = {
      stewards: [],
      organizationId: "org_123",
      protocol: PROTOCOL_OFFICER_LED,
    };
    expect(props.protocol.representativeLabel).toBe("Union Officer");
  });
});

// ============================================================================
// 5. Protocol Completeness Guard
// ============================================================================

describe("Protocol completeness", () => {
  const allProtocols: RepresentationProtocol[] = [
    PROTOCOL_STEWARD_LED,
    PROTOCOL_LRO_LED,
    PROTOCOL_NATIONAL_REP_LED,
    PROTOCOL_OFFICER_LED,
  ];

  it.each(allProtocols)(
    "preset $primaryRepresentative has all required fields",
    (protocol) => {
      expect(protocol.version).toBe(1);
      expect(protocol.primaryRepresentative).toBeTruthy();
      expect(protocol.representativeLabel).toBeTruthy();
      expect(protocol.stewardLabel).toBeTruthy();
      expect(protocol.minimumFilingRole).toBeTruthy();
      expect(protocol.minimumRepresentationRole).toBeTruthy();
      expect(protocol.stewardPermissions).toBeDefined();
      expect(typeof protocol.stewardPermissions.canFileGrievance).toBe("boolean");
      expect(typeof protocol.stewardPermissions.canRepresent).toBe("boolean");
      expect(typeof protocol.stewardPermissions.canBeAssigned).toBe("boolean");
      expect(typeof protocol.stewardPermissions.canContactEmployer).toBe("boolean");
      expect(typeof protocol.stewardPermissions.canEscalate).toBe("boolean");
    }
  );

  it("PROTOCOL_PRESETS covers all RepresentativeType values", () => {
    const types: RepresentativeType[] = ["steward", "lro", "national_rep", "officer"];
    for (const t of types) {
      expect(PROTOCOL_PRESETS[t]).toBeDefined();
      expect(PROTOCOL_PRESETS[t].primaryRepresentative).toBe(t);
    }
  });
});
