/**
 * GET /api/v2/analytics/precedent-stats
 * Governed cross-union arbitration precedent statistics.
 * Requires VIEW_CONGRESS_ANALYTICS permission + affiliate consent.
 * Query params: fromDate, toDate, sector
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { arbitrationPrecedents } from '@/db/schema';
import { sql, eq, desc, and, ne, inArray } from 'drizzle-orm';
import { runGovernedCrossUnionAggregation, resolveGovernanceContext } from '@/lib/clc/governance';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'clc_staff' },
    openapi: {
      tags: ['Analytics', 'Cross-Union'],
      summary: 'Precedent statistics (governed)',
      description:
        'Aggregate precedent stats: totals, distributions, top items, top arbitrators. Governed by consent and cohort thresholds.',
    },
  },
  async ({ request, userId, organizationId }) => {
    const govCtx = await resolveGovernanceContext(userId!, organizationId);
    const url = new URL(request.url);
    const sector = url.searchParams.get('sector');

    return runGovernedCrossUnionAggregation(
      {
        context: govCtx,
        requiredPermission: 'view_congress_analytics',
        operationLabel: 'precedent-stats',
        participationDimension: 'crossUnionAnalytics',
      },
      async (consentedOrgIds) => {
        // Build where — only shared precedents from consented orgs
        const conditions = [
          ne(arbitrationPrecedents.sharingLevel, 'private'),
          inArray(arbitrationPrecedents.sourceOrganizationId, consentedOrgIds),
        ];
        if (sector) conditions.push(eq(arbitrationPrecedents.sector, sector));
        const where = and(...conditions);

        const [statsResult, outcomeDistribution, grievanceTypeDistribution, topArbitrators, mostCited, mostViewed] =
          await Promise.all([
            db
              .select({
                totalPrecedents: sql<number>`count(*)::int`,
                totalViews: sql<number>`coalesce(sum(${arbitrationPrecedents.viewCount}), 0)::int`,
                totalCitations: sql<number>`coalesce(sum(${arbitrationPrecedents.citationCount}), 0)::int`,
                totalDownloads: sql<number>`coalesce(sum(${arbitrationPrecedents.downloadCount}), 0)::int`,
                uniqueArbitrators: sql<number>`count(distinct ${arbitrationPrecedents.arbitratorName})::int`,
              })
              .from(arbitrationPrecedents)
              .where(where)
              .then((r) => r[0]),

            db
              .select({
                outcome: arbitrationPrecedents.outcome,
                count: sql<number>`count(*)::int`,
              })
              .from(arbitrationPrecedents)
              .where(where)
              .groupBy(arbitrationPrecedents.outcome)
              .orderBy(desc(sql`count(*)`))
              .limit(20),

            db
              .select({
                grievanceType: arbitrationPrecedents.grievanceType,
                count: sql<number>`count(*)::int`,
              })
              .from(arbitrationPrecedents)
              .where(where)
              .groupBy(arbitrationPrecedents.grievanceType)
              .orderBy(desc(sql`count(*)`))
              .limit(20),

            db
              .select({
                arbitratorName: arbitrationPrecedents.arbitratorName,
                count: sql<number>`count(*)::int`,
                totalCitations: sql<number>`coalesce(sum(${arbitrationPrecedents.citationCount}), 0)::int`,
                uphelds: sql<number>`count(*) filter (where ${arbitrationPrecedents.outcome} = 'upheld')::int`,
                dismissed: sql<number>`count(*) filter (where ${arbitrationPrecedents.outcome} = 'dismissed')::int`,
              })
              .from(arbitrationPrecedents)
              .where(where)
              .groupBy(arbitrationPrecedents.arbitratorName)
              .orderBy(desc(sql`count(*)`))
              .limit(20),

            db
              .select({
                id: arbitrationPrecedents.id,
                caseNumber: arbitrationPrecedents.caseNumber,
                caseTitle: arbitrationPrecedents.caseTitle,
                arbitratorName: arbitrationPrecedents.arbitratorName,
                jurisdiction: arbitrationPrecedents.jurisdiction,
                outcome: arbitrationPrecedents.outcome,
                precedentialValue: arbitrationPrecedents.precedentialValue,
                citationCount: arbitrationPrecedents.citationCount,
                viewCount: arbitrationPrecedents.viewCount,
              })
              .from(arbitrationPrecedents)
              .where(where)
              .orderBy(desc(arbitrationPrecedents.citationCount))
              .limit(10),

            db
              .select({
                id: arbitrationPrecedents.id,
                caseNumber: arbitrationPrecedents.caseNumber,
                caseTitle: arbitrationPrecedents.caseTitle,
                arbitratorName: arbitrationPrecedents.arbitratorName,
                jurisdiction: arbitrationPrecedents.jurisdiction,
                outcome: arbitrationPrecedents.outcome,
                precedentialValue: arbitrationPrecedents.precedentialValue,
                citationCount: arbitrationPrecedents.citationCount,
                viewCount: arbitrationPrecedents.viewCount,
              })
              .from(arbitrationPrecedents)
              .where(where)
              .orderBy(desc(arbitrationPrecedents.viewCount))
              .limit(10),
          ]);

        return {
          statistics: statsResult,
          outcomeDistribution,
          grievanceTypeDistribution,
          topArbitrators,
          mostCited: mostCited.map((p) => ({
            ...p,
            precedentLevel: p.precedentialValue,
          })),
          mostViewed: mostViewed.map((p) => ({
            ...p,
            precedentLevel: p.precedentialValue,
          })),
        };
      },
    );
  },
);
