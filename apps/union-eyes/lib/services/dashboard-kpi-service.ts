import { db } from "@/db/db";
import {
  complianceAlerts,
  employerRemittances,
  grievances,
  organizationMembers,
  strategicGoals,
} from "@/db/schema";
import { and, eq, gte, lt } from "drizzle-orm";
import { cacheGet, cacheSet } from "@/lib/services/cache-service";

export type DashboardTimeframe = "weekly" | "monthly" | "quarterly";

const OPEN_STATUSES = new Set([
  "draft",
  "new",
  "filed",
  "acknowledged",
  "investigating",
  "response_due",
  "response_received",
  "escalated",
  "mediation",
  "arbitration",
]);

const RESOLVED_STATUSES = new Set(["settled", "withdrawn", "denied", "closed", "closed_no_case"]);
const ESCALATED_STATUSES = new Set(["escalated", "arbitration"]);
const ACTIVE_MEMBER_EXCLUDE = new Set(["inactive", "archived", "deleted", "disabled"]);

const LEADERSHIP_CACHE_TTL_SECONDS = 120;
const EXECUTIVE_CACHE_TTL_SECONDS = 120;
const CACHE_NAMESPACE = "dashboard-kpis";
const CACHE_VERSION = "v2";

type DateInput = Date | string | null | undefined;

interface TimeWindow {
  timeframe: DashboardTimeframe;
  start: Date;
  end: Date;
}

interface DashboardProvenance {
  version: string;
  generatedAt: string;
  window: {
    timeframe: DashboardTimeframe;
    start: string;
    end: string;
  };
  sources: Array<{
    table: string;
    rowCount: number;
    organizationScoped: boolean;
  }>;
  cache: {
    namespace: string;
    key: string;
    ttlSeconds: number;
    hit: boolean;
  };
}

export interface LeadershipDashboardPayload {
  kpi: {
    activeGrievances: number;
    resolvedThisMonth: number;
    avgTriageDays: number;
    avgResolutionDays: number;
    arbitrationCount: number;
    overdueCases: number;
  };
  employers: Array<{
    employerId: string;
    employerName: string;
    activeGrievances: number;
    overdueCases: number;
    resolvedThisQuarter: number;
    topCategory: string;
    trend: "up" | "down" | "stable";
    avgResolutionDays: number;
    lastCommunicationDate?: string;
  }>;
  trends: Array<{
    period: string;
    filed: number;
    resolved: number;
    escalated: number;
  }>;
  categories: Array<{
    category: string;
    count: number;
    percentage: number;
  }>;
  stewards: Array<{
    stewardId: string;
    stewardName: string;
    activeCases: number;
    overdueCases: number;
    avgDaysPerCase: number;
    resolvedThisMonth: number;
    capacityLimit: number;
  }>;
  compliance: {
    metrics: {
      deadlineAdherence: number;
      avgResponseTime: number;
      documentationRate: number;
      openAlerts: number;
    };
    alerts: Array<{
      id: string;
      type: string;
      severity: "low" | "medium" | "high" | "critical";
      title: string;
      createdAt: string;
    }>;
  };
  provenance: DashboardProvenance;
}

export interface ExecutiveMetricsPayload {
  totalMembers: number;
  activeGrievances: number;
  pendingApprovals: number;
  upcomingMeetings: number;
  monthlyBudget: {
    allocated: number;
    spent: number;
    currency: string;
  };
  membershipTrend: number;
  grievanceResolutionRate: number;
  provenance: DashboardProvenance;
}

export async function getLeadershipDashboardMetrics(args: {
  organizationId: string;
  timeframe: DashboardTimeframe;
  now?: Date;
}): Promise<LeadershipDashboardPayload> {
  const { organizationId, timeframe } = args;
  const now = args.now ?? new Date();
  const cacheKey = `leadership:${organizationId}:${timeframe}:${CACHE_VERSION}`;

  const cached = await cacheGet<LeadershipDashboardPayload>(cacheKey, { namespace: CACHE_NAMESPACE });
  if (cached) {
    return {
      ...cached,
      provenance: {
        ...cached.provenance,
        cache: {
          ...cached.provenance.cache,
          hit: true,
        },
      },
    };
  }

  const [grievanceRows, alertRows] = await Promise.all([
    db.select().from(grievances).where(eq(grievances.organizationId, organizationId)),
    db.select().from(complianceAlerts).where(eq(complianceAlerts.orgId, organizationId)),
  ]);

  const payload = buildLeadershipDashboard(grievanceRows, alertRows, timeframe, now);
  payload.provenance.cache = {
    namespace: CACHE_NAMESPACE,
    key: cacheKey,
    ttlSeconds: LEADERSHIP_CACHE_TTL_SECONDS,
    hit: false,
  };

  await cacheSet(cacheKey, payload, {
    namespace: CACHE_NAMESPACE,
    ttl: LEADERSHIP_CACHE_TTL_SECONDS,
  });

  return payload;
}

export async function getExecutiveMetrics(args: {
  organizationId: string;
  timeframe: DashboardTimeframe;
  now?: Date;
}): Promise<ExecutiveMetricsPayload> {
  const { organizationId, timeframe } = args;
  const now = args.now ?? new Date();
  const cacheKey = `executive:${organizationId}:${timeframe}:${CACHE_VERSION}`;

  const cached = await cacheGet<ExecutiveMetricsPayload>(cacheKey, { namespace: CACHE_NAMESPACE });
  if (cached) {
    return {
      ...cached,
      provenance: {
        ...cached.provenance,
        cache: {
          ...cached.provenance.cache,
          hit: true,
        },
      },
    };
  }

  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const [grievanceRows, memberRows, goalRows, remittanceRows] = await Promise.all([
    db.select().from(grievances).where(eq(grievances.organizationId, organizationId)),
    db.select().from(organizationMembers).where(eq(organizationMembers.organizationId, organizationId)),
    db.select().from(strategicGoals).where(eq(strategicGoals.organizationId, organizationId)),
    db
      .select()
      .from(employerRemittances)
      .where(
        and(
          eq(employerRemittances.organizationId, organizationId),
          gte(employerRemittances.remittanceDate, monthStart),
          lt(employerRemittances.remittanceDate, nextMonthStart),
        ),
      ),
  ]);

  const payload = buildExecutiveMetrics(
    grievanceRows,
    memberRows,
    goalRows,
    remittanceRows,
    timeframe,
    now,
  );

  payload.provenance.cache = {
    namespace: CACHE_NAMESPACE,
    key: cacheKey,
    ttlSeconds: EXECUTIVE_CACHE_TTL_SECONDS,
    hit: false,
  };

  await cacheSet(cacheKey, payload, {
    namespace: CACHE_NAMESPACE,
    ttl: EXECUTIVE_CACHE_TTL_SECONDS,
  });

  return payload;
}

export function buildLeadershipDashboard(
  grievanceRows: Array<typeof grievances.$inferSelect>,
  alertRows: Array<typeof complianceAlerts.$inferSelect>,
  timeframe: DashboardTimeframe,
  now = new Date(),
): LeadershipDashboardPayload {
  const window = resolveWindow(timeframe, now);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const quarterStart = new Date(Date.UTC(now.getUTCFullYear(), Math.floor(now.getUTCMonth() / 3) * 3, 1));

  const openGrievances = grievanceRows.filter((g) => isOpenStatus(g.status));
  const arbitrationCount = grievanceRows.filter((g) => g.status === "arbitration" || g.step === "arbitration").length;
  const overdueCases = openGrievances.filter((g) => {
    const deadline = asDate(g.responseDeadline);
    return deadline ? deadline < now : false;
  });

  const resolvedThisMonth = grievanceRows.filter((g) => {
    if (!isResolvedStatus(g.status)) return false;
    const resolvedDate = resolvedDateFor(g);
    return resolvedDate ? resolvedDate >= monthStart : false;
  });

  const triageDurations: number[] = [];
  const resolutionDurations: number[] = [];

  for (const grievance of grievanceRows) {
    const filed = asDate(grievance.filedDate) ?? asDate(grievance.createdAt);
    if (!filed || filed < window.start) continue;

    const triageDate = inferTriageDate(grievance);
    if (triageDate && triageDate >= filed) {
      triageDurations.push(diffDays(filed, triageDate));
    }

    const resolvedDate = resolvedDateFor(grievance);
    if (resolvedDate && resolvedDate >= filed && isResolvedStatus(grievance.status)) {
      resolutionDurations.push(diffDays(filed, resolvedDate));
    }
  }

  const categoryCounts = new Map<string, number>();
  const relevantForCategory = grievanceRows.filter((g) => {
    const referenceDate = asDate(g.filedDate) ?? asDate(g.createdAt);
    return referenceDate ? referenceDate >= window.start : false;
  });
  for (const grievance of relevantForCategory) {
    const category = grievance.type ?? "other";
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
  }

  const categories = Array.from(categoryCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([category, count]) => ({
      category,
      count,
      percentage: relevantForCategory.length > 0 ? Math.round((count / relevantForCategory.length) * 100) : 0,
    }));

  const employers = buildEmployerHotspots(grievanceRows, window, now, quarterStart);
  const trends = buildTrendSeries(grievanceRows, timeframe, now);
  const stewards = buildStewardCapacity(grievanceRows, now, monthStart);

  const openAlerts = alertRows.filter((alert) => !asDate(alert.resolvedAt));
  const resolvedAlerts = alertRows.filter((alert) => asDate(alert.resolvedAt));
  const documentedAlertCount = alertRows.filter((alert) => (alert.message ?? "").trim().length > 0).length;
  const responseTimes = resolvedAlerts
    .map((alert) => {
      const created = asDate(alert.createdAt);
      const resolved = asDate(alert.resolvedAt);
      return created && resolved ? diffDays(created, resolved) : null;
    })
    .filter((value): value is number => typeof value === "number");
  const resolvedWithinThreshold = resolvedAlerts.filter((alert) => {
    const created = asDate(alert.createdAt);
    const resolved = asDate(alert.resolvedAt);
    return created && resolved ? diffDays(created, resolved) <= 30 : false;
  }).length;

  return {
    kpi: {
      activeGrievances: openGrievances.length,
      resolvedThisMonth: resolvedThisMonth.length,
      avgTriageDays: averageRounded(triageDurations),
      avgResolutionDays: averageRounded(resolutionDurations),
      arbitrationCount,
      overdueCases: overdueCases.length,
    },
    employers,
    trends,
    categories,
    stewards,
    compliance: {
      metrics: {
        deadlineAdherence: resolvedAlerts.length > 0 ? Math.round((resolvedWithinThreshold / resolvedAlerts.length) * 100) : 100,
        avgResponseTime: averageRounded(responseTimes),
        documentationRate: alertRows.length > 0 ? Math.round((documentedAlertCount / alertRows.length) * 100) : 100,
        openAlerts: openAlerts.length,
      },
      alerts: openAlerts
        .sort((a, b) => {
          const left = asDate(a.createdAt)?.getTime() ?? 0;
          const right = asDate(b.createdAt)?.getTime() ?? 0;
          return right - left;
        })
        .slice(0, 10)
        .map((alert) => ({
          id: alert.id,
          type: alert.alertType,
          severity: alert.severity,
          title: toAlertTitle(alert.alertType, alert.message),
          createdAt: (asDate(alert.createdAt) ?? now).toISOString(),
        })),
    },
    provenance: {
      version: CACHE_VERSION,
      generatedAt: now.toISOString(),
      window: {
        timeframe,
        start: window.start.toISOString(),
        end: window.end.toISOString(),
      },
      sources: [
        {
          table: "grievances",
          rowCount: grievanceRows.length,
          organizationScoped: true,
        },
        {
          table: "compliance_alerts",
          rowCount: alertRows.length,
          organizationScoped: true,
        },
      ],
      cache: {
        namespace: CACHE_NAMESPACE,
        key: "",
        ttlSeconds: LEADERSHIP_CACHE_TTL_SECONDS,
        hit: false,
      },
    },
  };
}

export function buildExecutiveMetrics(
  grievanceRows: Array<typeof grievances.$inferSelect>,
  memberRows: Array<typeof organizationMembers.$inferSelect>,
  goalRows: Array<typeof strategicGoals.$inferSelect>,
  remittanceRows: Array<typeof employerRemittances.$inferSelect>,
  timeframe: DashboardTimeframe,
  now = new Date(),
): ExecutiveMetricsPayload {
  const window = resolveWindow(timeframe, now);

  const activeGrievances = grievanceRows.filter((g) => isOpenStatus(g.status)).length;
  const filteredGrievances = grievanceRows.filter((g) => {
    const filed = asDate(g.filedDate) ?? asDate(g.createdAt);
    return filed ? filed >= window.start : false;
  });

  const resolvedGrievances = filteredGrievances.filter((g) => isResolvedStatus(g.status)).length;
  const grievanceResolutionRate = filteredGrievances.length > 0
    ? Math.round((resolvedGrievances / filteredGrievances.length) * 100)
    : 0;

  const totalMembers = memberRows.filter((member) => !ACTIVE_MEMBER_EXCLUDE.has((member.status ?? "").toLowerCase())).length;

  const pendingApprovals = goalRows.filter((goal) => goal.status === "at-risk" || goal.status === "delayed").length;

  const upcomingMeetings = grievanceRows.filter((g) => {
    const meetingDate = asDate(g.meetingDate);
    if (!meetingDate) return false;
    const days = diffDays(now, meetingDate);
    return days >= 0 && days <= 30;
  }).length;

  const spent = remittanceRows.reduce((sum, row) => sum + asNumber(row.totalAmount), 0);
  const allocatedFromExpected = remittanceRows.reduce((sum, row) => sum + asNumber(row.expectedAmount), 0);
  const allocated = Math.max(allocatedFromExpected, spent);

  const thisMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const prevMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const currentJoins = memberRows.filter((member) => {
    const joined = asDate(member.joinedAt) ?? asDate(member.createdAt);
    return joined ? joined >= thisMonthStart : false;
  }).length;
  const previousJoins = memberRows.filter((member) => {
    const joined = asDate(member.joinedAt) ?? asDate(member.createdAt);
    return joined ? joined >= prevMonthStart && joined < thisMonthStart : false;
  }).length;

  const membershipTrend = previousJoins > 0
    ? Math.round(((currentJoins - previousJoins) / previousJoins) * 100)
    : currentJoins > 0
      ? 100
      : 0;

  return {
    totalMembers,
    activeGrievances,
    pendingApprovals,
    upcomingMeetings,
    monthlyBudget: {
      allocated,
      spent,
      currency: "CAD",
    },
    membershipTrend,
    grievanceResolutionRate,
    provenance: {
      version: CACHE_VERSION,
      generatedAt: now.toISOString(),
      window: {
        timeframe,
        start: window.start.toISOString(),
        end: window.end.toISOString(),
      },
      sources: [
        {
          table: "organization_members",
          rowCount: memberRows.length,
          organizationScoped: true,
        },
        {
          table: "grievances",
          rowCount: grievanceRows.length,
          organizationScoped: true,
        },
        {
          table: "strategic_goals",
          rowCount: goalRows.length,
          organizationScoped: true,
        },
        {
          table: "employer_remittances",
          rowCount: remittanceRows.length,
          organizationScoped: true,
        },
      ],
      cache: {
        namespace: CACHE_NAMESPACE,
        key: "",
        ttlSeconds: EXECUTIVE_CACHE_TTL_SECONDS,
        hit: false,
      },
    },
  };
}

function buildEmployerHotspots(
  grievanceRows: Array<typeof grievances.$inferSelect>,
  window: TimeWindow,
  now: Date,
  quarterStart: Date,
): LeadershipDashboardPayload["employers"] {
  const employerMap = new Map<string, {
    employerName: string;
    active: number;
    overdue: number;
    resolvedThisQuarter: number;
    categories: string[];
    resolutionDurations: number[];
    currentWindowCases: number;
    previousWindowCases: number;
    lastCommunicationDate?: Date;
  }>();

  const previousWindowStart = new Date(window.start.getTime() - (window.end.getTime() - window.start.getTime()));

  for (const grievance of grievanceRows) {
    const employerName = grievance.employerName?.trim() || "Unknown employer";
    const employerId = grievance.employerId ?? employerName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const key = `${employerId}:${employerName}`;

    const existing = employerMap.get(key) ?? {
      employerName,
      active: 0,
      overdue: 0,
      resolvedThisQuarter: 0,
      categories: [],
      resolutionDurations: [],
      currentWindowCases: 0,
      previousWindowCases: 0,
      lastCommunicationDate: undefined,
    };

    const filed = asDate(grievance.filedDate) ?? asDate(grievance.createdAt);
    const resolvedDate = resolvedDateFor(grievance);

    if (isOpenStatus(grievance.status)) {
      existing.active += 1;
      const deadline = asDate(grievance.responseDeadline);
      if (deadline && deadline < now) {
        existing.overdue += 1;
      }
    }

    if (resolvedDate && resolvedDate >= quarterStart && isResolvedStatus(grievance.status)) {
      existing.resolvedThisQuarter += 1;
    }

    if (grievance.type) {
      existing.categories.push(grievance.type);
    }

    if (filed && resolvedDate && resolvedDate >= filed && isResolvedStatus(grievance.status)) {
      existing.resolutionDurations.push(diffDays(filed, resolvedDate));
    }

    if (filed && filed >= window.start && filed < window.end) {
      existing.currentWindowCases += 1;
    }
    if (filed && filed >= previousWindowStart && filed < window.start) {
      existing.previousWindowCases += 1;
    }

    const lastDate = maxDate(
      asDate(grievance.updatedAt),
      asDate(grievance.meetingDate),
      resolvedDate,
      filed,
    );
    existing.lastCommunicationDate = maxDate(existing.lastCommunicationDate, lastDate);

    employerMap.set(key, existing);
  }

  return Array.from(employerMap.entries())
    .map(([key, stats]) => {
      const [id] = key.split(":");
      return {
        employerId: id,
        employerName: stats.employerName,
        activeGrievances: stats.active,
        overdueCases: stats.overdue,
        resolvedThisQuarter: stats.resolvedThisQuarter,
        topCategory: mostCommon(stats.categories) ?? "other",
        trend: trendFromWindow(stats.currentWindowCases, stats.previousWindowCases),
        avgResolutionDays: averageRounded(stats.resolutionDurations),
        lastCommunicationDate: stats.lastCommunicationDate?.toISOString(),
      };
    })
    .sort((a, b) => {
      const scoreA = a.overdueCases * 3 + a.activeGrievances;
      const scoreB = b.overdueCases * 3 + b.activeGrievances;
      return scoreB - scoreA;
    })
    .slice(0, 10);
}

function buildStewardCapacity(
  grievanceRows: Array<typeof grievances.$inferSelect>,
  now: Date,
  monthStart: Date,
): LeadershipDashboardPayload["stewards"] {
  const stewardMap = new Map<string, {
    activeCases: number;
    overdueCases: number;
    openDurations: number[];
    resolvedThisMonth: number;
  }>();

  for (const grievance of grievanceRows) {
    const stewardId = grievance.unionRepId;
    if (!stewardId) continue;

    const aggregate = stewardMap.get(stewardId) ?? {
      activeCases: 0,
      overdueCases: 0,
      openDurations: [],
      resolvedThisMonth: 0,
    };

    const filed = asDate(grievance.filedDate) ?? asDate(grievance.createdAt);
    if (isOpenStatus(grievance.status)) {
      aggregate.activeCases += 1;
      const deadline = asDate(grievance.responseDeadline);
      if (deadline && deadline < now) {
        aggregate.overdueCases += 1;
      }
      if (filed) {
        aggregate.openDurations.push(diffDays(filed, now));
      }
    }

    const resolvedDate = resolvedDateFor(grievance);
    if (resolvedDate && resolvedDate >= monthStart && isResolvedStatus(grievance.status)) {
      aggregate.resolvedThisMonth += 1;
    }

    stewardMap.set(stewardId, aggregate);
  }

  return Array.from(stewardMap.entries())
    .map(([stewardId, stats]) => ({
      stewardId,
      stewardName: `Steward ${stewardId.slice(0, 8)}`,
      activeCases: stats.activeCases,
      overdueCases: stats.overdueCases,
      avgDaysPerCase: averageRounded(stats.openDurations),
      resolvedThisMonth: stats.resolvedThisMonth,
      capacityLimit: 15,
    }))
    .sort((a, b) => b.activeCases - a.activeCases)
    .slice(0, 10);
}

function buildTrendSeries(
  grievanceRows: Array<typeof grievances.$inferSelect>,
  timeframe: DashboardTimeframe,
  now: Date,
): LeadershipDashboardPayload["trends"] {
  const bucketBoundaries = buildBuckets(timeframe, now);
  const trendMap = new Map<string, { filed: number; resolved: number; escalated: number }>();

  for (const bucket of bucketBoundaries) {
    trendMap.set(bucket.label, { filed: 0, resolved: 0, escalated: 0 });
  }

  for (const grievance of grievanceRows) {
    const filedDate = asDate(grievance.filedDate) ?? asDate(grievance.createdAt);
    const resolvedDate = resolvedDateFor(grievance);
    const escalatedDate = asDate(grievance.escalatedAt) ?? asDate(grievance.updatedAt);

    if (filedDate) {
      const bucket = findBucket(bucketBoundaries, filedDate);
      if (bucket) {
        trendMap.get(bucket.label)!.filed += 1;
      }
    }

    if (resolvedDate && isResolvedStatus(grievance.status)) {
      const bucket = findBucket(bucketBoundaries, resolvedDate);
      if (bucket) {
        trendMap.get(bucket.label)!.resolved += 1;
      }
    }

    if (escalatedDate && ESCALATED_STATUSES.has(grievance.status ?? "")) {
      const bucket = findBucket(bucketBoundaries, escalatedDate);
      if (bucket) {
        trendMap.get(bucket.label)!.escalated += 1;
      }
    }
  }

  return bucketBoundaries.map((bucket) => ({
    period: bucket.label,
    ...trendMap.get(bucket.label)!,
  }));
}

function resolveWindow(timeframe: DashboardTimeframe, now: Date): TimeWindow {
  switch (timeframe) {
    case "weekly": {
      const weekStart = startOfWeekUtc(now);
      const start = new Date(weekStart);
      start.setUTCDate(start.getUTCDate() - 7 * 11);
      return { timeframe, start, end: now };
    }
    case "quarterly": {
      const quarterStart = startOfQuarterUtc(now);
      const start = new Date(quarterStart);
      start.setUTCMonth(start.getUTCMonth() - 3 * 7);
      return { timeframe, start, end: now };
    }
    case "monthly":
    default: {
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const start = new Date(monthStart);
      start.setUTCMonth(start.getUTCMonth() - 11);
      return { timeframe: "monthly", start, end: now };
    }
  }
}

function buildBuckets(timeframe: DashboardTimeframe, now: Date): Array<{ label: string; start: Date; end: Date }> {
  if (timeframe === "weekly") {
    const currentWeekStart = startOfWeekUtc(now);
    return Array.from({ length: 12 }).map((_, idx) => {
      const start = new Date(currentWeekStart);
      start.setUTCDate(currentWeekStart.getUTCDate() - (11 - idx) * 7);
      const end = new Date(start);
      end.setUTCDate(start.getUTCDate() + 7);
      return {
        label: `${start.getUTCFullYear()}-W${isoWeekNumber(start).toString().padStart(2, "0")}`,
        start,
        end,
      };
    });
  }

  if (timeframe === "quarterly") {
    const currentQuarterStart = startOfQuarterUtc(now);
    return Array.from({ length: 8 }).map((_, idx) => {
      const start = new Date(currentQuarterStart);
      start.setUTCMonth(currentQuarterStart.getUTCMonth() - (7 - idx) * 3);
      const end = new Date(start);
      end.setUTCMonth(start.getUTCMonth() + 3);
      const quarter = Math.floor(start.getUTCMonth() / 3) + 1;
      return {
        label: `${start.getUTCFullYear()}-Q${quarter}`,
        start,
        end,
      };
    });
  }

  const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return Array.from({ length: 12 }).map((_, idx) => {
    const start = new Date(currentMonthStart);
    start.setUTCMonth(currentMonthStart.getUTCMonth() - (11 - idx));
    const end = new Date(start);
    end.setUTCMonth(start.getUTCMonth() + 1);
    return {
      label: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`,
      start,
      end,
    };
  });
}

function findBucket(
  buckets: Array<{ label: string; start: Date; end: Date }>,
  date: Date,
): { label: string; start: Date; end: Date } | undefined {
  return buckets.find((bucket) => date >= bucket.start && date < bucket.end);
}

function startOfWeekUtc(date: Date): Date {
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = result.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setUTCDate(result.getUTCDate() + diff);
  return result;
}

function startOfQuarterUtc(date: Date): Date {
  const month = Math.floor(date.getUTCMonth() / 3) * 3;
  return new Date(Date.UTC(date.getUTCFullYear(), month, 1));
}

function isoWeekNumber(date: Date): number {
  const temp = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  temp.setUTCDate(temp.getUTCDate() + 4 - (temp.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
  return Math.ceil((((temp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function inferTriageDate(grievance: typeof grievances.$inferSelect): Date | undefined {
  const filed = asDate(grievance.filedDate) ?? asDate(grievance.createdAt);
  const timelineEntries = Array.isArray(grievance.timeline) ? grievance.timeline : [];
  const candidateFromTimeline = timelineEntries
    .map((entry) => {
      const date = asDate(entry?.date as DateInput);
      const action = (entry?.action ?? "").toString().toLowerCase();
      const isTriageSignal = /(acknowledge|triage|investigat|assigned|response)/.test(action);
      return date && isTriageSignal ? date : null;
    })
    .filter((value): value is Date => value instanceof Date)
    .sort((a, b) => a.getTime() - b.getTime())[0];

  if (candidateFromTimeline) return candidateFromTimeline;

  if (grievance.status && OPEN_STATUSES.has(grievance.status) && grievance.status !== "draft" && grievance.status !== "new" && grievance.status !== "filed") {
    const updated = asDate(grievance.updatedAt);
    if (filed && updated && updated >= filed) {
      return updated;
    }
  }

  return undefined;
}

function resolvedDateFor(grievance: typeof grievances.$inferSelect): Date | undefined {
  return maxDate(
    asDate(grievance.resolvedAt),
    asDate(grievance.closedAt),
    isResolvedStatus(grievance.status) ? asDate(grievance.updatedAt) : undefined,
  );
}

function isOpenStatus(status: string | null): boolean {
  return OPEN_STATUSES.has(status ?? "");
}

function isResolvedStatus(status: string | null): boolean {
  return RESOLVED_STATUSES.has(status ?? "");
}

function toAlertTitle(type: string, message: string | null): string {
  const normalizedType = type
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
  const trimmedMessage = (message ?? "").trim();
  return trimmedMessage.length > 0 ? trimmedMessage : `${normalizedType} alert`;
}

function trendFromWindow(current: number, previous: number): "up" | "down" | "stable" {
  if (current > previous) return "up";
  if (current < previous) return "down";
  return "stable";
}

function mostCommon(values: string[]): string | undefined {
  if (values.length === 0) return undefined;
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  let topValue: string | undefined;
  let topCount = -1;
  for (const [value, count] of counts) {
    if (count > topCount) {
      topValue = value;
      topCount = count;
    }
  }
  return topValue;
}

function asDate(value: DateInput): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function asNumber(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function diffDays(start: Date, end: Date): number {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
}

function averageRounded(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function maxDate(...values: Array<Date | undefined>): Date | undefined {
  return values
    .filter((value): value is Date => value instanceof Date)
    .sort((a, b) => b.getTime() - a.getTime())[0];
}
