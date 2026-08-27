/**
 * Cross-org analytics — aggregates metrics across all organisations.
 * Requires platform-level auth (platform_lead or higher).
 */
import { withApi } from '@/lib/api/with-api';
import { db } from '@/db/db';
import { analyticsMetrics } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { withRLSContext } from '@/lib/db/with-rls-context';

export const dynamic = 'force-dynamic';

interface CrossOrgMetricRow {
  organizationId: string;
  metricType: string;
  metricValue: string | number | null;
  metricUnit: string | null;
  periodStart: Date | string;
  periodEnd: Date | string;
  trend: string | null;
}

function numericValue(value: string | number | null): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  const parsed = Number.parseFloat(value ?? '0');
  return Number.isFinite(parsed) ? parsed : 0;
}

function isoDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function buildAggregateSummary(rows: CrossOrgMetricRow[]) {
  const groups = new Map<string, {
    metricType: string;
    metricUnit: string | null;
    metricCount: number;
    totalValue: number;
    minValue: number;
    maxValue: number;
    periodStart: string;
    periodEnd: string;
    latestTrend: string | null;
    organizations: Set<string>;
  }>();

  for (const row of rows) {
    const value = numericValue(row.metricValue);
    const periodStart = isoDate(row.periodStart);
    const periodEnd = isoDate(row.periodEnd);
    const current = groups.get(row.metricType);

    if (!current) {
      groups.set(row.metricType, {
        metricType: row.metricType,
        metricUnit: row.metricUnit,
        metricCount: 1,
        totalValue: value,
        minValue: value,
        maxValue: value,
        periodStart,
        periodEnd,
        latestTrend: row.trend,
        organizations: new Set([row.organizationId]),
      });
      continue;
    }

    current.metricCount += 1;
    current.totalValue += value;
    current.minValue = Math.min(current.minValue, value);
    current.maxValue = Math.max(current.maxValue, value);
    current.periodStart = periodStart < current.periodStart ? periodStart : current.periodStart;
    current.periodEnd = periodEnd > current.periodEnd ? periodEnd : current.periodEnd;
    current.latestTrend ??= row.trend;
    current.organizations.add(row.organizationId);
  }

  return Array.from(groups.values()).map((group) => ({
    metricType: group.metricType,
    metricUnit: group.metricUnit,
    metricCount: group.metricCount,
    contributingOrganizations: group.organizations.size,
    totalValue: group.totalValue,
    averageValue: group.metricCount ? group.totalValue / group.metricCount : 0,
    minValue: group.minValue,
    maxValue: group.maxValue,
    periodStart: group.periodStart,
    periodEnd: group.periodEnd,
    latestTrend: group.latestTrend,
  }));
}

export const GET = withApi(
  {
    auth: { required: true, minRole: 'platform_lead' },
    openapi: { tags: ['Analytics'], summary: 'Cross-org aggregate analytics metrics' },
  },
  async () => {
    return withRLSContext(async () => {
      const rows = await db
        .select({
          organizationId: analyticsMetrics.organizationId,
          metricType: analyticsMetrics.metricType,
          metricValue: analyticsMetrics.metricValue,
          metricUnit: analyticsMetrics.metricUnit,
          periodStart: analyticsMetrics.periodStart,
          periodEnd: analyticsMetrics.periodEnd,
          trend: analyticsMetrics.trend,
        })
        .from(analyticsMetrics)
        .orderBy(desc(analyticsMetrics.createdAt))
        .limit(1000);

      return {
        dataClass: 'aggregate_only',
        items: buildAggregateSummary(rows as CrossOrgMetricRow[]),
        sourceRowsAggregated: rows.length,
        rawRowsExposed: false,
      };
    });
  },
);
