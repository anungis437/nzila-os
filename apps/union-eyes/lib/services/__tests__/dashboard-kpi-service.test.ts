import { describe, expect, it } from "vitest";
import {
  buildExecutiveMetrics,
  buildLeadershipDashboard,
} from "@/lib/services/dashboard-kpi-service";

function iso(date: string): Date {
  return new Date(date);
}

describe("dashboard-kpi-service", () => {
  it("computes leadership KPI durations from grievance data", () => {
    const grievances = [
      {
        id: "g-1",
        status: "settled",
        step: "step_2",
        type: "contract",
        organizationId: "org-1",
        employerId: "emp-1",
        employerName: "Acme Works",
        unionRepId: "steward-1",
        timeline: [{ date: "2026-01-03T00:00:00.000Z", action: "Acknowledged by steward", actor: "steward" }],
        filedDate: iso("2026-01-01T00:00:00.000Z"),
        createdAt: iso("2026-01-01T00:00:00.000Z"),
        updatedAt: iso("2026-01-10T00:00:00.000Z"),
        resolvedAt: iso("2026-01-09T00:00:00.000Z"),
        closedAt: null,
        escalatedAt: null,
        meetingDate: null,
        responseDeadline: iso("2026-01-15T00:00:00.000Z"),
      },
      {
        id: "g-2",
        status: "investigating",
        step: "step_1",
        type: "safety",
        organizationId: "org-1",
        employerId: "emp-2",
        employerName: "Beta Mining",
        unionRepId: "steward-2",
        timeline: null,
        filedDate: iso("2026-01-05T00:00:00.000Z"),
        createdAt: iso("2026-01-05T00:00:00.000Z"),
        updatedAt: iso("2026-01-07T00:00:00.000Z"),
        resolvedAt: null,
        closedAt: null,
        escalatedAt: null,
        meetingDate: null,
        responseDeadline: iso("2026-01-06T00:00:00.000Z"),
      },
    ] as any[];

    const alerts = [
      {
        id: "a-1",
        orgId: "org-1",
        employerId: "emp-1",
        alertType: "reporting_overdue",
        severity: "high",
        message: null,
        createdAt: iso("2026-01-02T00:00:00.000Z"),
        resolvedAt: null,
      },
    ] as any[];

    const result = buildLeadershipDashboard(grievances as any, alerts as any, "monthly", iso("2026-01-12T00:00:00.000Z"));

    expect(result.kpi.avgTriageDays).toBe(2);
    expect(result.kpi.avgResolutionDays).toBe(9);
    expect(result.kpi.overdueCases).toBe(1);
    expect(result.compliance.alerts[0]?.title).toBe("Reporting Overdue alert");
    expect(result.provenance.window.timeframe).toBe("monthly");
  });

  it("computes executive metrics from org-scoped member and remittance data", () => {
    const grievances = [
      {
        id: "g-1",
        status: "settled",
        organizationId: "org-1",
        filedDate: iso("2026-02-01T00:00:00.000Z"),
        createdAt: iso("2026-02-01T00:00:00.000Z"),
        resolvedAt: iso("2026-02-10T00:00:00.000Z"),
        updatedAt: iso("2026-02-10T00:00:00.000Z"),
        closedAt: null,
        meetingDate: null,
      },
      {
        id: "g-2",
        status: "investigating",
        organizationId: "org-1",
        filedDate: iso("2026-02-05T00:00:00.000Z"),
        createdAt: iso("2026-02-05T00:00:00.000Z"),
        resolvedAt: null,
        updatedAt: iso("2026-02-08T00:00:00.000Z"),
        closedAt: null,
        meetingDate: iso("2026-02-20T00:00:00.000Z"),
      },
    ] as any[];

    const members = [
      { id: "m-1", status: "active", joinedAt: iso("2026-02-03T00:00:00.000Z"), createdAt: iso("2026-02-03T00:00:00.000Z") },
      { id: "m-2", status: "inactive", joinedAt: iso("2026-02-01T00:00:00.000Z"), createdAt: iso("2026-02-01T00:00:00.000Z") },
      { id: "m-3", status: "active", joinedAt: iso("2026-01-05T00:00:00.000Z"), createdAt: iso("2026-01-05T00:00:00.000Z") },
    ] as any[];

    const goals = [
      { id: "goal-1", status: "at-risk" },
      { id: "goal-2", status: "on-track" },
    ] as any[];

    const remittances = [
      { id: "r-1", totalAmount: "45000.25", expectedAmount: "50000.00" },
      { id: "r-2", totalAmount: "55000.75", expectedAmount: null },
    ] as any[];

    const result = buildExecutiveMetrics(
      grievances as any,
      members as any,
      goals as any,
      remittances as any,
      "monthly",
      iso("2026-02-12T00:00:00.000Z"),
    );

    expect(result.totalMembers).toBe(2);
    expect(result.activeGrievances).toBe(1);
    expect(result.pendingApprovals).toBe(1);
    expect(result.upcomingMeetings).toBe(1);
    expect(result.monthlyBudget.spent).toBe(100001);
    expect(result.monthlyBudget.allocated).toBe(100001);
    expect(result.grievanceResolutionRate).toBe(50);
    expect(result.provenance.sources.some((s) => s.table === "organization_members")).toBe(true);
  });
});
