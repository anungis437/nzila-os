/**
 * Reads the rows the analytics routes answer, for the analytics dashboard.
 *
 * A column the database never leaves empty that is missing from a row means the response is not what the route promises, so it is an
 * error for the screen to report; a nullable column that holds nothing stays null. Nothing here turns a missing figure into zero.
 */
import { ApiShapeError, isRecord } from '@/lib/client/api-envelope';
import { asRecord, optionalString, requiredString } from '@/lib/client/row-fields';

export type MetricTrend = 'up' | 'down' | 'stable';

/** One stored metric (analytics_metrics) as GET /api/analytics/metrics answers it, most recent period first. */
export interface MetricPoint {
  id: string;
  metricType: string;
  value: number;
  unit: string | null;
  periodType: string;
  periodStart: string;
  periodEnd: string;
  trend: MetricTrend | null;
}

export interface KpiConfig {
  id: string;
  name: string;
  description: string | null;
  metricType: string;
  visualizationType: string;
  targetValue: number | null;
  warningThreshold: number | null;
  criticalThreshold: number | null;
  direction: string | null;
  isActive: boolean;
}

export interface Insight {
  id: string;
  insightType: string;
  priority: string;
  title: string;
  description: string;
  recommendations: string[];
  status: string;
  actionRequired: boolean;
  createdAt: string;
}

export interface TrendAnalysis {
  id: string;
  analysisType: string;
  detectedTrend: string | null;
  confidence: number | null;
  insights: string | null;
  anomalyCount: number | null;
}

/** A numeric column: Postgres numeric arrives as a string. null stays null. */
export function decimalOrNull(row: Record<string, unknown>, key: string): number | null {
  const value = row[key];
  if (value === null || value === undefined) return null;
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) throw new ApiShapeError(`${key} is not a number`);
  return parsed;
}

function requiredDecimal(row: Record<string, unknown>, key: string): number {
  const value = decimalOrNull(row, key);
  if (value === null) throw new ApiShapeError(`${key} is missing`);
  return value;
}

function requiredDate(row: Record<string, unknown>, key: string): string {
  const value = requiredString(row, key);
  if (Number.isNaN(new Date(value).getTime())) throw new ApiShapeError(`${key} is not a date`);
  return value;
}

function readTrend(value: unknown): MetricTrend | null {
  return value === 'up' || value === 'down' || value === 'stable' ? value : null;
}

export function readMetric(value: unknown): MetricPoint {
  const row = asRecord(value, 'metric');
  return {
    id: requiredString(row, 'id'),
    metricType: requiredString(row, 'metricType'),
    value: requiredDecimal(row, 'metricValue'),
    unit: optionalString(row, 'metricUnit'),
    periodType: requiredString(row, 'periodType'),
    periodStart: requiredDate(row, 'periodStart'),
    periodEnd: requiredDate(row, 'periodEnd'),
    trend: readTrend(row.trend),
  };
}

/** GET /api/analytics/metrics answers its own { success, metrics } body (a role-guarded route, not a withApi one). */
export function readMetrics(body: unknown): MetricPoint[] {
  if (!isRecord(body) || body.success !== true || !Array.isArray(body.metrics)) throw new ApiShapeError('no metrics');
  return body.metrics.map(readMetric);
}

export function readKpi(value: unknown): KpiConfig {
  const row = asRecord(value, 'kpi');
  return {
    id: requiredString(row, 'id'),
    name: requiredString(row, 'name'),
    description: optionalString(row, 'description'),
    metricType: requiredString(row, 'metricType'),
    visualizationType: requiredString(row, 'visualizationType'),
    targetValue: decimalOrNull(row, 'targetValue'),
    warningThreshold: decimalOrNull(row, 'warningThreshold'),
    criticalThreshold: decimalOrNull(row, 'criticalThreshold'),
    direction: optionalString(row, 'direction'),
    isActive: row.isActive !== false,
  };
}

/** A recommendation is stored as text or as { description }; anything else is shown as the JSON it is rather than as an object React cannot render. */
function recommendationText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (isRecord(value) && typeof value.description === 'string') return value.description;
  return JSON.stringify(value);
}

export function readInsight(value: unknown): Insight {
  const row = asRecord(value, 'insight');
  return {
    id: requiredString(row, 'id'),
    insightType: requiredString(row, 'insightType'),
    priority: requiredString(row, 'priority'),
    title: requiredString(row, 'title'),
    description: requiredString(row, 'description'),
    recommendations: Array.isArray(row.recommendations) ? row.recommendations.map(recommendationText) : [],
    // The column's own default: an insight nobody has triaged is new.
    status: optionalString(row, 'status') ?? 'new',
    actionRequired: row.actionRequired === true,
    createdAt: requiredDate(row, 'createdAt'),
  };
}

export function readTrendAnalysis(value: unknown): TrendAnalysis {
  const row = asRecord(value, 'trend analysis');
  return {
    id: requiredString(row, 'id'),
    analysisType: requiredString(row, 'analysisType'),
    detectedTrend: optionalString(row, 'detectedTrend'),
    confidence: decimalOrNull(row, 'confidence'),
    insights: optionalString(row, 'insights'),
    anomalyCount: decimalOrNull(row, 'anomalyCount'),
  };
}
