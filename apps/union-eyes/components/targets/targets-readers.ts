/**
 * Reads GET /api/targets/summary, which answers { success, data: { summary, targets }, timestamp } (withApi around { summary, targets }).
 *
 * Each target is the kpi_configurations row's own fields plus what the route works out from the latest stored metric row of the target's metric
 * type: `currentValue` (null when there is no such row or it is too old), `asOf` (the period end of the row used), `stale` (a row exists but is too
 * old to judge against), `progress` (a percentage, null without a value or a non-zero target) and `health`. A figure the route could not compute is
 * null and stays null here: it is never shown as zero.
 */
import { ApiShapeError, envelopeData, isRecord } from '@/lib/client/api-envelope';
import { asRecord, countOrNull, flagOrFalse, optionalString, requiredCount, requiredString } from '@/lib/client/row-fields';

export type TargetHealth = 'on_track' | 'at_risk' | 'critical' | 'no_data';

export interface KPITarget {
  id: string;
  name: string;
  description: string | null;
  metricType: string;
  dataSource: string;
  visualizationType: string;
  targetValue: string | null;
  isActive: boolean;
  health: TargetHealth;
  currentValue: number | null;
  progress: number | null;
  asOf: string | null;
  stale: boolean;
  trend: string | null;
}

export interface TargetSummary {
  total: number;
  onTrack: number;
  atRisk: number;
  critical: number;
  noData: number;
  bySource: Record<string, number>;
}

const HEALTHS: readonly TargetHealth[] = ['on_track', 'at_risk', 'critical', 'no_data'];

function readTarget(value: unknown): KPITarget {
  const row = asRecord(value, 'target');
  const health = HEALTHS.find((candidate) => candidate === row.health);
  if (health === undefined) throw new ApiShapeError('health is not recognised');
  if (typeof row.stale !== 'boolean') throw new ApiShapeError('stale is not a boolean');
  return {
    id: requiredString(row, 'id'),
    name: requiredString(row, 'name'),
    description: optionalString(row, 'description'),
    metricType: requiredString(row, 'metricType'),
    dataSource: requiredString(row, 'dataSource'),
    visualizationType: requiredString(row, 'visualizationType'),
    targetValue: optionalString(row, 'targetValue'),
    isActive: flagOrFalse(row, 'isActive'),
    health,
    currentValue: countOrNull(row, 'currentValue'),
    progress: countOrNull(row, 'progress'),
    asOf: optionalString(row, 'asOf'),
    stale: row.stale,
    trend: optionalString(row, 'trend'),
  };
}

function readSummary(value: unknown): TargetSummary {
  const row = asRecord(value, 'summary');
  if (!isRecord(row.bySource)) throw new ApiShapeError('bySource is missing');
  const bySource: Record<string, number> = {};
  for (const [source, count] of Object.entries(row.bySource)) {
    if (typeof count !== 'number' || !Number.isFinite(count)) throw new ApiShapeError('bySource is not a count');
    bySource[source] = count;
  }
  return {
    total: requiredCount(row, 'total'),
    onTrack: requiredCount(row, 'onTrack'),
    atRisk: requiredCount(row, 'atRisk'),
    critical: requiredCount(row, 'critical'),
    noData: requiredCount(row, 'noData'),
    bySource,
  };
}

export function readTargetsSummary(body: unknown): { summary: TargetSummary; targets: KPITarget[] } {
  const data = envelopeData(body);
  if (!Array.isArray(data.targets)) throw new ApiShapeError('no targets');
  return { summary: readSummary(data.summary), targets: data.targets.map(readTarget) };
}
