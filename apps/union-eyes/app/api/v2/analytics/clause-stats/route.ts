/**
 * GET /api/v2/analytics/clause-stats
 * Governed cross-union clause library statistics.
 * Requires VIEW_CONGRESS_ANALYTICS permission + affiliate consent.
 * Query params: fromDate, toDate, sector
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import {
  sharedClauseLibrary,
  crossOrgAccessLog,
  organizations,
} from '@/db/schema';
import { sql, gte, lte, eq, desc, and, ne, inArray } from 'drizzle-orm';
import { runGovernedCrossUnionAggregation, resolveGovernanceContext } from '@/lib/clc/governance';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'clc_staff' },
    openapi: {
      tags: ['Analytics', 'Cross-Union'],
      summary: 'Clause library statistics (governed)',
      description:
        'Aggregate clause stats: totals, distributions, top items, recent activity. Governed by consent and cohort thresholds.',
    },
  },
  async ({ request, userId, organizationId }) => {
    const govCtx = await resolveGovernanceContext(userId!, organizationId);
    const url = new URL(request.url);
    const fromDate = url.searchParams.get('fromDate');
    const toDate = url.searchParams.get('toDate');
    const sector = url.searchParams.get('sector');

    return runGovernedCrossUnionAggregation(
      {
        context: govCtx,
        requiredPermission: 'view_congress_analytics',
        operationLabel: 'clause-stats',
        participationDimension: 'crossUnionAnalytics',
      },
      async (consentedOrgIds) => {
        // Build where conditions — only shared clauses from consented orgs
        const clauseConditions = [
          ne(sharedClauseLibrary.sharingLevel, 'private'),
          inArray(sharedClauseLibrary.sourceOrganizationId, consentedOrgIds),
        ];
        if (sector) clauseConditions.push(eq(sharedClauseLibrary.sector, sector));

        const where = and(...clauseConditions);

        const [statsResult, clauseTypeDistribution, sectorDistribution, mostCited, mostViewed] =
          await Promise.all([
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

            db
              .select({
                id: sharedClauseLibrary.id,
                clauseTitle: sharedClauseLibrary.clauseTitle,
                clauseType: sharedClauseLibrary.clauseType,
                sector: sharedClauseLibrary.sector,
                citationCount: sharedClauseLibrary.citationCount,
                viewCount: sharedClauseLibrary.viewCount,
              })
              .from(sharedClauseLibrary)
              .where(where)
              .orderBy(desc(sharedClauseLibrary.citationCount))
              .limit(10),

            db
              .select({
                id: sharedClauseLibrary.id,
                clauseTitle: sharedClauseLibrary.clauseTitle,
                clauseType: sharedClauseLibrary.clauseType,
                sector: sharedClauseLibrary.sector,
                citationCount: sharedClauseLibrary.citationCount,
                viewCount: sharedClauseLibrary.viewCount,
              })
              .from(sharedClauseLibrary)
              .where(where)
              .orderBy(desc(sharedClauseLibrary.viewCount))
              .limit(10),
          ]);

        // Recent cross-org clause activity (scoped to consented orgs)
        const accessConditions = [
          eq(crossOrgAccessLog.resourceType, 'clause'),
          inArray(crossOrgAccessLog.resourceOrganizationId, consentedOrgIds),
        ];
        if (fromDate) accessConditions.push(gte(crossOrgAccessLog.createdAt, new Date(fromDate)));
        if (toDate) accessConditions.push(lte(crossOrgAccessLog.createdAt, new Date(toDate)));

        const recentActivity = await db
          .select({
            id: crossOrgAccessLog.id,
            accessType: crossOrgAccessLog.accessType,
            clauseTitle: sharedClauseLibrary.clauseTitle,
            accessedAt: crossOrgAccessLog.createdAt,
          })
          .from(crossOrgAccessLog)
          .leftJoin(sharedClauseLibrary, eq(crossOrgAccessLog.resourceId, sharedClauseLibrary.id))
          .where(and(...accessConditions))
          .orderBy(desc(crossOrgAccessLog.createdAt))
          .limit(20);

        return {
          statistics: statsResult,
          clauseTypeDistribution,
          sectorDistribution,
          mostCited,
          mostViewed,
          recentActivity: recentActivity.map((r) => ({
            id: r.id,
            accessType: r.accessType,
            clauseTitle: r.clauseTitle,
            accessedAt: r.accessedAt,
          })),
        };
      },
    );
  },
);
