/**
 * GET /api/v2/analytics/federation/overview
 * Federation-scoped intelligence — aggregated data scoped to a federation's own affiliates.
 * Requires VIEW_CROSS_UNION_ANALYTICS permission (federation executives/staff have this).
 *
 * Unlike CLC routes which aggregate across ALL consenting affiliates,
 * federation routes scope to organizations whose parentOrganizationId
 * matches the actor's organizationId.
 */
import { withApi } from '@/lib/api/framework';
import { resolveGovernanceContext } from '@/lib/clc/governance';
import { db } from '@/db/db';
import {
  organizations,
  sharedClauseLibrary,
  arbitrationPrecedents,
  crossOrgAccessLog,
} from '@/db/schema';
import { sql, and, inArray, ne, gte, lte, eq } from 'drizzle-orm';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { auditLog, AuditEventType, AuditSeverity } from '@/lib/audit-logger';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'fed_staff' },
    openapi: {
      tags: ['Analytics', 'Federation Intelligence'],
      summary: 'Federation overview (governed)',
      description:
        'Aggregated intelligence scoped to the requesting federation\'s own affiliates.',
    },
  },
  async ({ request, userId, organizationId }) => {
    const govCtx = await resolveGovernanceContext(userId!, organizationId);

    if (!govCtx.hasPermission('view_cross_union_analytics')) {
      throw new Error('Permission required: view_cross_union_analytics');
    }

    if (!organizationId) {
      throw new Error('Federation context required: no organization ID on session');
    }

    // Resolve federation affiliate org IDs (children of this federation)
    const affiliateOrgs = await withSystemContext(() =>
      db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.parentOrganizationId, organizationId)),
    );

    const affiliateIds = affiliateOrgs.map((o) => o.id);
    if (affiliateIds.length === 0) {
      return { affiliateCount: 0, clauses: 0, precedents: 0, accesses: 0, message: 'No affiliated organizations found.' };
    }

    const url = new URL(request.url);
    const fromDate = url.searchParams.get('fromDate') ?? undefined;
    const toDate = url.searchParams.get('toDate') ?? undefined;

    const dateConditions = [];
    if (fromDate) dateConditions.push(gte(crossOrgAccessLog.createdAt, new Date(fromDate)));
    if (toDate) dateConditions.push(lte(crossOrgAccessLog.createdAt, new Date(toDate)));

    const [clauseResult, precedentResult, accessResult] = await withSystemContext(() =>
      Promise.all([
        db
          .select({ total: sql<number>`count(*)::int` })
          .from(sharedClauseLibrary)
          .where(
            and(
              inArray(sharedClauseLibrary.sourceOrganizationId, affiliateIds),
              ne(sharedClauseLibrary.sharingLevel, 'private'),
            ),
          ),
        db
          .select({ total: sql<number>`count(*)::int` })
          .from(arbitrationPrecedents)
          .where(
            and(
              inArray(arbitrationPrecedents.sourceOrganizationId, affiliateIds),
              ne(arbitrationPrecedents.sharingLevel, 'private'),
            ),
          ),
        db
          .select({ total: sql<number>`count(*)::int` })
          .from(crossOrgAccessLog)
          .where(
            and(
              inArray(crossOrgAccessLog.userOrganizationId, affiliateIds),
              ...dateConditions,
            ),
          ),
      ]),
    );

    await auditLog({
      eventType: AuditEventType.DATA_ACCESS,
      severity: AuditSeverity.LOW,
      userId: govCtx.userId,
      organizationId: govCtx.organizationId ?? undefined,
      resource: 'federation-intelligence',
      action: 'federation-overview',
      outcome: 'success',
      details: { affiliateCount: affiliateIds.length },
    });

    return {
      affiliateCount: affiliateIds.length,
      clauses: clauseResult[0]?.total ?? 0,
      precedents: precedentResult[0]?.total ?? 0,
      accesses: accessResult[0]?.total ?? 0,
    };
  },
);
