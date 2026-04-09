import { db } from '@/db/db';
import { kpiConfigurations, analyticsMetrics } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

/**
 * Determine KPI health by comparing currentValue against thresholds.
 */
function computeHealth(
  currentValue: number | null,
  target: number | null,
  warning: number | null,
  critical: number | null,
): 'on_track' | 'at_risk' | 'critical' | 'no_data' {
  if (currentValue == null || target == null) return 'no_data';
  if (critical != null && currentValue <= critical) return 'critical';
  if (warning != null && currentValue <= warning) return 'at_risk';
  return 'on_track';
}

export const GET = withApi(
  { auth: { minRole: 'member' } },
  async ({ organizationId }) => {
    // Fetch all KPI configurations for the org
    const configs = await db
      .select()
      .from(kpiConfigurations)
      .where(eq(kpiConfigurations.organizationId, organizationId!))
      .orderBy(kpiConfigurations.displayOrder);

    // For each KPI, grab the latest matching analytic metric to derive current value
    const enriched = await Promise.all(
      configs.map(async (cfg) => {
        const [latestMetric] = await db
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

        const health = computeHealth(currentValue, targetNum, warningNum, criticalNum);
        const progress =
          currentValue != null && targetNum != null && targetNum !== 0
            ? Math.round((currentValue / targetNum) * 100)
            : null;

        return {
          ...cfg,
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

    return { summary, targets: enriched };
  },
);
