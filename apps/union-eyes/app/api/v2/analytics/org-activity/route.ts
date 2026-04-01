/**
 * GET /api/v2/analytics/org-activity
 * Direct DB — organization activity statistics for cross-union analytics.
 * Query params: fromDate, toDate, sector, organizationLevel
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import {
  crossOrgAccessLog,
  organizations,
  organizationSharingSettings,
  sharedClauseLibrary,
  arbitrationPrecedents,
} from '@/db/schema';
import { sql, gte, lte, eq, desc, and, type SQL } from 'drizzle-orm';
import { withSystemContext } from '@/lib/db/with-rls-context';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ['Analytics', 'Cross-Union'],
      summary: 'Organization activity statistics',
      description: 'Cross-org access logs, daily trends, sharing adoption, top orgs.',
    },
  },
  async ({ request }) => {
    return withSystemContext(async () => {
      const url = new URL(request.url);
      const fromDate = url.searchParams.get('fromDate');
      const toDate = url.searchParams.get('toDate');
      const organizationLevel = url.searchParams.get('organizationLevel');

      // Build date conditions for access log
      const accessConditions: SQL[] = [];
      if (fromDate) accessConditions.push(gte(crossOrgAccessLog.createdAt, new Date(fromDate)));
      if (toDate) accessConditions.push(lte(crossOrgAccessLog.createdAt, new Date(toDate)));

      const accessWhere = accessConditions.length > 0 ? and(...accessConditions) : undefined;

      // Overall statistics
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

      // Most active organizations (accessor side)
      const orgLevelFilter = organizationLevel && organizationLevel !== 'all'
        ? eq(organizations.organizationType, organizationLevel as typeof organizations.organizationType.enumValues[number])
        : undefined;

      const combinedWhere = [accessWhere, orgLevelFilter].filter((c): c is SQL => c != null);

      const mostActiveOrgs = await db
        .select({
          organizationId: crossOrgAccessLog.userOrganizationId,
          organizationName: organizations.name,
          organizationLevel: organizations.organizationType,
          totalAccesses: sql<number>`count(*)::int`,
          views: sql<number>`count(*) filter (where ${crossOrgAccessLog.accessType} = 'view')::int`,
          clauseAccesses: sql<number>`count(*) filter (where ${crossOrgAccessLog.resourceType} = 'clause')::int`,
          precedentAccesses: sql<number>`count(*) filter (where ${crossOrgAccessLog.resourceType} = 'precedent')::int`,
        })
        .from(crossOrgAccessLog)
        .innerJoin(organizations, eq(crossOrgAccessLog.userOrganizationId, organizations.id))
        .where(combinedWhere.length > 0 ? and(...combinedWhere) : undefined)
        .groupBy(crossOrgAccessLog.userOrganizationId, organizations.name, organizations.organizationType)
        .orderBy(desc(sql`count(*)`))
        .limit(10);

      // Organization level breakdown
      const orgLevelBreakdown = await db
        .select({
          organizationLevel: organizations.organizationType,
          totalAccesses: sql<number>`count(*)::int`,
        })
        .from(crossOrgAccessLog)
        .innerJoin(organizations, eq(crossOrgAccessLog.userOrganizationId, organizations.id))
        .where(accessWhere)
        .groupBy(organizations.organizationType)
        .orderBy(desc(sql`count(*)`));

      // Top contributors (resource owners)
      const topContributors = await db
        .select({
          organizationId: organizations.id,
          organizationName: organizations.name,
          organizationLevel: organizations.organizationType,
          totalClauses: sql<number>`(select count(*)::int from ${sharedClauseLibrary} sc where sc.source_organization_id = ${organizations.id} and sc.sharing_level != 'private')`,
          totalPrecedents: sql<number>`(select count(*)::int from ${arbitrationPrecedents} ap where ap.source_organization_id = ${organizations.id} and ap.sharing_level != 'private')`,
          totalResources: sql<number>`(
            (select count(*)::int from ${sharedClauseLibrary} sc where sc.source_organization_id = ${organizations.id} and sc.sharing_level != 'private') +
            (select count(*)::int from ${arbitrationPrecedents} ap where ap.source_organization_id = ${organizations.id} and ap.sharing_level != 'private')
          )`,
          clauseViews: sql<number>`coalesce((select sum(sc.view_count)::int from ${sharedClauseLibrary} sc where sc.source_organization_id = ${organizations.id} and sc.sharing_level != 'private'), 0)`,
          precedentViews: sql<number>`coalesce((select sum(ap.view_count)::int from ${arbitrationPrecedents} ap where ap.source_organization_id = ${organizations.id} and ap.sharing_level != 'private'), 0)`,
        })
        .from(organizations)
        .where(
          sql`(
            exists (select 1 from ${sharedClauseLibrary} sc where sc.source_organization_id = ${organizations.id} and sc.sharing_level != 'private')
            or exists (select 1 from ${arbitrationPrecedents} ap where ap.source_organization_id = ${organizations.id} and ap.sharing_level != 'private')
          )`,
        )
        .orderBy(desc(sql`(
          (select count(*) from ${sharedClauseLibrary} sc where sc.source_organization_id = ${organizations.id} and sc.sharing_level != 'private') +
          (select count(*) from ${arbitrationPrecedents} ap where ap.source_organization_id = ${organizations.id} and ap.sharing_level != 'private')
        )`))
        .limit(10);

      // Sharing adoption
      const [sharingAdoption] = await db
        .select({
          totalOrgs: sql<number>`count(*)::int`,
          clauseSharingEnabled: sql<number>`count(*) filter (where ${organizationSharingSettings.autoShareClauses} = true)::int`,
          precedentSharingEnabled: sql<number>`count(*) filter (where ${organizationSharingSettings.autoSharePrecedents} = true)::int`,
          analyticsSharingEnabled: sql<number>`count(*) filter (where ${organizationSharingSettings.allowFederationSharing} = true)::int`,
        })
        .from(organizationSharingSettings);

      return {
        statistics: statsResult,
        dailyActivity,
        accessTypeBreakdown,
        mostActiveOrgs,
        orgLevelBreakdown,
        topContributors,
        sharingAdoption,
      };
    });
  },
);
