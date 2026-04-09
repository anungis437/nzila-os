/**
 * GET /api/finance/per-capita/inbound
 *
 * Returns per-capita remittance data from child organizations TO the
 * authenticated user's parent organization.  Only meaningful for
 * national unions and CLC/federation orgs that receive per-capita
 * payments from their locals.
 *
 * Query params:
 *   year  number (default: current year)
 */

import { withApi, ApiError, z } from '@/lib/api/framework';
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { getRemittanceStatusForParent } from '@/services/clc/per-capita-calculator';
import { withRLSContext } from '@/lib/db/with-rls-context';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

export const GET = withApi(
  {
    auth: { minRole: 'officer' },
    entitlement: 'financial_intelligence_suite',
    query: querySchema,
    openapi: {
      tags: ['Finance', 'Per-Capita'],
      summary: 'Inbound per-capita remittances from child organizations',
    },
  },
  async ({ organizationId, query }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');

    // Verify the org is a parent (has child organizations)
    const [childCheck] = await withRLSContext(async () => db.execute(sql`
      SELECT COUNT(*)::int AS "childCount"
      FROM organizations
      WHERE parent_id = ${organizationId}
        AND status = 'active'
    `));

    const childCount = Number((childCheck as Record<string, unknown>)?.childCount ?? 0);
    if (childCount === 0) {
      return {
        isParentOrg: false,
        childCount: 0,
        year: query.year ?? new Date().getFullYear(),
        childRemittances: [],
        totals: { totalDue: 0, totalPaid: 0, totalOverdue: 0 },
      };
    }

    const remittances = await getRemittanceStatusForParent(
      organizationId,
      query.year,
    );

    const totals = remittances.reduce(
      (acc, r) => ({
        totalDue: acc.totalDue + r.totalDue,
        totalPaid: acc.totalPaid + r.totalPaid,
        totalOverdue: acc.totalOverdue + r.totalOverdue,
      }),
      { totalDue: 0, totalPaid: 0, totalOverdue: 0 },
    );

    return {
      isParentOrg: true,
      childCount,
      year: query.year ?? new Date().getFullYear(),
      childRemittances: remittances,
      totals,
    };
  },
);
