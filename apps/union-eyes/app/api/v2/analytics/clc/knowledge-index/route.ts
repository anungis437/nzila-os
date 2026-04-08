/**
 * GET /api/v2/analytics/clc/knowledge-index
 * Governed CLC endpoint — shared knowledge library health metrics.
 * Requires VIEW_CONGRESS_ANALYTICS permission + affiliate consent.
 */
import { withApi } from '@/lib/api/framework';
import { runGovernedCrossUnionAggregation, resolveGovernanceContext } from '@/lib/clc/governance';
import { querySharedKnowledgeIndex } from '@/lib/clc/data-products';
import { generateKnowledgeIndexBriefing } from '@/lib/clc/nil-briefing';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'clc_staff' },
    openapi: {
      tags: ['Analytics', 'CLC Intelligence'],
      summary: 'Shared knowledge index (governed)',
      description:
        'Aggregate clause library + precedent database health. Governed by consent and cohort thresholds.',
    },
  },
  async ({ request, userId, organizationId }) => {
    const govCtx = await resolveGovernanceContext(userId!, organizationId);
    const url = new URL(request.url);
    const includeBriefing = url.searchParams.get('briefing') === 'true';

    const index = await runGovernedCrossUnionAggregation(
      {
        context: govCtx,
        requiredPermission: 'view_congress_analytics',
        operationLabel: 'knowledge-index',
        participationDimension: 'crossUnionAnalytics',
      },
      (consentedOrgIds) => querySharedKnowledgeIndex(consentedOrgIds),
    );

    return {
      index,
      ...(includeBriefing && { briefing: generateKnowledgeIndexBriefing(index) }),
    };
  },
);
