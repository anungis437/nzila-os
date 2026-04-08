/**
 * CLC Decision Intelligence — Time-Series Intelligence
 *
 * Temporal reasoning utilities for detecting change velocity,
 * acceleration, inflection points, and trend persistence.
 *
 * These utilities layer on top of existing governed analytics
 * to add temporal dimension to static aggregates.
 *
 * @module signals
 */

import type { TimeSeriesPoint, TrendAnalysis, TrendDirection, TrendClassification } from '../contracts/index.js';

// ── Trend Velocity ──────────────────────────────────────────────────────────

/**
 * Compute the average rate of change per period in the time series.
 * Returns 0 for insufficient data (< 2 points).
 */
export function computeTrendVelocity(series: TimeSeriesPoint[]): number {
  if (series.length < 2) return 0;

  const sorted = [...series].sort((a, b) => a.period.localeCompare(b.period));
  let totalDelta = 0;

  for (let i = 1; i < sorted.length; i++) {
    totalDelta += (sorted[i]!.value - sorted[i - 1]!.value);
  }

  return totalDelta / (sorted.length - 1);
}

/**
 * Compute acceleration (change in velocity) over the time series.
 * Positive = accelerating, negative = decelerating.
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

  return totalAccel / (velocities.length - 1);
}

// ── Inflection Point Detection ──────────────────────────────────────────────

/**
 * Detect inflection point — where the trend changes direction.
 * Returns the period and index of the most significant inflection, or null.
 */
export function detectInflectionPoint(
  series: TimeSeriesPoint[],
): { period: string; index: number } | null {
  if (series.length < 3) return null;

  const sorted = [...series].sort((a, b) => a.period.localeCompare(b.period));
  const deltas: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    deltas.push(sorted[i]!.value - sorted[i - 1]!.value);
  }

  let bestIdx = -1;
  let bestMag = 0;

  for (let i = 1; i < deltas.length; i++) {
    const prev = deltas[i - 1]!;
    const curr = deltas[i]!;
    // Sign change = inflection
    if ((prev > 0 && curr < 0) || (prev < 0 && curr > 0)) {
      const magnitude = Math.abs(curr - prev);
      if (magnitude > bestMag) {
        bestMag = magnitude;
        bestIdx = i + 1; // +1 because deltas are offset by 1 from sorted
      }
    }
  }

  if (bestIdx < 0) return null;
  return { period: sorted[bestIdx]!.period, index: bestIdx };
}

// ── Signal Persistence ──────────────────────────────────────────────────────

/**
 * Classify whether a signal is a sustained trend vs. short spike.
 *
 * Uses the coefficient of variation and how many consecutive periods
 * show the same direction.
 *
 * @returns persistenceScore (0-1) and isPersistent flag
 */
export function classifySignalPersistence(
  series: TimeSeriesPoint[],
): { persistenceScore: number; isPersistent: boolean } {
  if (series.length < 2) {
    return { persistenceScore: 0, isPersistent: false };
  }

  const sorted = [...series].sort((a, b) => a.period.localeCompare(b.period));

  // Count consecutive same-direction moves
  let maxConsecutive = 1;
  let currentRun = 1;
  let prevDirection: 'up' | 'down' | null = null;

  for (let i = 1; i < sorted.length; i++) {
    const direction = sorted[i]!.value >= sorted[i - 1]!.value ? 'up' : 'down';
    if (direction === prevDirection) {
      currentRun++;
      maxConsecutive = Math.max(maxConsecutive, currentRun);
    } else {
      currentRun = 1;
    }
    prevDirection = direction;
  }

  // Persistence score: ratio of longest consecutive run to total length
  const persistenceScore = Math.min(1, maxConsecutive / Math.max(sorted.length - 1, 1));
  const isPersistent = persistenceScore >= 0.6 && sorted.length >= 3;

  return { persistenceScore, isPersistent };
}

// ── Full Trend Analysis ─────────────────────────────────────────────────────

/**
 * Perform comprehensive trend analysis on a time series.
 *
 * Combines velocity, acceleration, inflection detection, and persistence
 * into a single TrendAnalysis result.
 */
export function analyzeTrend(series: TimeSeriesPoint[]): TrendAnalysis {
  const velocity = computeTrendVelocity(series);
  const acceleration = computeAcceleration(series);
  const inflection = detectInflectionPoint(series);
  const { persistenceScore, isPersistent } = classifySignalPersistence(series);

  const direction = classifyDirection(velocity);
  const classification = classifyTrend(velocity, acceleration, isPersistent, inflection !== null, series);

  return {
    direction,
    classification,
    velocity: Math.round(velocity * 100) / 100,
    acceleration: Math.round(acceleration * 100) / 100,
    hasInflectionPoint: inflection !== null,
    inflectionPeriod: inflection?.period ?? null,
    isPersistent,
    persistenceScore: Math.round(persistenceScore * 100) / 100,
    description: describeTrend(classification, velocity, acceleration),
  };
}

// ── Internal Helpers ────────────────────────────────────────────────────────

function classifyDirection(velocity: number): TrendDirection {
  const threshold = 0.5;
  if (Math.abs(velocity) < threshold) return 'stable';
  return velocity > 0 ? 'rising' : 'falling';
}

function classifyTrend(
  velocity: number,
  acceleration: number,
  isPersistent: boolean,
  hasInflection: boolean,
  series: TimeSeriesPoint[],
): TrendClassification {
  const absVelocity = Math.abs(velocity);
  const threshold = 0.5;

  // Stable — near-zero velocity
  if (absVelocity < threshold) return 'stable';

  // Check for sudden spike (high velocity, low persistence)
  if (absVelocity > 5 && !isPersistent && series.length >= 3) {
    return 'sudden_spike';
  }

  // Returning to baseline — has inflection + decelerating toward zero
  if (hasInflection && velocity > 0 && acceleration < -threshold) {
    return 'returning_to_baseline';
  }

  // Pre-bargaining acceleration — rising with positive acceleration
  if (velocity > threshold && acceleration > threshold && isPersistent) {
    return 'pre_bargaining_acceleration';
  }

  // Persistent elevated level — high values but stable velocity
  if (isPersistent && absVelocity < 2 && series.length >= 4) {
    const mean = series.reduce((s, p) => s + p.value, 0) / series.length;
    const lastThird = series.slice(-Math.ceil(series.length / 3));
    const lastMean = lastThird.reduce((s, p) => s + p.value, 0) / lastThird.length;
    if (lastMean > mean * 1.2) {
      return 'persistent_elevated';
    }
  }

  // Rising steadily
  if (velocity > threshold && isPersistent) {
    return 'rising_steadily';
  }

  // Gradual decline
  if (velocity < -threshold && isPersistent) {
    return 'gradual_decline';
  }

  // Volatile — not persistent, not stable
  if (!isPersistent && absVelocity >= threshold) {
    return 'volatile';
  }

  return 'stable';
}

function describeTrend(
  classification: TrendClassification,
  velocity: number,
  acceleration: number,
): string {
  const descriptions: Record<TrendClassification, string> = {
    rising_steadily: `Rising steadily at ${Math.abs(velocity).toFixed(1)} per period.`,
    sudden_spike: `Sudden spike detected (velocity: ${velocity.toFixed(1)}). May not be sustained.`,
    persistent_elevated: 'Persistent elevated level maintained across multiple periods.',
    returning_to_baseline: `Previously elevated, now decelerating (${acceleration.toFixed(1)}/period²). Returning toward baseline.`,
    pre_bargaining_acceleration: `Accelerating trend detected (velocity: ${velocity.toFixed(1)}, acceleration: ${acceleration.toFixed(1)}). Pre-bargaining pressure build-up possible.`,
    gradual_decline: `Gradual decline at ${Math.abs(velocity).toFixed(1)} per period.`,
    stable: 'Stable — no significant change detected.',
    volatile: `Volatile — significant changes (velocity: ${velocity.toFixed(1)}) without consistent direction.`,
  };
  return descriptions[classification];
}
