/**
 * GET /api/v2/analytics/clc/executive-brief
 * Governed CLC endpoint — executive intelligence layer.
 *
 * Runs the full executive intelligence pipeline on top of
 * decision-intelligence output. Produces executive priorities,
 * movement summary, delta analysis, and an action brief.
 *
 * Requires VIEW_CONGRESS_ANALYTICS permission + affiliate consent.
 */
import { withApi } from '@/lib/api/framework';
import { runGovernedCrossUnionAggregation, resolveGovernanceContext } from '@/lib/clc/governance';
import { querySectorSignals, queryAffiliateTrends, querySectorTimeSeries } from '@/lib/clc/data-products';
import { auditLog, AuditEventType, AuditSeverity } from '@/lib/audit-logger';
import { getNilReasoningService } from '@/lib/clc/nil-executive-service';
import { saveExecutiveSnapshot, loadLatestExecutiveSnapshot } from '@/lib/clc/executive-snapshot-store';
import { runDecisionIntelligencePipeline } from '@nzila/clc-decision-intelligence';
import { runExecutiveIntelligencePipeline } from '@nzila/clc-executive-intelligence';
import type {
  SectorAggregate,
  AffiliateTypeAggregate,
  SectorTimeSeries,
} from '@nzila/clc-decision-intelligence';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'clc_executive' },
    openapi: {
      tags: ['Analytics', 'CLC Intelligence'],
      summary: 'Executive intelligence brief (governed)',
      description:
        'Executive intelligence layer — priorities, movement summary, delta analysis, and action brief. Built on governed decision-intelligence outputs. Requires CLC executive role.',
    },
  },
  async ({ request, userId, organizationId }) => {
    const govCtx = await resolveGovernanceContext(userId!, organizationId);
    const url = new URL(request.url);
    const fromDate = url.searchParams.get('fromDate') ?? undefined;
    const toDate = url.searchParams.get('toDate') ?? undefined;
    const maxPriorities = Math.min(
      10,
      Math.max(1, parseInt(url.searchParams.get('maxPriorities') ?? '5', 10) || 5),
    );

    // Run governed aggregations — same as decision-intelligence layer
    const [sectorSignals, affiliateTrends, timeSeriesData] = await Promise.all([
      runGovernedCrossUnionAggregation(
        {
          context: govCtx,
          requiredPermission: 'view_congress_analytics',
          operationLabel: 'executive-brief:sectors',
          participationDimension: 'sectorBenchmarks',
        },
        (consentedOrgIds) => querySectorSignals(consentedOrgIds, { fromDate, toDate }),
      ),
      runGovernedCrossUnionAggregation(
        {
          context: govCtx,
          requiredPermission: 'view_congress_analytics',
          operationLabel: 'executive-brief:affiliates',
          participationDimension: 'crossUnionAnalytics',
        },
        (consentedOrgIds) => queryAffiliateTrends(consentedOrgIds, { fromDate, toDate }),
      ),
      runGovernedCrossUnionAggregation(
        {
          context: govCtx,
          requiredPermission: 'view_congress_analytics',
          operationLabel: 'executive-brief:time-series',
          participationDimension: 'sectorBenchmarks',
        },
        (consentedOrgIds) => querySectorTimeSeries(consentedOrgIds),
      ),
    ]);

    const sectors: SectorAggregate[] = sectorSignals;
    const affiliateTypes: AffiliateTypeAggregate[] = affiliateTrends.map((t) => ({
      organizationType: t.organizationType,
      affiliateCount: t.affiliateCount,
      clausesShared: t.clausesShared,
      precedentsShared: t.precedentsShared,
    }));
    const sectorTimeSeries: SectorTimeSeries[] = timeSeriesData.map((ts) => ({
      sector: ts.sector,
      series: ts.series.map((p) => ({ period: p.period, value: p.value })),
    }));

    // Step 1: Run decision intelligence pipeline (governed aggregates)
    const decisionOutput = runDecisionIntelligencePipeline(
      sectors,
      affiliateTypes,
      sectorTimeSeries,
    );

    // Step 2: Run executive intelligence pipeline on top
    const nilService = getNilReasoningService();
    const previousSnapshot = organizationId
      ? await loadLatestExecutiveSnapshot(organizationId)
      : null;

    const result = await runExecutiveIntelligencePipeline({
      decisionOutput,
      previousSnapshot,
      nilService,
      maxPriorities,
      timeSeriesAvailable: sectorTimeSeries.length > 0,
    });

    // Persist snapshot for future delta comparison
    if (organizationId) {
      await saveExecutiveSnapshot(organizationId, result.currentSnapshot);
    }

    // Audit: log executive intelligence pipeline invocation
    await auditLog({
      eventType: AuditEventType.DATA_ACCESS,
      severity: AuditSeverity.LOW,
      userId: userId ?? undefined,
      organizationId: organizationId ?? undefined,
      resource: 'clc-executive-intelligence',
      action: 'executive-brief-generation',
      outcome: 'success',
      details: {
        scope: 'executive-brief',
        ...result.auditContext,
        posture: result.movementSummary.posture,
        filtersApplied: { fromDate: fromDate ?? null, toDate: toDate ?? null },
      },
    });

    return {
      movementSummary: result.movementSummary,
      topExecutivePriorities: result.topExecutivePriorities,
      whatChanged: result.whatChanged,
      actionBrief: result.actionBrief,
      meta: {
        fromDate: fromDate ?? null,
        toDate: toDate ?? null,
        sectorCount: sectors.length,
        affiliateTypeCount: affiliateTypes.length,
        timeSeriesAvailable: sectorTimeSeries.length > 0,
        snapshotId: result.currentSnapshot.id,
      },
    };
  },
);
