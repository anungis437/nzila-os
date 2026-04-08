/**
 * GET /api/v2/analytics/clc/decision-intelligence
 * Governed CLC endpoint — decision intelligence layer.
 *
 * Runs the full decision intelligence pipeline over governed aggregates:
 * sector signals (sectorBenchmarks consent) + affiliate trends
 * (crossUnionAnalytics consent). Produces risk posture, patterns,
 * recommendations, sector divergence, bargaining watch, and
 * executive briefing cards.
 *
 * Requires VIEW_CONGRESS_ANALYTICS permission + affiliate consent.
 */
import { withApi } from '@/lib/api/framework';
import { runGovernedCrossUnionAggregation, resolveGovernanceContext } from '@/lib/clc/governance';
import { querySectorSignals, queryAffiliateTrends } from '@/lib/clc/data-products';
import { auditLog, AuditEventType, AuditSeverity } from '@/lib/audit-logger';
import { runDecisionIntelligencePipeline } from '@nzila/clc-decision-intelligence';
import type {
  SectorAggregate,
  AffiliateTypeAggregate,
  SectorTimeSeries,
} from '@nzila/clc-decision-intelligence';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'clc_staff' },
    openapi: {
      tags: ['Analytics', 'CLC Intelligence'],
      summary: 'Decision intelligence (governed)',
      description:
        'Cross-union decision intelligence layer — risk posture, correlated patterns, recommendations, and executive briefing cards. Governed by consent and cohort thresholds.',
    },
  },
  async ({ request, userId, organizationId }) => {
    const govCtx = await resolveGovernanceContext(userId!, organizationId);
    const url = new URL(request.url);
    const fromDate = url.searchParams.get('fromDate') ?? undefined;
    const toDate = url.searchParams.get('toDate') ?? undefined;

    // Run governed aggregations in parallel — each checks its own consent dimension
    const [sectorSignals, affiliateTrends] = await Promise.all([
      runGovernedCrossUnionAggregation(
        {
          context: govCtx,
          requiredPermission: 'view_congress_analytics',
          operationLabel: 'decision-intelligence:sectors',
          participationDimension: 'sectorBenchmarks',
        },
        (consentedOrgIds) => querySectorSignals(consentedOrgIds, { fromDate, toDate }),
      ),
      runGovernedCrossUnionAggregation(
        {
          context: govCtx,
          requiredPermission: 'view_congress_analytics',
          operationLabel: 'decision-intelligence:affiliates',
          participationDimension: 'crossUnionAnalytics',
        },
        (consentedOrgIds) => queryAffiliateTrends(consentedOrgIds, { fromDate, toDate }),
      ),
    ]);

    // Map governed outputs to pipeline input types
    const sectors: SectorAggregate[] = sectorSignals;
    const affiliateTypes: AffiliateTypeAggregate[] = affiliateTrends.map((t) => ({
      organizationType: t.organizationType,
      affiliateCount: t.affiliateCount,
      clausesShared: t.clausesShared,
      precedentsShared: t.precedentsShared,
    }));

    // Time-series data requires periodic queries — not yet implemented.
    // The pipeline handles empty time series gracefully (temporal patterns
    // like bargaining pressure detection will be inactive until time-series
    // data products are available).
    const sectorTimeSeries: SectorTimeSeries[] = [];

    const output = runDecisionIntelligencePipeline(sectors, affiliateTypes, sectorTimeSeries);

    // Audit: log decision intelligence pipeline invocation with summary
    await auditLog({
      eventType: AuditEventType.DATA_ACCESS,
      severity: AuditSeverity.LOW,
      userId: userId ?? undefined,
      organizationId: organizationId ?? undefined,
      resource: 'clc-decision-intelligence',
      action: 'pipeline-invocation',
      outcome: 'success',
      details: {
        scope: 'decision-intelligence',
        nilInvoked: false,
        recommendationReturned: output.recommendations.length > 0,
        signalTypesReturned: [...new Set(output.patterns.map((p) => p.patternType))],
        filtersApplied: { fromDate: fromDate ?? null, toDate: toDate ?? null },
        cohortBand: {
          sectorCount: sectors.length,
          affiliateTypeCount: affiliateTypes.length,
          timeSeriesAvailable: sectorTimeSeries.length > 0,
        },
        pipelineSummary: {
          riskPosture: output.riskPosture.posture,
          patternCount: output.patterns.length,
          recommendationCount: output.recommendations.length,
          briefingCardCount: output.briefingCards.length,
          bargainingWatchActive: output.bargainingWatch !== null,
        },
      },
    });

    return {
      ...output,
      meta: {
        fromDate: fromDate ?? null,
        toDate: toDate ?? null,
        sectorCount: sectors.length,
        affiliateTypeCount: affiliateTypes.length,
        timeSeriesAvailable: sectorTimeSeries.length > 0,
      },
    };
  },
);
