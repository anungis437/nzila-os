/**
 * GET /api/v2/analytics/clause-stats
 * Direct DB — clause library statistics for cross-union analytics.
 * Query params: fromDate, toDate, sector
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import {
  sharedClauseLibrary,
  crossOrgAccessLog,
  organizations,
} from '@/db/schema';
import { sql, gte, lte, eq, desc, and, ne } from 'drizzle-orm';
import { withSystemContext } from '@/lib/db/with-rls-context';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ['Analytics', 'Cross-Union'],
      summary: 'Clause library statistics',
      description: 'Aggregate clause stats: totals, distributions, top items, recent activity.',
    },
  },
  async ({ request }) => {
    return withSystemContext(async () => {
      const url = new URL(request.url);
      const fromDate = url.searchParams.get('fromDate');
      const toDate = url.searchParams.get('toDate');
      const sector = url.searchParams.get('sector');

      // Build where conditions — only shared clauses
      const clauseConditions = [ne(sharedClauseLibrary.sharingLevel, 'private')];
      if (sector) clauseConditions.push(eq(sharedClauseLibrary.sector, sector));

      const where = and(...clauseConditions);

      const [statsResult, clauseTypeDistribution, sectorDistribution, mostCited, mostViewed] =
        await Promise.all([
          // Aggregate statistics
          db
            .select({
              totalClauses: sql<number>`count(*)::int`,
              totalViews: sql<number>`coalesce(sum(${sharedClauseLibrary.viewCount}), 0)::int`,
              totalCitations: sql<number>`coalesce(sum(${sharedClauseLibrary.citationCount}), 0)::int`,
              totalComparisons: sql<number>`coalesce(sum(${sharedClauseLibrary.comparisonCount}), 0)::int`,
              uniqueOrgs: sql<number>`count(distinct ${sharedClauseLibrary.sourceOrganizationId})::int`,
            })
            .from(sharedClauseLibrary)
            .where(where)
            .then((r) => r[0]),

          // Clause type distribution
          db
            .select({
              clauseType: sharedClauseLibrary.clauseType,
              count: sql<number>`count(*)::int`,
            })
            .from(sharedClauseLibrary)
            .where(where)
            .groupBy(sharedClauseLibrary.clauseType)
            .orderBy(desc(sql`count(*)`))
            .limit(20),

          // Sector distribution
          db
            .select({
              sector: sharedClauseLibrary.sector,
              count: sql<number>`count(*)::int`,
            })
            .from(sharedClauseLibrary)
            .where(where)
            .groupBy(sharedClauseLibrary.sector)
            .orderBy(desc(sql`count(*)`))
            .limit(20),

          // Most cited
          db
            .select({
              id: sharedClauseLibrary.id,
              clauseTitle: sharedClauseLibrary.clauseTitle,
              clauseType: sharedClauseLibrary.clauseType,
              sector: sharedClauseLibrary.sector,
              citationCount: sharedClauseLibrary.citationCount,
              viewCount: sharedClauseLibrary.viewCount,
              orgName: organizations.name,
            })
            .from(sharedClauseLibrary)
            .leftJoin(organizations, eq(sharedClauseLibrary.sourceOrganizationId, organizations.id))
            .where(where)
            .orderBy(desc(sharedClauseLibrary.citationCount))
            .limit(10),

          // Most viewed
          db
            .select({
              id: sharedClauseLibrary.id,
              clauseTitle: sharedClauseLibrary.clauseTitle,
              clauseType: sharedClauseLibrary.clauseType,
              sector: sharedClauseLibrary.sector,
              citationCount: sharedClauseLibrary.citationCount,
              viewCount: sharedClauseLibrary.viewCount,
              orgName: organizations.name,
            })
            .from(sharedClauseLibrary)
            .leftJoin(organizations, eq(sharedClauseLibrary.sourceOrganizationId, organizations.id))
            .where(where)
            .orderBy(desc(sharedClauseLibrary.viewCount))
            .limit(10),
        ]);

      // Recent cross-org clause activity
      const accessConditions = [eq(crossOrgAccessLog.resourceType, 'clause')];
      if (fromDate) accessConditions.push(gte(crossOrgAccessLog.createdAt, new Date(fromDate)));
      if (toDate) accessConditions.push(lte(crossOrgAccessLog.createdAt, new Date(toDate)));

      const recentActivity = await db
        .select({
          id: crossOrgAccessLog.id,
          accessType: crossOrgAccessLog.accessType,
          clauseTitle: sharedClauseLibrary.clauseTitle,
          accessedAt: crossOrgAccessLog.createdAt,
          userOrgName: sql<string>`uo.name`,
          resourceOrgName: sql<string>`ro.name`,
        })
        .from(crossOrgAccessLog)
        .leftJoin(sharedClauseLibrary, eq(crossOrgAccessLog.resourceId, sharedClauseLibrary.id))
        .innerJoin(sql`${organizations} uo`, sql`uo.id = ${crossOrgAccessLog.userOrganizationId}`)
        .innerJoin(sql`${organizations} ro`, sql`ro.id = ${crossOrgAccessLog.resourceOrganizationId}`)
        .where(and(...accessConditions))
        .orderBy(desc(crossOrgAccessLog.createdAt))
        .limit(20);

      const shapeClauses = (rows: typeof mostCited) =>
        rows.map((r) => ({
          id: r.id,
          clauseTitle: r.clauseTitle,
          clauseType: r.clauseType,
          sector: r.sector,
          citationCount: r.citationCount,
          viewCount: r.viewCount,
          sourceOrganization: { name: r.orgName },
        }));

      return {
        statistics: statsResult,
        clauseTypeDistribution,
        sectorDistribution,
        mostCited: shapeClauses(mostCited),
        mostViewed: shapeClauses(mostViewed),
        recentActivity: recentActivity.map((r) => ({
          id: r.id,
          accessType: r.accessType,
          clauseTitle: r.clauseTitle,
          accessedAt: r.accessedAt,
          userOrganization: { name: r.userOrgName },
          resourceOwnerOrganization: { name: r.resourceOrgName },
        })),
      };
    });
  },
);
