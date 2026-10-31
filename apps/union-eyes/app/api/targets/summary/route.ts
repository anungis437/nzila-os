import { kpiConfigurations, analyticsMetrics } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { withApi, ApiError } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { computeKpiHealth } from '@/lib/kpi/health';

export const dynamic = 'force-dynamic';


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

    // For each KPI, grab the latest matching analytic metric to derive current value
    const enriched = await Promise.all(
      configs.map(async (cfg) => {
        const [latestMetric] = await tx
          .select()
          .from(analyticsMetrics)
          .where(
            and(
              eq(analyticsMetrics.organizationId, organizationId!),
              eq(analyticsMetrics.metricType, cfg.metricType),
            ),
          )
          .orderBy(desc(analyticsMetrics.periodEnd))
          .limit(1);

        const currentValue = latestMetric
          ? parseFloat(String(latestMetric.metricValue))
          : null;
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
          trend: latestMetric?.trend ?? null,
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
