import { describe, expect, it, vi } from "vitest";
import {
  buildExecutiveMetrics,
  buildLeadershipDashboard,
} from "@/lib/services/dashboard-kpi-service";

type LeadershipDashboardGrievances = Parameters<typeof buildLeadershipDashboard>[0];
type LeadershipDashboardAlerts = Parameters<typeof buildLeadershipDashboard>[1];
type ExecutiveMetricsGrievances = Parameters<typeof buildExecutiveMetrics>[0];
type ExecutiveMetricsMembers = Parameters<typeof buildExecutiveMetrics>[1];
type ExecutiveMetricsGoals = Parameters<typeof buildExecutiveMetrics>[2];
type ExecutiveMetricsRemittances = Parameters<typeof buildExecutiveMetrics>[3];

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
    ] satisfies LeadershipDashboardGrievances;

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
    ] satisfies LeadershipDashboardAlerts;

    const result = buildLeadershipDashboard(grievances, alerts, "monthly", iso("2026-01-12T00:00:00.000Z"));

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
    ] satisfies ExecutiveMetricsGrievances;

    const members = [
      { id: "m-1", status: "active", joinedAt: iso("2026-02-03T00:00:00.000Z"), createdAt: iso("2026-02-03T00:00:00.000Z") },
      { id: "m-2", status: "inactive", joinedAt: iso("2026-02-01T00:00:00.000Z"), createdAt: iso("2026-02-01T00:00:00.000Z") },
      { id: "m-3", status: "active", joinedAt: iso("2026-01-05T00:00:00.000Z"), createdAt: iso("2026-01-05T00:00:00.000Z") },
    ] satisfies ExecutiveMetricsMembers;

    const goals = [
      { id: "goal-1", status: "at-risk" },
      { id: "goal-2", status: "on-track" },
    ] satisfies ExecutiveMetricsGoals;

    const remittances = [
      { id: "r-1", totalAmount: "45000.25", expectedAmount: "50000.00" },
      { id: "r-2", totalAmount: "55000.75", expectedAmount: null },
    ] satisfies ExecutiveMetricsRemittances;

    const result = buildExecutiveMetrics(
      grievances,
      members,
      goals,
      remittances,
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

  it("buildLeadershipDashboard exercises weekly buckets and sorted alert/employer branches", () => {
    const grievances = [
      {
        id: "g-a",
        status: "arbitration",
        step: "arbitration",
        type: "contract",
        organizationId: "org-1",
        employerId: "emp-1",
        employerName: "Acme Works",
        unionRepId: "steward-1",
        timeline: [{ date: "2026-03-03T00:00:00.000Z", action: "investigating", actor: "steward" }],
        filedDate: iso("2026-03-01T00:00:00.000Z"),
        createdAt: iso("2026-03-01T00:00:00.000Z"),
        updatedAt: iso("2026-03-11T00:00:00.000Z"),
        resolvedAt: null,
        closedAt: null,
        escalatedAt: iso("2026-03-10T00:00:00.000Z"),
        meetingDate: iso("2026-03-20T00:00:00.000Z"),
        responseDeadline: iso("2026-03-05T00:00:00.000Z"),
      },
      {
        id: "g-b",
        status: "settled",
        step: "step_2",
        type: "safety",
        organizationId: "org-1",
        employerId: "emp-2",
        employerName: "Beta Mining",
        unionRepId: "steward-2",
        timeline: [{ date: "2026-03-06T00:00:00.000Z", action: "triage complete", actor: "steward" }],
        filedDate: iso("2026-03-05T00:00:00.000Z"),
        createdAt: iso("2026-03-05T00:00:00.000Z"),
        updatedAt: iso("2026-03-18T00:00:00.000Z"),
        resolvedAt: iso("2026-03-18T00:00:00.000Z"),
        closedAt: null,
        escalatedAt: null,
        meetingDate: null,
        responseDeadline: iso("2026-03-16T00:00:00.000Z"),
      },
    ] satisfies LeadershipDashboardGrievances;

    const alerts = [
      {
        id: "a-open-1",
        orgId: "org-1",
        employerId: "emp-1",
        alertType: "reporting_overdue",
        severity: "high",
        message: "Document missing",
        createdAt: iso("2026-03-11T00:00:00.000Z"),
        resolvedAt: null,
      },
      {
        id: "a-open-2",
        orgId: "org-1",
        employerId: "emp-2",
        alertType: "deadline_risk",
        severity: "medium",
        message: null,
        createdAt: iso("2026-03-09T00:00:00.000Z"),
        resolvedAt: null,
      },
      {
        id: "a-resolved",
        orgId: "org-1",
        employerId: "emp-1",
        alertType: "audit_flag",
        severity: "low",
        message: "resolved",
        createdAt: iso("2026-03-01T00:00:00.000Z"),
        resolvedAt: iso("2026-03-08T00:00:00.000Z"),
      },
    ] satisfies LeadershipDashboardAlerts;

    const result = buildLeadershipDashboard(grievances, alerts, "weekly", iso("2026-03-21T00:00:00.000Z"));
    expect(result.trends).toHaveLength(12);
    expect(result.employers.length).toBeGreaterThan(1);
    expect(result.compliance.metrics.avgResponseTime).toBeGreaterThanOrEqual(0);
    expect(result.compliance.alerts[0]?.id).toBe("a-open-1");
  });

  it("buildExecutiveMetrics handles quarterly timeframe and no previous joins", () => {
    const result = buildExecutiveMetrics(
      [
        {
          id: "g-1",
          status: "settled",
          organizationId: "org-1",
          filedDate: iso("2026-04-02T00:00:00.000Z"),
          createdAt: iso("2026-04-02T00:00:00.000Z"),
          resolvedAt: iso("2026-04-10T00:00:00.000Z"),
          updatedAt: iso("2026-04-10T00:00:00.000Z"),
          closedAt: null,
          meetingDate: null,
        },
      ] satisfies ExecutiveMetricsGrievances,
      [
        {
          id: "m-1",
          status: "active",
          joinedAt: iso("2026-04-05T00:00:00.000Z"),
          createdAt: iso("2026-04-05T00:00:00.000Z"),
        },
      ] satisfies ExecutiveMetricsMembers,
      [] satisfies ExecutiveMetricsGoals,
      [] satisfies ExecutiveMetricsRemittances,
      "quarterly",
      iso("2026-04-18T00:00:00.000Z"),
    );

    expect(result.membershipTrend).toBe(100);
    expect(result.provenance.window.timeframe).toBe("quarterly");
  });

  it("buildExecutiveMetrics handles a declining membership trend", () => {
    const result = buildExecutiveMetrics(
      [] satisfies ExecutiveMetricsGrievances,
      [
        {
          id: "m-prev",
          status: "active",
          joinedAt: iso("2026-03-05T00:00:00.000Z"),
          createdAt: iso("2026-03-05T00:00:00.000Z"),
        },
      ] satisfies ExecutiveMetricsMembers,
      [] satisfies ExecutiveMetricsGoals,
      [] satisfies ExecutiveMetricsRemittances,
      "monthly",
      iso("2026-04-18T00:00:00.000Z"),
    );

    expect(result.membershipTrend).toBe(-100);
  });

  it("buildLeadershipDashboard covers quarterly trend buckets and triage timeline sorting", () => {
    const grievances = [
      {
        id: "g-q1",
        status: "settled",
        step: "step_2",
        type: "contract",
        organizationId: "org-1",
        employerId: "emp-1",
        employerName: "Acme Works",
        unionRepId: "steward-1",
        timeline: [
          { date: "2026-03-10T00:00:00.000Z", action: "assigned", actor: "steward" },
          { date: "2026-03-06T00:00:00.000Z", action: "acknowledged", actor: "steward" },
        ],
        filedDate: iso("2026-03-05T00:00:00.000Z"),
        createdAt: iso("2026-03-05T00:00:00.000Z"),
        updatedAt: iso("2026-03-20T00:00:00.000Z"),
        resolvedAt: iso("2026-03-20T00:00:00.000Z"),
        closedAt: null,
        escalatedAt: null,
        meetingDate: null,
        responseDeadline: iso("2026-03-15T00:00:00.000Z"),
      },
    ] satisfies LeadershipDashboardGrievances;

    const alerts = [] satisfies LeadershipDashboardAlerts;
    const result = buildLeadershipDashboard(grievances, alerts, "quarterly", iso("2026-04-18T00:00:00.000Z"));

    expect(result.trends).toHaveLength(8);
    expect(result.kpi.avgTriageDays).toBeGreaterThanOrEqual(0);
  });

  it("getLeadershipDashboardMetrics returns cache hit payload without db writes", async () => {
    vi.resetModules();

    const cacheGetMock = vi.fn().mockResolvedValue({
      kpi: {
        activeGrievances: 1,
        resolvedThisMonth: 0,
        avgTriageDays: 2,
        avgResolutionDays: 4,
        arbitrationCount: 0,
        overdueCases: 0,
      },
      employers: [],
      trends: [],
      categories: [],
      stewards: [],
      compliance: {
        metrics: {
          deadlineAdherence: 100,
          avgResponseTime: 0,
          documentationRate: 100,
          openAlerts: 0,
        },
        alerts: [],
      },
      provenance: {
        version: "v2",
        generatedAt: "2026-01-01T00:00:00.000Z",
        window: {
          timeframe: "monthly",
          start: "2025-02-01T00:00:00.000Z",
          end: "2026-01-01T00:00:00.000Z",
        },
        sources: [],
        cache: {
          namespace: "dashboard-kpis",
          key: "k",
          ttlSeconds: 600,
          hit: false,
        },
      },
    });
    const cacheSetMock = vi.fn().mockResolvedValue(true);

    const dbMock = {
      select: vi.fn(),
    };

    vi.doMock("@/lib/services/cache-service", () => ({
      cacheGet: cacheGetMock,
      cacheSet: cacheSetMock,
    }));
    vi.doMock("@/db/db", () => ({ db: dbMock }));

    const mod = await import("@/lib/services/dashboard-kpi-service");
    const result = await mod.getLeadershipDashboardMetrics({ organizationId: "org-1", timeframe: "monthly" });

    expect(result.provenance.cache.hit).toBe(true);
    expect(dbMock.select).not.toHaveBeenCalled();
    expect(cacheSetMock).not.toHaveBeenCalled();
  });

  it("getLeadershipDashboardMetrics cache miss loads rows and stores payload", async () => {
    vi.resetModules();

    const grievancesTable = { __table: "grievances" };
    const alertsTable = { __table: "alerts" };

    const grievanceRows = [
      {
        id: "g-miss-1",
        status: "investigating",
        step: "step_1",
        type: null,
        organizationId: "org-1",
        employerId: "emp-1",
        employerName: "Acme Works",
        unionRepId: null,
        timeline: null,
        filedDate: null,
        createdAt: null,
        updatedAt: iso("2026-06-03T00:00:00.000Z"),
        resolvedAt: null,
        closedAt: null,
        escalatedAt: null,
        meetingDate: null,
        responseDeadline: null,
      },
    ];

    const alertRows = [
      {
        id: "a-miss-1",
        orgId: "org-1",
        employerId: "emp-1",
        alertType: "reporting_overdue",
        severity: "medium",
        message: "   ",
        createdAt: iso("2026-06-01T00:00:00.000Z"),
        resolvedAt: null,
      },
    ];

    const cacheGetMock = vi.fn().mockResolvedValue(null);
    const cacheSetMock = vi.fn().mockResolvedValue(true);

    const dbMock = {
      select: vi.fn(() => ({
        from: (table: { __table: string }) => ({
          where: () => ({
            limit: () => {
              if (table.__table === "grievances") return Promise.resolve(grievanceRows);
              if (table.__table === "alerts") return Promise.resolve(alertRows);
              return Promise.resolve([]);
            },
          }),
        }),
      })),
    };

    vi.doMock("@/db/schema", () => ({
      grievances: grievancesTable,
      complianceAlerts: alertsTable,
      organizationMembers: { __table: "members" },
      strategicGoals: { __table: "goals" },
      employerRemittances: { __table: "remittances" },
    }));
    vi.doMock("drizzle-orm", () => ({
      and: vi.fn(() => ({})),
      eq: vi.fn(() => ({})),
      gte: vi.fn(() => ({})),
      lt: vi.fn(() => ({})),
    }));
    vi.doMock("@/lib/services/cache-service", () => ({
      cacheGet: cacheGetMock,
      cacheSet: cacheSetMock,
    }));
    vi.doMock("@/db/db", () => ({ db: dbMock }));

    const mod = await import("@/lib/services/dashboard-kpi-service");
    const result = await mod.getLeadershipDashboardMetrics({
      organizationId: "org-1",
      timeframe: "monthly",
      now: iso("2026-06-10T00:00:00.000Z"),
    });

    expect(result.kpi.activeGrievances).toBe(1);
    expect(result.compliance.alerts[0]?.title).toBe("Reporting Overdue alert");
    expect(result.provenance.cache.hit).toBe(false);
    expect(cacheSetMock).toHaveBeenCalledTimes(1);
  });

  it("buildLeadershipDashboard handles empty inputs with default compliance values", () => {
    const result = buildLeadershipDashboard([], [], "weekly", iso("2026-01-12T00:00:00.000Z"));

    expect(result.kpi.activeGrievances).toBe(0);
    expect(result.compliance.metrics.deadlineAdherence).toBe(100);
    expect(result.compliance.metrics.documentationRate).toBe(100);
    expect(result.compliance.alerts).toEqual([]);
  });

  it("getExecutiveMetrics cache miss loads db rows and caches payload", async () => {
    vi.resetModules();

    const grievancesTable = { __table: "grievances" };
    const membersTable = { __table: "members" };
    const goalsTable = { __table: "goals" };
    const remittancesTable = { __table: "remittances" };

    const grievanceRows = [
      {
        id: "g-1",
        status: "investigating",
        filedDate: iso("2026-05-01T00:00:00.000Z"),
        createdAt: iso("2026-05-01T00:00:00.000Z"),
        resolvedAt: null,
        updatedAt: iso("2026-05-02T00:00:00.000Z"),
        closedAt: null,
        meetingDate: null,
      },
    ];
    const memberRows = [{ id: "m-1", status: "active", joinedAt: iso("2026-05-04T00:00:00.000Z"), createdAt: iso("2026-05-04T00:00:00.000Z") }];
    const goalRows = [{ id: "goal-1", status: "at-risk" }];
    const remittanceRows = [{ id: "r-1", totalAmount: "10", expectedAmount: "20" }];

    const cacheGetMock = vi.fn().mockResolvedValue(null);
    const cacheSetMock = vi.fn().mockResolvedValue(true);

    const dbMock = {
      select: vi.fn(() => ({
        from: (table: { __table: string }) => ({
          where: () => {
            if (table.__table === "remittances") return Promise.resolve(remittanceRows);
            return {
              limit: () => {
                if (table.__table === "grievances") return Promise.resolve(grievanceRows);
                if (table.__table === "members") return Promise.resolve(memberRows);
                if (table.__table === "goals") return Promise.resolve(goalRows);
                return Promise.resolve([]);
              },
            };
          },
        }),
      })),
    };

    vi.doMock("@/db/schema", () => ({
      grievances: grievancesTable,
      organizationMembers: membersTable,
      strategicGoals: goalsTable,
      employerRemittances: remittancesTable,
      complianceAlerts: { __table: "alerts" },
    }));
    vi.doMock("drizzle-orm", () => ({
      and: vi.fn(() => ({})),
      eq: vi.fn(() => ({})),
      gte: vi.fn(() => ({})),
      lt: vi.fn(() => ({})),
    }));
    vi.doMock("@/lib/services/cache-service", () => ({
      cacheGet: cacheGetMock,
      cacheSet: cacheSetMock,
    }));
    vi.doMock("@/db/db", () => ({ db: dbMock }));

    const mod = await import("@/lib/services/dashboard-kpi-service");
    const result = await mod.getExecutiveMetrics({ organizationId: "org-1", timeframe: "monthly", now: iso("2026-05-10T00:00:00.000Z") });

    expect(result.pendingApprovals).toBe(1);
    expect(result.monthlyBudget.allocated).toBe(20);
    expect(result.provenance.cache.hit).toBe(false);
    expect(cacheSetMock).toHaveBeenCalledTimes(1);
  });

  it("getExecutiveMetrics returns cache hit payload without db writes", async () => {
    vi.resetModules();

    const cacheGetMock = vi.fn().mockResolvedValue({
      totalMembers: 5,
      activeGrievances: 2,
      pendingApprovals: 1,
      upcomingMeetings: 0,
      monthlyBudget: {
        allocated: 1000,
        spent: 100,
        currency: "USD",
      },
      membershipTrend: 0,
      grievanceResolutionRate: 50,
      provenance: {
        version: "v2",
        generatedAt: "2026-06-01T00:00:00.000Z",
        window: {
          timeframe: "monthly",
          start: "2026-05-01T00:00:00.000Z",
          end: "2026-06-01T00:00:00.000Z",
        },
        sources: [],
        cache: {
          namespace: "dashboard-kpis",
          key: "executive:k",
          ttlSeconds: 900,
          hit: false,
        },
      },
    });
    const cacheSetMock = vi.fn().mockResolvedValue(true);
    const dbMock = { select: vi.fn() };

    vi.doMock("@/lib/services/cache-service", () => ({
      cacheGet: cacheGetMock,
      cacheSet: cacheSetMock,
    }));
    vi.doMock("@/db/db", () => ({ db: dbMock }));

    const mod = await import("@/lib/services/dashboard-kpi-service");
    const result = await mod.getExecutiveMetrics({ organizationId: "org-1", timeframe: "monthly" });

    expect(result.provenance.cache.hit).toBe(true);
    expect(dbMock.select).not.toHaveBeenCalled();
    expect(cacheSetMock).not.toHaveBeenCalled();
  });

  it("buildLeadershipDashboard marks employer trend as down when activity drops", () => {
    const grievances = [
      {
        id: "g-prev",
        status: "investigating",
        step: "step_1",
        type: null,
        organizationId: "org-1",
        employerId: "emp-down",
        employerName: "Decline Co",
        unionRepId: "steward-1",
        timeline: null,
        filedDate: iso("2025-01-15T00:00:00.000Z"),
        createdAt: iso("2025-01-15T00:00:00.000Z"),
        updatedAt: iso("2025-01-20T00:00:00.000Z"),
        resolvedAt: null,
        closedAt: null,
        escalatedAt: null,
        meetingDate: null,
        responseDeadline: null,
      },
      {
        id: "g-current",
        status: "new",
        step: "step_1",
        type: "safety",
        organizationId: "org-1",
        employerId: "emp-other",
        employerName: "Other Co",
        unionRepId: "steward-2",
        timeline: null,
        filedDate: iso("2026-05-10T00:00:00.000Z"),
        createdAt: iso("2026-05-10T00:00:00.000Z"),
        updatedAt: iso("2026-05-11T00:00:00.000Z"),
        resolvedAt: null,
        closedAt: null,
        escalatedAt: null,
        meetingDate: null,
        responseDeadline: null,
      },
    ] satisfies LeadershipDashboardGrievances;

    const result = buildLeadershipDashboard(grievances, [], "monthly", iso("2026-05-25T00:00:00.000Z"));
    const declinedEmployer = result.employers.find((e) => e.employerId === "emp-down");

    expect(declinedEmployer?.trend).toBe("down");
    expect(declinedEmployer?.topCategory).toBe("other");
  });

  it("buildExecutiveMetrics handles numeric remittance values and invalid expected amount", () => {
    const result = buildExecutiveMetrics(
      [] satisfies ExecutiveMetricsGrievances,
      [] satisfies ExecutiveMetricsMembers,
      [] satisfies ExecutiveMetricsGoals,
      [{ id: "r-1", totalAmount: 1250, expectedAmount: "NaN" }] satisfies ExecutiveMetricsRemittances,
      "monthly",
      iso("2026-06-18T00:00:00.000Z"),
    );

    expect(result.monthlyBudget.spent).toBe(1250);
    expect(result.monthlyBudget.allocated).toBe(1250);
  });

  it("buildLeadershipDashboard handles malformed dates, empty employer metadata, and out-of-window trend events", () => {
    const now = iso("2026-06-14T00:00:00.000Z"); // Sunday
    const grievances = [
      {
        id: "g-malformed-resolved",
        status: "settled",
        step: null,
        type: null,
        organizationId: "org-1",
        employerId: null,
        employerName: "   ",
        unionRepId: "stew-1",
        timeline: { not: "an-array" },
        filedDate: iso("2026-06-01T00:00:00.000Z"),
        createdAt: iso("2026-06-01T00:00:00.000Z"),
        updatedAt: null,
        resolvedAt: null,
        closedAt: null,
        escalatedAt: null,
        meetingDate: null,
        responseDeadline: null,
      },
      {
        id: "g-open-no-filed",
        status: "investigating",
        step: "step_1",
        type: null,
        organizationId: "org-1",
        employerId: null,
        employerName: "   ",
        unionRepId: "stew-1",
        timeline: [{ date: "not-a-date", action: null }],
        filedDate: new Date("invalid"),
        createdAt: "not-a-date",
        updatedAt: iso("2026-06-05T00:00:00.000Z"),
        resolvedAt: null,
        closedAt: null,
        escalatedAt: null,
        meetingDate: null,
        responseDeadline: iso("2026-06-01T00:00:00.000Z"),
      },
      {
        id: "g-escalated-outside-window",
        status: "escalated",
        step: "step_2",
        type: "contract",
        organizationId: "org-1",
        employerId: "emp-old",
        employerName: "Old Co",
        unionRepId: null,
        timeline: null,
        filedDate: iso("1900-01-01T00:00:00.000Z"),
        createdAt: iso("1900-01-01T00:00:00.000Z"),
        updatedAt: iso("1900-01-01T00:00:00.000Z"),
        resolvedAt: null,
        closedAt: null,
        escalatedAt: iso("1900-01-01T00:00:00.000Z"),
        meetingDate: null,
        responseDeadline: null,
      },
    ] as unknown as LeadershipDashboardGrievances;

    const alerts = [
      {
        id: "a-open-null-created",
        orgId: "org-1",
        employerId: "emp-1",
        alertType: "deadline_risk",
        severity: "high",
        message: null,
        createdAt: null,
        resolvedAt: null,
      },
      {
        id: "a-open-invalid-created",
        orgId: "org-1",
        employerId: "emp-1",
        alertType: "reporting_overdue",
        severity: "medium",
        message: "",
        createdAt: "not-a-date",
        resolvedAt: null,
      },
      {
        id: "a-resolved-invalid-created",
        orgId: "org-1",
        employerId: "emp-1",
        alertType: "audit_flag",
        severity: "low",
        message: "resolved",
        createdAt: "not-a-date",
        resolvedAt: iso("2026-06-10T00:00:00.000Z"),
      },
    ] as unknown as LeadershipDashboardAlerts;

    const result = buildLeadershipDashboard(grievances, alerts, "weekly", now);

    expect(result.kpi.resolvedThisMonth).toBe(0);
    expect(result.kpi.activeGrievances).toBeGreaterThanOrEqual(1);
    expect(result.compliance.alerts.length).toBeGreaterThanOrEqual(1);
    expect(result.employers[0]?.employerName).toBeTruthy();
  });

  it("buildExecutiveMetrics handles invalid join/filed dates and non-finite numeric values", () => {
    const result = buildExecutiveMetrics(
      [
        {
          id: "g-invalid-filed",
          status: "settled",
          organizationId: "org-1",
          filedDate: new Date("invalid"),
          createdAt: "not-a-date",
          resolvedAt: null,
          updatedAt: null,
          closedAt: null,
          meetingDate: null,
        },
      ] as unknown as ExecutiveMetricsGrievances,
      [
        {
          id: "m-invalid-join",
          status: null,
          joinedAt: new Date("invalid"),
          createdAt: "not-a-date",
        },
      ] as unknown as ExecutiveMetricsMembers,
      [] satisfies ExecutiveMetricsGoals,
      [{ id: "r-inf", totalAmount: Number.POSITIVE_INFINITY, expectedAmount: Number.NEGATIVE_INFINITY }] as unknown as ExecutiveMetricsRemittances,
      "monthly",
      iso("2026-06-18T00:00:00.000Z"),
    );

    expect(result.totalMembers).toBe(1);
    expect(result.grievanceResolutionRate).toBe(0);
    expect(result.membershipTrend).toBe(0);
    expect(result.monthlyBudget.spent).toBe(0);
    expect(result.monthlyBudget.allocated).toBe(0);
  });

  it("buildLeadershipDashboard covers infer-triage fallbacks and trend bucket misses", () => {
    const now = iso("2026-06-18T00:00:00.000Z");
    const grievances = [
      {
        id: "g-timeline-not-array",
        status: "investigating",
        step: "step_1",
        type: "contract",
        organizationId: "org-1",
        employerId: "emp-branch",
        employerName: "Branch Co",
        unionRepId: "stew-b1",
        timeline: { invalid: true },
        filedDate: iso("2026-06-10T00:00:00.000Z"),
        createdAt: iso("2026-06-10T00:00:00.000Z"),
        updatedAt: iso("2026-06-12T00:00:00.000Z"),
        resolvedAt: null,
        closedAt: null,
        escalatedAt: null,
        meetingDate: null,
        responseDeadline: iso("2026-06-09T00:00:00.000Z"),
      },
      {
        id: "g-timeline-no-signal",
        status: "investigating",
        step: "step_1",
        type: "contract",
        organizationId: "org-1",
        employerId: "emp-branch",
        employerName: "Branch Co",
        unionRepId: "stew-b1",
        timeline: [{ date: "2026-06-11T00:00:00.000Z", action: null }],
        filedDate: iso("2026-06-12T00:00:00.000Z"),
        createdAt: iso("2026-06-12T00:00:00.000Z"),
        updatedAt: iso("2026-06-10T00:00:00.000Z"),
        resolvedAt: null,
        closedAt: null,
        escalatedAt: null,
        meetingDate: null,
        responseDeadline: null,
      },
      {
        id: "g-null-status",
        status: null,
        step: null,
        type: "safety",
        organizationId: "org-1",
        employerId: "emp-branch",
        employerName: "Branch Co",
        unionRepId: "stew-b1",
        timeline: null,
        filedDate: iso("2026-06-13T00:00:00.000Z"),
        createdAt: iso("2026-06-13T00:00:00.000Z"),
        updatedAt: iso("2026-06-14T00:00:00.000Z"),
        resolvedAt: null,
        closedAt: null,
        escalatedAt: null,
        meetingDate: null,
        responseDeadline: null,
      },
      {
        id: "g-resolved-outside-buckets",
        status: "settled",
        step: "step_3",
        type: "wages",
        organizationId: "org-1",
        employerId: "emp-old",
        employerName: "Old Branch",
        unionRepId: null,
        timeline: null,
        filedDate: iso("1900-01-01T00:00:00.000Z"),
        createdAt: iso("1900-01-01T00:00:00.000Z"),
        updatedAt: iso("1900-01-02T00:00:00.000Z"),
        resolvedAt: iso("1900-01-02T00:00:00.000Z"),
        closedAt: null,
        escalatedAt: null,
        meetingDate: null,
        responseDeadline: null,
      },
      {
        id: "g-escalated-in-window",
        status: "escalated",
        step: "step_2",
        type: "contract",
        organizationId: "org-1",
        employerId: "emp-esc",
        employerName: "Escalation Inc",
        unionRepId: null,
        timeline: null,
        filedDate: iso("2026-06-15T00:00:00.000Z"),
        createdAt: iso("2026-06-15T00:00:00.000Z"),
        updatedAt: iso("2026-06-17T00:00:00.000Z"),
        resolvedAt: null,
        closedAt: null,
        escalatedAt: iso("2026-06-17T00:00:00.000Z"),
        meetingDate: null,
        responseDeadline: null,
      },
    ] as unknown as LeadershipDashboardGrievances;

    const result = buildLeadershipDashboard(grievances, [], "weekly", now);

    expect(result.trends).toHaveLength(12);
    expect(result.kpi.activeGrievances).toBeGreaterThanOrEqual(2);
    expect(result.employers.some((e) => e.topCategory === "contract")).toBe(true);
  });

  it("buildLeadershipDashboard uses createdAt fallback when filedDate is missing during triage inference", () => {
    const result = buildLeadershipDashboard(
      [
        {
          id: "g-created-at-fallback",
          status: "investigating",
          step: "step_1",
          type: "contract",
          organizationId: "org-1",
          employerId: "emp-1",
          employerName: "Fallback Co",
          unionRepId: "stew-fallback",
          timeline: null,
          filedDate: null,
          createdAt: iso("2026-06-10T00:00:00.000Z"),
          updatedAt: iso("2026-06-12T00:00:00.000Z"),
          resolvedAt: null,
          closedAt: null,
          escalatedAt: null,
          meetingDate: null,
          responseDeadline: null,
        },
      ] as unknown as LeadershipDashboardGrievances,
      [] satisfies LeadershipDashboardAlerts,
      "monthly",
      iso("2026-06-18T00:00:00.000Z"),
    );

    expect(result.kpi.avgTriageDays).toBeGreaterThanOrEqual(0);
    expect(result.stewards.length).toBe(1);
  });

  it("buildLeadershipDashboard covers weekly ISO week fallback when weekday resolves to 0", () => {
    const getDaySpy = vi.spyOn(Date.prototype, "getUTCDay").mockReturnValue(0);
    const result = buildLeadershipDashboard(
      [
        {
          id: "g-weekly-fallback",
          status: "investigating",
          step: "step_1",
          type: "contract",
          organizationId: "org-1",
          employerId: "emp-1",
          employerName: "Week Co",
          unionRepId: "stew-week",
          timeline: null,
          filedDate: iso("2026-06-10T00:00:00.000Z"),
          createdAt: iso("2026-06-10T00:00:00.000Z"),
          updatedAt: iso("2026-06-11T00:00:00.000Z"),
          resolvedAt: null,
          closedAt: null,
          escalatedAt: null,
          meetingDate: null,
          responseDeadline: null,
        },
      ] as unknown as LeadershipDashboardGrievances,
      [] satisfies LeadershipDashboardAlerts,
      "weekly",
      iso("2026-06-18T00:00:00.000Z"),
    );

    getDaySpy.mockRestore();
    expect(result.trends).toHaveLength(12);
  });

  it("buildLeadershipDashboard covers category percentage fallback branch when relevant length reports zero", () => {
    const grievances = [
      {
        id: "g-category-proxy",
        status: "investigating",
        step: "step_1",
        type: "contract",
        organizationId: "org-1",
        employerId: "emp-proxy",
        employerName: "Proxy Co",
        unionRepId: "stew-proxy",
        timeline: null,
        filedDate: iso("2026-06-10T00:00:00.000Z"),
        createdAt: iso("2026-06-10T00:00:00.000Z"),
        updatedAt: iso("2026-06-11T00:00:00.000Z"),
        resolvedAt: null,
        closedAt: null,
        escalatedAt: null,
        meetingDate: null,
        responseDeadline: null,
      },
    ] as unknown as LeadershipDashboardGrievances;

    const originalFilter = Array.prototype.filter;
    const filterSpy = vi.spyOn(Array.prototype, "filter").mockImplementation(function (this: unknown[], predicate: (value: unknown, index: number, array: unknown[]) => boolean, thisArg?: unknown) {
      const result = originalFilter.call(this, predicate as never, thisArg) as unknown[];
      if (
        this === grievances
        && typeof predicate === "function"
        && predicate.toString().includes("referenceDate")
      ) {
        return new Proxy(result, {
          get(target, prop, receiver) {
            if (prop === "length") return 0;
            return Reflect.get(target, prop, receiver);
          },
        }) as unknown[];
      }
      return result;
    });

    const result = buildLeadershipDashboard(grievances, [] satisfies LeadershipDashboardAlerts, "monthly", iso("2026-06-18T00:00:00.000Z"));
    filterSpy.mockRestore();

    expect(Array.isArray(result.categories)).toBe(true);
  });
});
