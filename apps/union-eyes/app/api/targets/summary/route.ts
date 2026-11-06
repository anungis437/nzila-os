import { kpiConfigurations, analyticsMetrics } from '@/db/schema';
import { eq, and, desc, gte } from 'drizzle-orm';
import { withApi, ApiError } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { computeKpiHealth } from '@/lib/kpi/health';
import { evaluateTargetValue, sourceMismatchReason } from '@/lib/kpi/target-value';

export const dynamic = 'force-dynamic';

/**
 * The current value of a target applies its declared data source and calculation (lib/kpi/target-value.ts) to the stored metric periods of
 * its type that ended within this many days; a period long past is no current value, and when only such periods exist the answer is stale.
 */
const MAX_METRIC_AGE_DAYS = 120;
/** Periods read per target. A target with more recent rows than this is not measured, rather than aggregated over the first of them. */
const MAX_METRIC_ROWS = 1_000;


export const GET = withApi(
  { auth: { minRole: 'officer' }, requireOrg: true },
  async ({ organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.forbidden('Organization officer context required');
    return withRLSContext({ organizationId, userId }, async (tx) => {
    // Officer-only target summary: members must not receive financial target
    // configurations, alert recipients, formulas or creator identifiers.
    const configs = await tx
      .select()
      .from(kpiConfigurations)
      .where(eq(kpiConfigurations.organizationId, organizationId!))
      .orderBy(kpiConfigurations.displayOrder);

    const cutoff = new Date(Date.now() - MAX_METRIC_AGE_DAYS * 86_400_000);

    const enriched = await Promise.all(
      configs.map(async (cfg) => {
        // Rows are read only for a metric type that is computed from the declared source; otherwise the value is not measured.
        const readable = sourceMismatchReason(cfg.metricType, cfg.dataSource) === null;
        const windowRows = readable
          ? await tx
            .select()
            .from(analyticsMetrics)
            .where(
              and(
                eq(analyticsMetrics.organizationId, organizationId!),
                eq(analyticsMetrics.metricType, cfg.metricType),
                gte(analyticsMetrics.periodEnd, cutoff),
              ),
            )
            .orderBy(desc(analyticsMetrics.periodEnd))
            .limit(MAX_METRIC_ROWS + 1)
          : [];
        const overBound = windowRows.length > MAX_METRIC_ROWS;
        const value = overBound
          ? { ...evaluateTargetValue({ metricType: cfg.metricType, dataSource: cfg.dataSource, calculation: cfg.calculation, windowRows: [] }),
              notMeasuredReason: `Not measured: more than ${MAX_METRIC_ROWS} stored rows of this metric type in the window; aggregating beyond that bound is not implemented.` }
          : evaluateTargetValue({ metricType: cfg.metricType, dataSource: cfg.dataSource, calculation: cfg.calculation, windowRows });

        // Stale: the declared source does have stored values, but none for a recent period.
        let stale = false;
        if (readable && !overBound && windowRows.length === 0) {
          const [older] = await tx
            .select()
            .from(analyticsMetrics)
            .where(and(eq(analyticsMetrics.organizationId, organizationId!), eq(analyticsMetrics.metricType, cfg.metricType)))
            .orderBy(desc(analyticsMetrics.periodEnd))
            .limit(1);
          stale = Boolean(older);
        }

        const currentValue = value.currentValue;
        const targetNum = cfg.targetValue ? parseFloat(String(cfg.targetValue)) : null;
        const warningNum = cfg.warningThreshold ? parseFloat(String(cfg.warningThreshold)) : null;
        const criticalNum = cfg.criticalThreshold ? parseFloat(String(cfg.criticalThreshold)) : null;

        const health = computeKpiHealth(currentValue, targetNum, warningNum, criticalNum, cfg.direction);
        const progress =
          currentValue != null && targetNum != null && targetNum !== 0
            ? Math.round((currentValue / targetNum) * 100)
            : null;

        return {
          id: cfg.id,
          name: cfg.name,
          description: cfg.description,
          metricType: cfg.metricType,
          dataSource: cfg.dataSource,
          visualizationType: cfg.visualizationType,
          targetValue: cfg.targetValue,
          isActive: cfg.isActive,
          displayOrder: cfg.displayOrder,
          health,
          currentValue,
          progress,
          valueBasis: value.valueBasis,
          notMeasuredReason: value.notMeasuredReason,
          aggregation: value.aggregation,
          periodsUsed: value.periodsUsed,
          asOf: value.asOf,
          stale,
          trend: value.trend,
        };
      }),
    );

    // Build summary
    const summary = {
      total: enriched.length,
      onTrack: enriched.filter((t) => t.health === 'on_track').length,
      atRisk: enriched.filter((t) => t.health === 'at_risk').length,
      critical: enriched.filter((t) => t.health === 'critical').length,
      noData: enriched.filter((t) => t.health === 'no_data').length,
      bySource: enriched.reduce<Record<string, number>>((acc, t) => {
        acc[t.dataSource] = (acc[t.dataSource] ?? 0) + 1;
        return acc;
      }, {}),
    };

    await persistAtomicAudit(tx, {
      organizationId, userId,
      action: 'target.summary.read',
      resourceType: 'kpi_configurations',
      details: { targetCount: enriched.length },
    });
    return { summary, targets: enriched };
    });
  },
);
