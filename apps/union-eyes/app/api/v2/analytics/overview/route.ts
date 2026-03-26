/**
 * GET /api/v2/analytics/overview
 * Direct DB — aggregates grievances, claims, and members for the analytics dashboard.
 * Returns: { metrics, chartData, categoryBreakdown, topStewards, quickStats }
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { grievances } from '@/db/schema';
import { claims } from '@/db/schema';
import { organizationMembers } from '@/db/schema';
import { sql, gte, lt, and, inArray, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const RESOLVED_GRIEVANCE_STATUSES = ['settled', 'withdrawn', 'denied', 'closed'] as const;
const RESOLVED_CLAIM_STATUSES = ['resolved', 'rejected', 'closed'] as const;

const TYPE_COLORS: Record<string, string> = {
  individual: 'bg-blue-500',
  group: 'bg-green-500',
  policy: 'bg-yellow-500',
  contract: 'bg-purple-500',
  harassment: 'bg-red-500',
  discrimination: 'bg-orange-500',
  safety: 'bg-teal-500',
  seniority: 'bg-indigo-500',
  discipline: 'bg-pink-500',
  termination: 'bg-rose-500',
  other: 'bg-gray-500',
};

function getStartDate(range: string): Date | null {
  const now = new Date();
  switch (range) {
    case '7d': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case '90d': return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case '1y': return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    case 'all': return null;
    default: return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
}

function getPreviousPeriodStart(range: string): Date | null {
  const now = new Date();
  switch (range) {
    case '7d': return new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    case '30d': return new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    case '90d': return new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    case '1y': return new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
    case 'all': return null;
    default: return new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  }
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

export const GET = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ['Analytics'],
      summary: 'Analytics overview dashboard data',
      description: 'Aggregates grievances, claims and members into dashboard metrics, chart data, category breakdown, top stewards, and quick stats.',
    },
  },
  async ({ request, organizationId }) => {
    const url = new URL(request.url);
    const range = url.searchParams.get('range') || '30d';
    const startDate = getStartDate(range);
    const prevStart = getPreviousPeriodStart(range);

    // --- Org-scoped filters ---
    const grievanceOrgFilter = organizationId ? eq(grievances.organizationId, organizationId) : undefined;
    const claimOrgFilter = organizationId ? eq(claims.organizationId, organizationId) : undefined;
    const memberOrgFilter = organizationId ? eq(organizationMembers.organizationId, organizationId) : undefined;

    // --- Grievance counts ---
    const grievanceDateFilter = startDate
        ? and(gte(grievances.createdAt, startDate), grievanceOrgFilter)
        : grievanceOrgFilter;
      const prevGrievanceDateFilter = prevStart && startDate
        ? and(gte(grievances.createdAt, prevStart), lt(grievances.createdAt, startDate), grievanceOrgFilter)
        : undefined;

      const [
        grievanceTotal,
        grievanceResolved,
        prevGrievanceTotal,
        prevGrievanceResolved,
        claimTotal,
        claimResolved,
        prevClaimTotal,
        memberTotal,
        stewardTotal,
        grievanceByType,
        monthlyGrievances,
        topReps,
        avgResponseResult,
      ] = await Promise.all([
        // Current period grievances
        db.select({ count: sql<number>`count(*)::int` })
          .from(grievances)
          .where(grievanceDateFilter)
          .then(r => r[0]?.count ?? 0),

        // Current period resolved grievances
        db.select({ count: sql<number>`count(*)::int` })
          .from(grievances)
          .where(grievanceDateFilter
            ? and(grievanceDateFilter, inArray(grievances.status, [...RESOLVED_GRIEVANCE_STATUSES]))
            : inArray(grievances.status, [...RESOLVED_GRIEVANCE_STATUSES]))
          .then(r => r[0]?.count ?? 0),

        // Previous period grievances
        prevGrievanceDateFilter
          ? db.select({ count: sql<number>`count(*)::int` })
              .from(grievances)
              .where(prevGrievanceDateFilter)
              .then(r => r[0]?.count ?? 0)
          : Promise.resolve(0),

        // Previous period resolved grievances
        prevGrievanceDateFilter
          ? db.select({ count: sql<number>`count(*)::int` })
              .from(grievances)
              .where(and(prevGrievanceDateFilter, inArray(grievances.status, [...RESOLVED_GRIEVANCE_STATUSES])))
              .then(r => r[0]?.count ?? 0)
          : Promise.resolve(0),

        // Current period claims
        db.select({ count: sql<number>`count(*)::int` })
          .from(claims)
          .where(startDate ? and(gte(claims.createdAt, startDate), claimOrgFilter) : claimOrgFilter)
          .then(r => r[0]?.count ?? 0),

        // Current period resolved claims
        db.select({ count: sql<number>`count(*)::int` })
          .from(claims)
          .where(startDate
            ? and(gte(claims.createdAt, startDate), inArray(claims.status, [...RESOLVED_CLAIM_STATUSES]), claimOrgFilter)
            : and(inArray(claims.status, [...RESOLVED_CLAIM_STATUSES]), claimOrgFilter))
          .then(r => r[0]?.count ?? 0),

        // Previous period claims
        prevStart && startDate
          ? db.select({ count: sql<number>`count(*)::int` })
              .from(claims)
              .where(and(gte(claims.createdAt, prevStart), lt(claims.createdAt, startDate), claimOrgFilter))
              .then(r => r[0]?.count ?? 0)
          : Promise.resolve(0),

        // Total members
        db.select({ count: sql<number>`count(*)::int` })
          .from(organizationMembers)
          .where(memberOrgFilter)
          .then(r => r[0]?.count ?? 0),

        // Active stewards (role contains 'steward')
        db.select({ count: sql<number>`count(*)::int` })
          .from(organizationMembers)
          .where(memberOrgFilter
            ? and(sql`lower(${organizationMembers.role}) LIKE '%steward%'`, memberOrgFilter)
            : sql`lower(${organizationMembers.role}) LIKE '%steward%'`)
          .then(r => r[0]?.count ?? 0),

        // Grievances by type
        db.select({
          type: grievances.type,
          count: sql<number>`count(*)::int`,
        })
          .from(grievances)
          .where(grievanceDateFilter)
          .groupBy(grievances.type)
          .orderBy(sql`count(*) DESC`),

        // Monthly trend (last 6 months from the range end)
        db.select({
          month: sql<string>`to_char(${grievances.createdAt}, 'Mon')`,
          monthNum: sql<number>`extract(month from ${grievances.createdAt})::int`,
          yearNum: sql<number>`extract(year from ${grievances.createdAt})::int`,
          total: sql<number>`count(*)::int`,
          resolved: sql<number>`count(*) FILTER (WHERE ${grievances.status} IN ('settled','withdrawn','denied','closed'))::int`,
        })
          .from(grievances)
          .where(grievanceDateFilter)
          .groupBy(
            sql`to_char(${grievances.createdAt}, 'Mon')`,
            sql`extract(month from ${grievances.createdAt})`,
            sql`extract(year from ${grievances.createdAt})`,
          )
          .orderBy(
            sql`extract(year from ${grievances.createdAt})`,
            sql`extract(month from ${grievances.createdAt})`,
          )
          .limit(12),

        // Top union reps by cases handled
        db.select({
          repId: grievances.unionRepId,
          total: sql<number>`count(*)::int`,
          resolved: sql<number>`count(*) FILTER (WHERE ${grievances.status} IN ('settled','withdrawn','denied','closed'))::int`,
        })
          .from(grievances)
          .where(grievanceDateFilter
            ? and(grievanceDateFilter, sql`${grievances.unionRepId} IS NOT NULL`)
            : and(sql`${grievances.unionRepId} IS NOT NULL`, grievanceOrgFilter))
          .groupBy(grievances.unionRepId)
          .orderBy(sql`count(*) DESC`)
          .limit(5),

        // Average response time (filedDate to resolvedAt) in hours
        db.select({
          avgHrs: sql<number>`COALESCE(
            ROUND(AVG(EXTRACT(EPOCH FROM (${grievances.resolvedAt} - ${grievances.filedDate})) / 3600)::numeric, 1),
            0
          )::float`,
        })
          .from(grievances)
          .where(grievanceDateFilter
            ? and(grievanceDateFilter, sql`${grievances.resolvedAt} IS NOT NULL`, sql`${grievances.filedDate} IS NOT NULL`)
            : and(sql`${grievances.resolvedAt} IS NOT NULL`, sql`${grievances.filedDate} IS NOT NULL`, grievanceOrgFilter))
          .then(r => r[0]?.avgHrs ?? 0),
      ]);

      // --- Build response ---

      const totalCases = grievanceTotal + claimTotal;
      const totalResolved = grievanceResolved + claimResolved;
      const openCases = totalCases - totalResolved;
      const prevTotal = prevGrievanceTotal + prevClaimTotal;
      const prevResolved = prevGrievanceResolved;
      const resolutionRate = totalCases > 0 ? Math.round((totalResolved / totalCases) * 100) : 0;
      const prevResolutionRate = prevTotal > 0 ? Math.round((prevResolved / prevTotal) * 100) : 0;

      // Metrics cards
      const metrics = [
        {
          label: 'Total Cases',
          value: totalCases,
          change: pctChange(totalCases, prevTotal),
          changeLabel: `vs previous period`,
          color: 'text-blue-600 bg-blue-100',
        },
        {
          label: 'Resolved',
          value: totalResolved,
          change: pctChange(totalResolved, prevResolved),
          changeLabel: `${resolutionRate}% resolution rate`,
          color: 'text-green-600 bg-green-100',
        },
        {
          label: 'Active Members',
          value: memberTotal,
          change: 0,
          changeLabel: `${stewardTotal} stewards`,
          color: 'text-purple-600 bg-purple-100',
        },
        {
          label: 'Open Cases',
          value: openCases,
          change: pctChange(openCases, prevTotal > 0 ? prevTotal - prevResolved : 0),
          changeLabel: 'pending resolution',
          color: 'text-orange-600 bg-orange-100',
        },
        {
          label: 'Avg Response Time',
          value: `${avgResponseResult}h`,
          change: 0,
          changeLabel: 'filed to resolved',
          color: 'text-teal-600 bg-teal-100',
        },
        {
          label: 'Resolution Rate',
          value: `${resolutionRate}%`,
          change: pctChange(resolutionRate, prevResolutionRate),
          changeLabel: `vs previous period`,
          color: 'text-indigo-600 bg-indigo-100',
        },
      ];

      // Chart data (monthly)
      const chartData = monthlyGrievances.map(m => ({
        month: m.month,
        cases: m.total,
        resolved: m.resolved,
        pending: m.total - m.resolved,
      }));

      // Category breakdown
      const totalByType = grievanceByType.reduce((sum, r) => sum + r.count, 0);
      const categoryBreakdown = grievanceByType.map(r => ({
        category: r.type.charAt(0).toUpperCase() + r.type.slice(1).replace(/_/g, ' '),
        count: r.count,
        percentage: totalByType > 0 ? Math.round((r.count / totalByType) * 100) : 0,
        color: TYPE_COLORS[r.type] || 'bg-gray-500',
      }));

      // Top stewards — look up names from org members
      const repIds = topReps.map(r => r.repId).filter((id): id is string => id !== null);
      let repNameMap: Record<string, string> = {};
      if (repIds.length > 0) {
        const members = await db.select({
          userId: organizationMembers.userId,
          name: organizationMembers.name,
        })
          .from(organizationMembers)
          .where(inArray(organizationMembers.userId, repIds));
        repNameMap = Object.fromEntries(members.map(m => [m.userId, m.name || 'Unknown']));
      }
      const topStewards = topReps.map((r, i) => ({
        name: (r.repId && repNameMap[r.repId]) || `Steward ${i + 1}`,
        cases: r.total,
        resolved: r.resolved,
        rate: r.total > 0 ? Math.round((r.resolved / r.total) * 100) : 0,
      }));

      // Quick stats
      const quickStats = {
        openCases,
        resolved: totalResolved,
        avgResponseHrs: avgResponseResult,
        activeStewards: stewardTotal,
        openPct: totalCases > 0 ? `${Math.round((openCases / totalCases) * 100)}%` : '0%',
        resolvedPct: totalCases > 0 ? `${resolutionRate}%` : '0%',
        stewardPct: memberTotal > 0 ? `${Math.round((stewardTotal / memberTotal) * 100)}%` : '0%',
      };

      return { metrics, chartData, categoryBreakdown, topStewards, quickStats };
  },
);
