/**
 * GET /api/v2/targets/summary
 * Aggregated target summary — counts, health, overall progress.
 * Returns dashboard-ready metrics without needing client-side aggregation.
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { kpiConfigurations, analyticsMetrics } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Targets'],
      summary: 'Target summary metrics',
      description: 'Returns aggregate counts and health status for all active targets.',
    },
  },
  async ({ organizationId }) => {
    // Get all active targets
    const targets = await db
      .select()
      .from(kpiConfigurations)
      .where(
        and(
          eq(kpiConfigurations.organizationId, organizationId!),
          eq(kpiConfigurations.isActive, true),
        ),
      )
      .orderBy(desc(kpiConfigurations.createdAt));

    // Get latest metric for each target's metricType
    const metricTypes = [...new Set(targets.map((t) => t.metricType))];
    const latestMetrics: Record<string, { value: number; trend: string | null }> = {};

    for (const metricType of metricTypes) {
      const [latest] = await db
        .select()
        .from(analyticsMetrics)
        .where(
          and(
            eq(analyticsMetrics.organizationId, organizationId!),
            eq(analyticsMetrics.metricType, metricType),
          ),
        )
        .orderBy(desc(analyticsMetrics.periodEnd))
        .limit(1);

      if (latest) {
        latestMetrics[metricType] = {
          value: parseFloat(latest.metricValue),
          trend: latest.trend,
        };
      }
    }

    // Compute health for each target
    let onTrack = 0;
    let atRisk = 0;
    let critical = 0;
    let noData = 0;

    const enriched = targets.map((target) => {
      const metric = latestMetrics[target.metricType];
      if (!metric || !target.targetValue) {
        noData++;
        return { ...target, health: 'no_data' as const, currentValue: null, progress: null };
      }

      const tv = parseFloat(target.targetValue);
      const progress = tv !== 0 ? Math.round((metric.value / tv) * 100) : 0;
      const critThreshold = target.criticalThreshold ? parseFloat(target.criticalThreshold) : null;
      const warnThreshold = target.warningThreshold ? parseFloat(target.warningThreshold) : null;

      let health: 'on_track' | 'at_risk' | 'critical' = 'on_track';
      if (critThreshold !== null && metric.value <= critThreshold) {
        health = 'critical';
        critical++;
      } else if (warnThreshold !== null && metric.value <= warnThreshold) {
        health = 'at_risk';
        atRisk++;
      } else {
        onTrack++;
      }

      return { ...target, health, currentValue: metric.value, progress, trend: metric.trend };
    });

    // Count by data source
    const bySource = targets.reduce<Record<string, number>>((acc, t) => {
      acc[t.dataSource] = (acc[t.dataSource] || 0) + 1;
      return acc;
    }, {});

    return {
      summary: {
        total: targets.length,
        onTrack,
        atRisk,
        critical,
        noData,
        bySource,
      },
      targets: enriched,
    };
  },
);
