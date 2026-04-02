/**
 * Member Arrears Calculation Route
 *
 * GET  /api/dues/arrears/calculate — List current arrears for the org
 * POST /api/dues/arrears/calculate — Calculate/summarize arrears status for org members
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db';
import { memberArrears } from '@/db/schema/dues-finance-schema';
import { eq, sql } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { minRole: 'member' },
    entitlement: 'financial_intelligence_suite',
    openapi: { tags: ['Dues'], summary: 'List current arrears for the organization' },
  },
  async ({ organizationId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');

    const rows = await db
      .select()
      .from(memberArrears)
      .where(eq(memberArrears.organizationId, organizationId));

    return { data: rows };
  },
);

export const POST = withApi(
  {
    auth: { minRole: 'steward' },
    openapi: { tags: ['Dues'], summary: 'Calculate arrears summary for organization' },
  },
  async ({ organizationId, userId: _userId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');

    const [summary] = await db
      .select({
        totalMembers: sql<number>`count(*)::int`,
        currentCount: sql<number>`count(*) filter (where ${memberArrears.arrearsStatus} = 'current')::int`,
        warningCount: sql<number>`count(*) filter (where ${memberArrears.arrearsStatus} = 'warning')::int`,
        suspendedCount: sql<number>`count(*) filter (where ${memberArrears.arrearsStatus} = 'suspended')::int`,
        badDebtCount: sql<number>`count(*) filter (where ${memberArrears.arrearsStatus} = 'bad_debt')::int`,
        totalOwed: sql<string>`coalesce(sum(${memberArrears.totalOwed}), '0')`,
        totalOver30: sql<string>`coalesce(sum(${memberArrears.over30Days}), '0')`,
        totalOver60: sql<string>`coalesce(sum(${memberArrears.over60Days}), '0')`,
        totalOver90: sql<string>`coalesce(sum(${memberArrears.over90Days}), '0')`,
      })
      .from(memberArrears)
      .where(eq(memberArrears.organizationId, organizationId));

    logger.info('Arrears summary calculated', { organizationId });

    return { data: summary };
  },
);
