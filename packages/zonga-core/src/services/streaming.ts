/**
 * @nzila/zonga-core — Streaming Analytics & Fraud Detection Service
 *
 * Pure functions for stream event analysis, fraud signal scoring,
 * and playback anomaly detection.
 *
 * Zero I/O — callers supply data, callers persist results.
 *
 * @module @nzila/zonga-core/services/streaming
 */

import type { StreamEvent } from '../types/index'
import type { FraudSignalType } from '../enums'

// ── Stream Aggregation ──────────────────────────────────────────────────────

export interface StreamSummary {
  readonly totalStreams: number
  readonly totalDurationSeconds: number
  readonly uniqueListeners: number
  readonly avgCompletionPercent: number
  readonly byCountry: ReadonlyMap<string, number>
  readonly byQuality: ReadonlyMap<string, number>
}

/**
 * Aggregates raw stream events into a summary.
 * Pure function — operates entirely on the provided data.
 */
export function aggregateStreamEvents(events: readonly StreamEvent[]): StreamSummary {
  if (events.length === 0) {
    return {
      totalStreams: 0,
      totalDurationSeconds: 0,
      uniqueListeners: 0,
      avgCompletionPercent: 0,
      byCountry: new Map(),
      byQuality: new Map(),
    }
  }

  const listeners = new Set<string | null>()
  const byCountry = new Map<string, number>()
  const byQuality = new Map<string, number>()
  let totalDuration = 0
  let totalCompletion = 0

  for (const e of events) {
    if (e.listenerId !== null) listeners.add(e.listenerId)
    totalDuration += e.durationSeconds
    totalCompletion += e.completionPercent

    const country = e.country ?? 'unknown'
    byCountry.set(country, (byCountry.get(country) ?? 0) + 1)
    byQuality.set(e.quality, (byQuality.get(e.quality) ?? 0) + 1)
  }

  return {
    totalStreams: events.length,
    totalDurationSeconds: totalDuration,
    uniqueListeners: listeners.size,
    avgCompletionPercent: Math.round((totalCompletion / events.length) * 100) / 100,
    byCountry,
    byQuality,
  }
}

// ── Fraud Signal Scoring ────────────────────────────────────────────────────

export interface FraudScore {
  readonly score: number // 0.0–1.0
  readonly signals: readonly FraudSignal[]
  readonly shouldAutoBlock: boolean
}

export interface FraudSignal {
  readonly type: FraudSignalType
  readonly weight: number
  readonly description: string
}

/** Weights for each fraud signal type (sum doesn't need to be 1). */
const SIGNAL_WEIGHTS: Readonly<Record<FraudSignalType, number>> = {
  stream_spike: 0.3,
  bot_pattern: 0.5,
  repeated_short_plays: 0.4,
  geo_anomaly: 0.25,
  mass_upload: 0.15,
  payout_anomaly: 0.35,
  metadata_poisoning: 0.2,
  account_takeover: 0.6,
  duplicate_content: 0.2,
}

/** Threshold above which payouts are automatically blocked. */
const AUTO_BLOCK_THRESHOLD = 0.7

/**
 * Scores a set of fraud signals and determines if automatic blocking
 * should be applied. Pure function.
 */
export function scoreFraudSignals(signals: readonly FraudSignal[]): FraudScore {
  if (signals.length === 0) {
    return { score: 0, signals, shouldAutoBlock: false }
  }

  // Weighted sum, capped at 1.0
  let weightedSum = 0
  for (const signal of signals) {
    weightedSum += signal.weight * (SIGNAL_WEIGHTS[signal.type] ?? 0.1)
  }

  const score = Math.min(1.0, Math.round(weightedSum * 1000) / 1000)

  return {
    score,
    signals,
    shouldAutoBlock: score >= AUTO_BLOCK_THRESHOLD,
  }
}

// ── Stream Anomaly Detection ────────────────────────────────────────────────

export interface StreamAnomaly {
  readonly type: FraudSignalType
  readonly description: string
  readonly severity: 'low' | 'medium' | 'high'
  readonly affectedAssetIds: readonly string[]
}

/**
 * Detects anomalous patterns in stream events for a single asset
 * over a time window. Pure function.
 *
 * Checks:
 * 1. Short-play ratio (plays < 30s / total) > 70% → repeated_short_plays
 * 2. Unique listeners / total streams ratio < 5% → bot_pattern
 * 3. Single country > 95% of streams (with 50+ streams) → geo_anomaly
 */
export function detectStreamAnomalies(
  events: readonly StreamEvent[],
  assetId: string,
): readonly StreamAnomaly[] {
  if (events.length < 10) return [] // Not enough data

  const anomalies: StreamAnomaly[] = []

  // 1. Short-play ratio
  const shortPlays = events.filter((e) => e.durationSeconds < 30).length
  const shortPlayRatio = shortPlays / events.length
  if (shortPlayRatio > 0.7) {
    anomalies.push({
      type: 'repeated_short_plays',
      description: `${Math.round(shortPlayRatio * 100)}% of plays are under 30 seconds`,
      severity: shortPlayRatio > 0.9 ? 'high' : 'medium',
      affectedAssetIds: [assetId],
    })
  }

  // 2. Bot pattern detection
  const uniqueListeners = new Set(events.filter((e): e is StreamEvent & { listenerId: string } => e.listenerId !== null).map((e) => e.listenerId)).size
  const botRatio = uniqueListeners / events.length
  if (botRatio < 0.05 && events.length >= 50) {
    anomalies.push({
      type: 'bot_pattern',
      description: `Only ${uniqueListeners} unique listeners for ${events.length} streams (${Math.round(botRatio * 100)}%)`,
      severity: 'high',
      affectedAssetIds: [assetId],
    })
  }

  // 3. Geo-anomaly
  const countryMap = new Map<string, number>()
  for (const e of events) {
    const country = e.country ?? 'unknown'
    countryMap.set(country, (countryMap.get(country) ?? 0) + 1)
  }
  if (events.length >= 50) {
    for (const [country, count] of countryMap) {
      const ratio = count / events.length
      if (ratio > 0.95) {
        anomalies.push({
          type: 'geo_anomaly',
          description: `${Math.round(ratio * 100)}% of streams from ${country}`,
          severity: 'medium',
          affectedAssetIds: [assetId],
        })
      }
    }
  }

  return anomalies
}
