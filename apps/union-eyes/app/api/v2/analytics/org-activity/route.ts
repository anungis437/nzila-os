/**
 * GET /api/v2/analytics/org-activity
 * Governed cross-union organization activity statistics.
 * Requires VIEW_CONGRESS_ANALYTICS permission + affiliate consent.
 * Aggregated to org-type level to prevent re-identification (MG-003).
 * Query params: fromDate, toDate, organizationLevel
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import {
  crossOrgAccessLog,
  organizations,
  organizationSharingSettings,
} from '@/db/schema';
import { sql, gte, lte, eq, desc, and, inArray, type SQL } from 'drizzle-orm';
import { runGovernedCrossUnionAggregation, resolveGovernanceContext } from '@/lib/clc/governance';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'clc_staff' },
    openapi: {
      tags: ['Analytics', 'Cross-Union'],
      summary: 'Organization activity statistics (governed)',
      description:
        'Cross-org access logs, daily trends, sharing adoption. Aggregated to org-type level. Governed by consent and cohort thresholds.',
    },
  },
  async ({ request, userId, organizationId }) => {
    const govCtx = await resolveGovernanceContext(userId!, organizationId);
    const url = new URL(request.url);
    const fromDate = url.searchParams.get('fromDate');
    const toDate = url.searchParams.get('toDate');
    const organizationLevel = url.searchParams.get('organizationLevel');

    return runGovernedCrossUnionAggregation(
      {
        context: govCtx,
        requiredPermission: 'view_congress_analytics',
        operationLabel: 'org-activity',
        participationDimension: 'crossUnionAnalytics',
      },
      async (consentedOrgIds) => {
        // Build date conditions for access log — scoped to consented orgs
        const accessConditions: SQL[] = [
          inArray(crossOrgAccessLog.resourceOrganizationId, consentedOrgIds),
        ];
        if (fromDate) accessConditions.push(gte(crossOrgAccessLog.createdAt, new Date(fromDate)));
        if (toDate) accessConditions.push(lte(crossOrgAccessLog.createdAt, new Date(toDate)));

        const accessWhere = and(...accessConditions);

        // Overall statistics (aggregated — no identifiable data)
        const [statsResult] = await db
          .select({
            totalAccesses: sql<number>`count(*)::int`,
            uniqueUsers: sql<number>`count(distinct ${crossOrgAccessLog.userId})::int`,
            uniqueAccessorOrgs: sql<number>`count(distinct ${crossOrgAccessLog.userOrganizationId})::int`,
            totalCrossOrgAccesses: sql<number>`count(*) filter (where ${crossOrgAccessLog.userOrganizationId} != ${crossOrgAccessLog.resourceOrganizationId})::int`,
          })
          .from(crossOrgAccessLog)
          .where(accessWhere);

        // Daily activity trend
        const dailyActivity = await db
          .select({
            date: sql<string>`to_char(${crossOrgAccessLog.createdAt}, 'YYYY-MM-DD')`,
            totalAccesses: sql<number>`count(*)::int`,
            clauseAccesses: sql<number>`count(*) filter (where ${crossOrgAccessLog.resourceType} = 'clause')::int`,
            precedentAccesses: sql<number>`count(*) filter (where ${crossOrgAccessLog.resourceType} = 'precedent')::int`,
          })
          .from(crossOrgAccessLog)
          .where(accessWhere)
          .groupBy(sql`to_char(${crossOrgAccessLog.createdAt}, 'YYYY-MM-DD')`)
          .orderBy(sql`to_char(${crossOrgAccessLog.createdAt}, 'YYYY-MM-DD')`);

        // Access type breakdown
        const accessTypeBreakdown = await db
          .select({
            accessType: crossOrgAccessLog.accessType,
            count: sql<number>`count(*)::int`,
          })
          .from(crossOrgAccessLog)
          .where(accessWhere)
          .groupBy(crossOrgAccessLog.accessType)
          .orderBy(desc(sql`count(*)`));

        // Organization-type level breakdown (aggregated — NOT per-org)
        const orgLevelFilter = organizationLevel && organizationLevel !== 'all'
          ? eq(organizations.organizationType, organizationLevel as typeof organizations.organizationType.enumValues[number])
          : undefined;

        const combinedWhere = [accessWhere, orgLevelFilter].filter((c): c is SQL => c != null);

        const orgLevelBreakdown = await db
          .select({
            organizationLevel: organizations.organizationType,
            totalAccesses: sql<number>`count(*)::int`,
            uniqueOrgs: sql<number>`count(distinct ${crossOrgAccessLog.userOrganizationId})::int`,
            clauseAccesses: sql<number>`count(*) filter (where ${crossOrgAccessLog.resourceType} = 'clause')::int`,
            precedentAccesses: sql<number>`count(*) filter (where ${crossOrgAccessLog.resourceType} = 'precedent')::int`,
          })
          .from(crossOrgAccessLog)
          .innerJoin(organizations, eq(crossOrgAccessLog.userOrganizationId, organizations.id))
          .where(combinedWhere.length > 0 ? and(...combinedWhere) : undefined)
          .groupBy(organizations.organizationType)
          .orderBy(desc(sql`count(*)`));

        // Sharing adoption (scoped to consented orgs)
        const [sharingAdoption] = await db
          .select({
            totalOrgs: sql<number>`count(*)::int`,
            clauseSharingEnabled: sql<number>`count(*) filter (where ${organizationSharingSettings.autoShareClauses} = true)::int`,
            precedentSharingEnabled: sql<number>`count(*) filter (where ${organizationSharingSettings.autoSharePrecedents} = true)::int`,
            analyticsSharingEnabled: sql<number>`count(*) filter (where ${organizationSharingSettings.allowFederationSharing} = true)::int`,
          })
          .from(organizationSharingSettings)
          .where(inArray(organizationSharingSettings.organizationId, consentedOrgIds));

        return {
          statistics: statsResult,
          dailyActivity,
          accessTypeBreakdown,
          orgLevelBreakdown,
          sharingAdoption,
        };
      },
    );
  },
);
