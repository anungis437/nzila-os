/**
 * Unit Tests — CAPE Demo Data
 *
 * Tests generateDemoEmployers,
 * generateDemoGrievances, getDemoDatasetSummary.
 */
import { describe, it, expect } from "vitest";

import {
  generateDemoEmployers,
  generateDemoGrievances,
  getDemoDatasetSummary,
} from "@/lib/pilot/cape-demo-data";

const ORG_ID = "org_test_123";

// ─── generateDemoEmployers ──────────────────────────────────────────────────

describe("generateDemoEmployers", () => {
  it("returns 4 demo employers", () => {
    const employers = generateDemoEmployers(ORG_ID);
    expect(employers).toHaveLength(4);
  });

  it("assigns organizationId to every employer", () => {
    const employers = generateDemoEmployers(ORG_ID);
    for (const e of employers) {
      expect(e.organizationId).toBe(ORG_ID);
    }
  });

  it("generates unique IDs for each employer", () => {
    const employers = generateDemoEmployers(ORG_ID);
    const ids = employers.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses federal as employerType for all", () => {
    const employers = generateDemoEmployers(ORG_ID);
    for (const e of employers) {
      expect(e.employerType).toBe("federal");
    }
  });
});

// ─── generateDemoGrievances ─────────────────────────────────────────────────

describe("generateDemoGrievances", () => {
  it("returns 8 demo grievances", () => {
    const grievances = generateDemoGrievances(ORG_ID);
    expect(grievances).toHaveLength(8);
  });

  it("assigns organizationId to every grievance", () => {
    const grievances = generateDemoGrievances(ORG_ID);
    for (const g of grievances) {
      expect(g.organizationId).toBe(ORG_ID);
    }
  });

  it("covers multiple grievance types", () => {
    const grievances = generateDemoGrievances(ORG_ID);
    const types = new Set(grievances.map((g) => g.type));
    expect(types.size).toBeGreaterThanOrEqual(3);
  });

  it("covers multiple statuses", () => {
    const grievances = generateDemoGrievances(ORG_ID);
    const statuses = new Set(grievances.map((g) => g.status));
    expect(statuses.size).toBeGreaterThanOrEqual(4);
  });

  it("includes at least one urgent-priority grievance", () => {
    const grievances = generateDemoGrievances(ORG_ID);
    const urgent = grievances.filter((g) => g.priority === "urgent");
    expect(urgent.length).toBeGreaterThanOrEqual(1);
  });

  it("includes GRV-DEMO- prefixed grievance numbers", () => {
    const grievances = generateDemoGrievances(ORG_ID);
    for (const g of grievances) {
      expect(g.grievanceNumber).toMatch(/^GRV-DEMO-\d{3}$/);
    }
  });

  it("includes past dates for filedDate and incidentDate", () => {
    const grievances = generateDemoGrievances(ORG_ID);
    const now = Date.now();
    for (const g of grievances) {
      expect(g.filedDate.getTime()).toBeLessThan(now);
      expect(g.incidentDate.getTime()).toBeLessThan(now);
    }
  });

  it("uses GRV-DEMO prefix for identification during purge", () => {
    const grievances = generateDemoGrievances(ORG_ID);
    for (const g of grievances) {
      expect(g.grievanceNumber).toMatch(/^GRV-DEMO-/);
    }
  });
});

// ─── getDemoDatasetSummary ──────────────────────────────────────────────────

describe("getDemoDatasetSummary", () => {
  it("returns correct counts", () => {
    const summary = getDemoDatasetSummary(ORG_ID);
    expect(summary.members).toBe(0);
    expect(summary.employers).toBe(4);
    expect(summary.grievances).toBe(8);
    expect(summary.timelines).toBeGreaterThan(0);
    expect(summary.resolutions).toBeGreaterThan(0);
  });

  it("has all expected keys", () => {
    const summary = getDemoDatasetSummary(ORG_ID);
    expect(summary).toHaveProperty("members");
    expect(summary).toHaveProperty("employers");
    expect(summary).toHaveProperty("grievances");
    expect(summary).toHaveProperty("timelines");
    expect(summary).toHaveProperty("resolutions");
  });
});
