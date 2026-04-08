/**
 * GET /api/v2/analytics/clc/affiliate-trends
 * Governed CLC endpoint — per-affiliate sharing and activity trends.
 * Requires VIEW_CONGRESS_ANALYTICS permission + affiliate consent.
 */
import { withApi } from '@/lib/api/framework';
import { runGovernedCrossUnionAggregation, resolveGovernanceContext } from '@/lib/clc/governance';
import { queryAffiliateTrends } from '@/lib/clc/data-products';
import { generateAffiliateEngagementBriefing } from '@/lib/clc/nil-briefing';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'clc_staff' },
    openapi: {
      tags: ['Analytics', 'CLC Intelligence'],
      summary: 'Affiliate trends (governed)',
      description:
        'Affiliate sharing and engagement trends aggregated by organization type. Governed by consent and cohort thresholds.',
    },
  },
  async ({ request, userId, organizationId }) => {
    const govCtx = await resolveGovernanceContext(userId!, organizationId);
    const url = new URL(request.url);
    const fromDate = url.searchParams.get('fromDate') ?? undefined;
    const toDate = url.searchParams.get('toDate') ?? undefined;
    const includeBriefing = url.searchParams.get('briefing') === 'true';

    const trends = await runGovernedCrossUnionAggregation(
      {
        context: govCtx,
        requiredPermission: 'view_congress_analytics',
        operationLabel: 'affiliate-trends',
        participationDimension: 'crossUnionAnalytics',
      },
      (consentedOrgIds) => queryAffiliateTrends(consentedOrgIds, { fromDate, toDate }),
    );

    return {
      trends,
      ...(includeBriefing && { briefing: generateAffiliateEngagementBriefing(trends) }),
    };
  },
);
