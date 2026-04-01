/**
 * GET /api/v2/analytics/precedent-stats
 * Direct DB — arbitration precedent statistics for cross-union analytics.
 * Query params: fromDate, toDate, sector
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { arbitrationPrecedents } from '@/db/schema';
import { sql, eq, desc, and, ne } from 'drizzle-orm';
import { withSystemContext } from '@/lib/db/with-rls-context';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ['Analytics', 'Cross-Union'],
      summary: 'Precedent statistics',
      description: 'Aggregate precedent stats: totals, distributions, top items, top arbitrators.',
    },
  },
  async ({ request }) => {
    return withSystemContext(async () => {
      const url = new URL(request.url);
      const sector = url.searchParams.get('sector');

      // Build where — only shared precedents
      const conditions = [ne(arbitrationPrecedents.sharingLevel, 'private')];
      if (sector) conditions.push(eq(arbitrationPrecedents.sector, sector));
      const where = and(...conditions);

      const [statsResult, outcomeDistribution, grievanceTypeDistribution, topArbitrators, mostCited, mostViewed] =
        await Promise.all([
          // Aggregate statistics
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

          // Outcome distribution
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

          // Grievance type distribution
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

          // Top arbitrators
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

          // Most cited
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

          // Most viewed
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
    });
  },
);
