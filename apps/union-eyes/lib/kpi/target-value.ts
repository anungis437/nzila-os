/**
 * The current value of a KPI target, computed from its declared data source and calculation.
 *
 * A target declares a metric type, a data source ('claims' | 'members' | 'financial' | 'custom_query') and a calculation
 * ({ aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max' }). The stored metric rows (analytics_metrics) are written by
 * calculateMetrics (actions/analytics-actions.ts), which computes each supported metric type from one source table. So:
 *  - a value is stated only when the target's metric type is one that is computed from the source the target declares;
 *  - the declared aggregation is applied over the distinct recent periods of that metric type (one period type, the latest
 *    recomputation of each period), never "the latest row of the same metric type text";
 *  - anything else is not measured, with the reason.
 */

/** Metric types calculateMetrics computes, and the source table each is computed from. */
export const METRIC_TYPE_SOURCE: Readonly<Record<string, 'claims' | 'members'>> = {
  claims_volume: 'claims',
  resolution_time: 'claims',
  member_growth: 'members',
};

export const TARGET_AGGREGATIONS = ['sum', 'avg', 'count', 'min', 'max'] as const;
export type TargetAggregation = (typeof TARGET_AGGREGATIONS)[number];

export interface StoredMetricRow {
  metricValue: unknown;
  periodType?: string | null;
  periodStart?: Date | string | null;
  periodEnd?: Date | string | null;
  createdAt?: Date | string | null;
  trend?: string | null;
}

export interface TargetValue {
  currentValue: number | null;
  valueBasis: 'declared_aggregation_of_metric_periods' | 'not_measured';
  notMeasuredReason: string | null;
  aggregation: TargetAggregation | null;
  periodsUsed: number;
  periodType: string | null;
  asOf: string | null;
  trend: string | null;
}

function time(value: Date | string | null | undefined): number | null {
  if (value == null) return null;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
}

function notMeasured(reason: string, aggregation: TargetAggregation | null = null): TargetValue {
  return { currentValue: null, valueBasis: 'not_measured', notMeasuredReason: reason, aggregation, periodsUsed: 0, periodType: null, asOf: null, trend: null };
}

export function readAggregation(calculation: unknown): TargetAggregation | null {
  const aggregation = (calculation as { aggregation?: unknown } | null)?.aggregation;
  return TARGET_AGGREGATIONS.find((candidate) => candidate === aggregation) ?? null;
}

/** Whether the target's metric type is computed from the source it declares; null when it is, otherwise the reason it is not. */
export function sourceMismatchReason(metricType: string, dataSource: string): string | null {
  const source = METRIC_TYPE_SOURCE[metricType];
  if (!source) {
    return `Not measured: no computation in Union Eyes produces the metric type "${metricType}", so no stored value can be attributed to the declared data source "${dataSource}".`;
  }
  if (source !== dataSource) {
    return `Not measured: the metric type "${metricType}" is computed from ${source}, not from the declared data source "${dataSource}".`;
  }
  return null;
}

/**
 * Apply the target's declared source and calculation to the metric rows of its type whose period ended inside the freshness window
 * (`windowRows`, most recent period end first).
 */
export function evaluateTargetValue(input: {
  metricType: string;
  dataSource: string;
  calculation: unknown;
  windowRows: StoredMetricRow[];
}): TargetValue {
  const mismatch = sourceMismatchReason(input.metricType, input.dataSource);
  if (mismatch) return notMeasured(mismatch);
  const aggregation = readAggregation(input.calculation);
  if (!aggregation) return notMeasured('Not measured: the target declares no supported aggregation (sum, avg, count, min or max).');

  const usable = input.windowRows.filter((row) => time(row.periodEnd) !== null && Number.isFinite(Number(row.metricValue)));
  if (usable.length === 0) return notMeasured('Not measured: no stored value of this metric type for a recent period.', aggregation);

  // One period type only (summing a daily and a monthly row would double count), the one of the most recent period.
  const latest = usable.reduce((a, b) => ((time(b.periodEnd) ?? 0) > (time(a.periodEnd) ?? 0) ? b : a));
  const periodType = latest.periodType ?? null;
  // A period recomputed more than once is counted once: its most recently written row.
  const byPeriod = new Map<string, StoredMetricRow>();
  for (const row of usable) {
    if ((row.periodType ?? null) !== periodType) continue;
    const key = `${time(row.periodStart) ?? ''}|${time(row.periodEnd)}`;
    const current = byPeriod.get(key);
    if (!current || (time(row.createdAt) ?? 0) > (time(current.createdAt) ?? 0)) byPeriod.set(key, row);
  }
  const periods = [...byPeriod.values()];
  const values = periods.map((row) => Number(row.metricValue));
  const currentValue =
    aggregation === 'count' ? values.length
      : aggregation === 'sum' ? values.reduce((a, b) => a + b, 0)
        : aggregation === 'avg' ? values.reduce((a, b) => a + b, 0) / values.length
          : aggregation === 'min' ? Math.min(...values)
            : Math.max(...values);

  return {
    currentValue,
    valueBasis: 'declared_aggregation_of_metric_periods',
    notMeasuredReason: null,
    aggregation,
    periodsUsed: periods.length,
    periodType,
    asOf: new Date(time(latest.periodEnd)!).toISOString(),
    // A stored trend describes one period; it is stated only when the value is that single period.
    trend: periods.length === 1 ? periods[0].trend ?? null : null,
  };
}
