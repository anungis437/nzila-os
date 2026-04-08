/**
 * GET /api/v2/analytics/clc/sector-signals
 * Governed CLC endpoint — sector-level intelligence signals.
 * Requires VIEW_CONGRESS_ANALYTICS permission + affiliate consent.
 */
import { withApi } from '@/lib/api/framework';
import { runGovernedCrossUnionAggregation, resolveGovernanceContext } from '@/lib/clc/governance';
import { querySectorSignals, deriveStrategicSignals } from '@/lib/clc/data-products';
import { generateSectorSignalsBriefing } from '@/lib/clc/nil-briefing';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'clc_staff' },
    openapi: {
      tags: ['Analytics', 'CLC Intelligence'],
      summary: 'Sector signals (governed)',
      description:
        'Cross-sector clause/precedent trends. Governed by consent and cohort thresholds.',
    },
  },
  async ({ request, userId, organizationId }) => {
    const govCtx = await resolveGovernanceContext(userId!, organizationId);
    const url = new URL(request.url);
    const fromDate = url.searchParams.get('fromDate') ?? undefined;
    const toDate = url.searchParams.get('toDate') ?? undefined;
    const includeBriefing = url.searchParams.get('briefing') === 'true';

    const signals = await runGovernedCrossUnionAggregation(
      {
        context: govCtx,
        requiredPermission: 'view_congress_analytics',
        operationLabel: 'sector-signals',
        participationDimension: 'sectorBenchmarks',
      },
      (consentedOrgIds) => querySectorSignals(consentedOrgIds, { fromDate, toDate }),
    );

    return {
      signals,
      strategicSignals: deriveStrategicSignals(signals),
      ...(includeBriefing && { briefing: generateSectorSignalsBriefing(signals) }),
    };
  },
);
