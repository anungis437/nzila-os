/**
 * CLC Executive Intelligence — Time-Series Intelligence Extensions
 *
 * Extends the base decision-intelligence time-series capabilities with:
 * - Pattern classification (spike, sustained rise, cyclical, declining, volatile)
 * - Acceleration detection (change in velocity over time)
 * - Persistence scoring (how long signal has remained elevated)
 * - Lightweight lag correlation (identify if one sector leads another)
 *
 * @module time-series
 */

import type {
  TimeSeriesPatternType,
  TimeSeriesIntelligence,
  LagCorrelation,
  TrendBadge,
} from '../contracts/index';
import type { TimeSeriesPoint, TrendAnalysis } from '@nzila/clc-decision-intelligence';

// ── Pattern Classification ──────────────────────────────────────────────────

/**
 * Classify a time-series into a high-level pattern type.
 *
 * Maps from detailed TrendClassification to executive-facing pattern types.
 */
export function classifyTimeSeriesPattern(
  series: TimeSeriesPoint[],
  trendAnalysis: TrendAnalysis,
): TimeSeriesPatternType {
  if (series.length < 2) return 'stable';

  const { classification, velocity, isPersistent } = trendAnalysis;

  // Map from detailed classification to executive pattern
  switch (classification) {
    case 'sudden_spike':
      return 'spike';
    case 'rising_steadily':
    case 'pre_bargaining_acceleration':
    case 'persistent_elevated':
      return 'sustained_rise';
    case 'gradual_decline':
    case 'returning_to_baseline':
      return 'declining';
    case 'volatile':
      return 'volatile';
    case 'stable':
      return 'stable';
    default:
      break;
  }

  // Cyclical detection: look for alternating direction changes
  if (isCyclical(series)) return 'cyclical';

  // Fallback based on velocity and persistence
  if (Math.abs(velocity) < 0.5) return 'stable';
  if (velocity > 0 && isPersistent) return 'sustained_rise';
  if (velocity < 0 && isPersistent) return 'declining';
  return 'volatile';
}

/**
 * Detect cyclical patterns: multiple direction changes with relative stability.
 */
function isCyclical(series: TimeSeriesPoint[]): boolean {
  if (series.length < 5) return false;

  const sorted = [...series].sort((a, b) => a.period.localeCompare(b.period));
  let directionChanges = 0;

  for (let i = 2; i < sorted.length; i++) {
    const prev = sorted[i - 1]!.value - sorted[i - 2]!.value;
    const curr = sorted[i]!.value - sorted[i - 1]!.value;
    if ((prev > 0 && curr < 0) || (prev < 0 && curr > 0)) {
      directionChanges++;
    }
  }

  // Cyclical if direction changes ≥ 40% of periods
  return directionChanges / (sorted.length - 2) >= 0.4;
}

// ── Persistence Scoring ─────────────────────────────────────────────────────

/**
 * Compute how long a signal has remained elevated above baseline.
 * Returns a 0-1 score where 1 = persistently elevated for all periods.
 */
export function computePersistence(series: TimeSeriesPoint[]): {
  persistenceScore: number;
  isPersistent: boolean;
  elevatedPeriods: number;
  totalPeriods: number;
} {
  if (series.length < 2) {
    return { persistenceScore: 0, isPersistent: false, elevatedPeriods: 0, totalPeriods: 0 };
  }

  const sorted = [...series].sort((a, b) => a.period.localeCompare(b.period));
  const mean = sorted.reduce((s, p) => s + p.value, 0) / sorted.length;
  const threshold = mean * 1.1; // 10% above mean = "elevated"

  let elevatedCount = 0;
  let consecutiveElevated = 0;
  let maxConsecutive = 0;

  for (const point of sorted) {
    if (point.value > threshold) {
      elevatedCount++;
      consecutiveElevated++;
      maxConsecutive = Math.max(maxConsecutive, consecutiveElevated);
    } else {
      consecutiveElevated = 0;
    }
  }

  const persistenceScore = Math.min(1, maxConsecutive / Math.max(1, sorted.length - 1));
  const isPersistent = persistenceScore >= 0.5 && elevatedCount >= 3;

  return {
    persistenceScore: Math.round(persistenceScore * 100) / 100,
    isPersistent,
    elevatedPeriods: elevatedCount,
    totalPeriods: sorted.length,
  };
}

// ── Acceleration Detection ──────────────────────────────────────────────────

/**
 * Compute acceleration: change in velocity over time.
 * Positive = accelerating growth, Negative = decelerating.
 */
export function computeAcceleration(series: TimeSeriesPoint[]): number {
  if (series.length < 3) return 0;

  const sorted = [...series].sort((a, b) => a.period.localeCompare(b.period));
  const velocities: number[] = [];

  for (let i = 1; i < sorted.length; i++) {
    velocities.push(sorted[i]!.value - sorted[i - 1]!.value);
  }

  let totalAccel = 0;
  for (let i = 1; i < velocities.length; i++) {
    totalAccel += (velocities[i]! - velocities[i - 1]!);
  }

  return Math.round((totalAccel / (velocities.length - 1)) * 100) / 100;
}

// ── Lag Correlation ─────────────────────────────────────────────────────────

/**
 * Detect lightweight lag correlation between sectors.
 * Identifies if one sector's movements precede another's.
 *
 * Uses a simplified cross-correlation approach: shift one series
 * and compute correlation at each lag offset.
 */
export function detectLagCorrelation(
  sectorSeries: Array<{ sector: string; series: TimeSeriesPoint[] }>,
): LagCorrelation[] {
  const correlations: LagCorrelation[] = [];
  const maxLag = 3; // Max lag periods to check

  for (let i = 0; i < sectorSeries.length; i++) {
    for (let j = i + 1; j < sectorSeries.length; j++) {
      const a = sectorSeries[i]!;
      const b = sectorSeries[j]!;

      const result = computeLagCorrelation(a.series, b.series, maxLag);
      if (result) {
        correlations.push({
          leadingSector: result.lag > 0 ? a.sector : b.sector,
          laggingSector: result.lag > 0 ? b.sector : a.sector,
          lagPeriods: Math.abs(result.lag),
          correlationStrength: result.strength,
        });
      }
    }
  }

  return correlations
    .filter((c) => c.correlationStrength >= 0.5 && c.lagPeriods > 0)
    .sort((a, b) => b.correlationStrength - a.correlationStrength);
}

/**
 * Compute the best lag correlation between two series.
 */
function computeLagCorrelation(
  seriesA: TimeSeriesPoint[],
  seriesB: TimeSeriesPoint[],
  maxLag: number,
): { lag: number; strength: number } | null {
  const a = [...seriesA].sort((x, y) => x.period.localeCompare(y.period)).map((p) => p.value);
  const b = [...seriesB].sort((x, y) => x.period.localeCompare(y.period)).map((p) => p.value);

  const minLength = Math.min(a.length, b.length);
  if (minLength < 3) return null;

  let bestLag = 0;
  let bestCorr = 0;

  for (let lag = -maxLag; lag <= maxLag; lag++) {
    const corr = computePearsonCorrelation(a, b, lag, minLength);
    if (Math.abs(corr) > Math.abs(bestCorr)) {
      bestCorr = corr;
      bestLag = lag;
    }
  }

  return {
    lag: bestLag,
    strength: Math.round(Math.abs(bestCorr) * 100) / 100,
  };
}

/**
 * Compute Pearson correlation between two value arrays at a given lag.
 */
function computePearsonCorrelation(
  a: number[],
  b: number[],
  lag: number,
  maxLen: number,
): number {
  const start = Math.max(0, lag);
  const end = Math.min(maxLen, maxLen + lag);
  const n = end - start;

  if (n < 3) return 0;

  const aSlice = a.slice(start, end);
  const bSlice = b.slice(start - lag, end - lag);

  const meanA = aSlice.reduce((s, v) => s + v, 0) / n;
  const meanB = bSlice.reduce((s, v) => s + v, 0) / n;

  let num = 0;
  let denA = 0;
  let denB = 0;

  for (let i = 0; i < n; i++) {
    const dA = (aSlice[i] ?? 0) - meanA;
    const dB = (bSlice[i] ?? 0) - meanB;
    num += dA * dB;
    denA += dA * dA;
    denB += dB * dB;
  }

  const den = Math.sqrt(denA * denB);
  return den === 0 ? 0 : num / den;
}

// ── Full Intelligence Builder ───────────────────────────────────────────────

/**
 * Build complete time-series intelligence from a raw series and trend analysis.
 */
export function buildTimeSeriesIntelligence(
  series: TimeSeriesPoint[],
  trendAnalysis: TrendAnalysis,
  sectorSeries?: Array<{ sector: string; series: TimeSeriesPoint[] }>,
): TimeSeriesIntelligence {
  const pattern = classifyTimeSeriesPattern(series, trendAnalysis);
  const acceleration = computeAcceleration(series);
  const persistence = computePersistence(series);
  const lagCorrelations = sectorSeries ? detectLagCorrelation(sectorSeries) : [];

  return {
    pattern,
    acceleration,
    persistenceScore: persistence.persistenceScore,
    isPersistent: persistence.isPersistent,
    lagCorrelations,
  };
}

// ── UI Helpers ──────────────────────────────────────────────────────────────

/**
 * Create a trend badge for UI display.
 */
export function createTrendBadge(pattern: TimeSeriesPatternType): TrendBadge {
  const labels: Record<TimeSeriesPatternType, string> = {
    spike: 'Spike',
    sustained_rise: 'Sustained Rise',
    cyclical: 'Cyclical',
    declining: 'Declining',
    volatile: 'Volatile',
    stable: 'Stable',
  };

  const severities: Record<TimeSeriesPatternType, 'info' | 'warning' | 'danger'> = {
    spike: 'danger',
    sustained_rise: 'warning',
    cyclical: 'info',
    declining: 'info',
    volatile: 'warning',
    stable: 'info',
  };

  return {
    pattern,
    label: labels[pattern],
    severity: severities[pattern],
  };
}
