import { describe, it, expect } from 'vitest'
import {
  aggregateStreamEvents,
  scoreFraudSignals,
  detectStreamAnomalies,
} from './services/streaming'
import type { StreamEvent } from './types/index'
import { AudioQuality, StreamProtocol, FraudSignalType } from './enums'
import type { FraudSignal } from './services/streaming'

// ── Helpers ─────────────────────────────────────────────────────────────────

const BASE_EVENT: StreamEvent = {
  id: '110e8400-e29b-41d4-a716-446655440001',
  orgId: '220e8400-e29b-41d4-a716-446655440002',
  listenerId: '330e8400-e29b-41d4-a716-446655440003',
  assetId: '440e8400-e29b-41d4-a716-446655440004',
  startedAt: '2025-06-01T12:00:00Z',
  endedAt: '2025-06-01T12:03:30Z',
  durationSeconds: 210,
  quality: AudioQuality.HIGH,
  protocol: StreamProtocol.PROGRESSIVE,
  deviceType: 'mobile',
  country: 'NG',
  city: 'Lagos',
  completionPercent: 95,
  offline: false,
}

function makeStreamEvent(overrides: Partial<StreamEvent> = {}): StreamEvent {
  return { ...BASE_EVENT, ...overrides }
}

function makeEvents(count: number, overrides: Partial<StreamEvent> = {}): StreamEvent[] {
  return Array.from({ length: count }, (_, i) =>
    makeStreamEvent({ id: `event-${i}`, listenerId: `listener-${i}`, ...overrides }),
  )
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('@nzila/zonga-core — streaming service', () => {
  describe('aggregateStreamEvents', () => {
    it('returns zeroed summary for empty events', () => {
      const summary = aggregateStreamEvents([])
      expect(summary.totalStreams).toBe(0)
      expect(summary.totalDurationSeconds).toBe(0)
      expect(summary.uniqueListeners).toBe(0)
      expect(summary.avgCompletionPercent).toBe(0)
      expect(summary.byCountry.size).toBe(0)
      expect(summary.byQuality.size).toBe(0)
    })

    it('computes correct totals for single event', () => {
      const summary = aggregateStreamEvents([BASE_EVENT])
      expect(summary.totalStreams).toBe(1)
      expect(summary.totalDurationSeconds).toBe(210)
      expect(summary.uniqueListeners).toBe(1)
      expect(summary.avgCompletionPercent).toBe(95)
    })

    it('aggregates multiple events correctly', () => {
      const events = [
        makeStreamEvent({ durationSeconds: 100, completionPercent: 80, country: 'NG' }),
        makeStreamEvent({ id: 'e2', listenerId: 'l2', durationSeconds: 200, completionPercent: 100, country: 'KE' }),
        makeStreamEvent({ id: 'e3', listenerId: 'l3', durationSeconds: 150, completionPercent: 60, country: 'NG' }),
      ]
      const summary = aggregateStreamEvents(events)
      expect(summary.totalStreams).toBe(3)
      expect(summary.totalDurationSeconds).toBe(450)
      expect(summary.uniqueListeners).toBe(3)
      expect(summary.avgCompletionPercent).toBe(80)
    })

    it('counts unique listeners correctly (deduplicates)', () => {
      const events = [
        makeStreamEvent({ id: 'e1', listenerId: 'same-listener' }),
        makeStreamEvent({ id: 'e2', listenerId: 'same-listener' }),
        makeStreamEvent({ id: 'e3', listenerId: 'different-listener' }),
      ]
      const summary = aggregateStreamEvents(events)
      expect(summary.uniqueListeners).toBe(2)
    })

    it('groups by country', () => {
      const events = [
        makeStreamEvent({ id: 'e1', country: 'NG' }),
        makeStreamEvent({ id: 'e2', country: 'NG' }),
        makeStreamEvent({ id: 'e3', country: 'KE' }),
        makeStreamEvent({ id: 'e4', country: null }),
      ]
      const summary = aggregateStreamEvents(events)
      expect(summary.byCountry.get('NG')).toBe(2)
      expect(summary.byCountry.get('KE')).toBe(1)
      expect(summary.byCountry.get('unknown')).toBe(1)
    })

    it('groups by audio quality', () => {
      const events = [
        makeStreamEvent({ id: 'e1', quality: AudioQuality.HIGH }),
        makeStreamEvent({ id: 'e2', quality: AudioQuality.LOW }),
        makeStreamEvent({ id: 'e3', quality: AudioQuality.HIGH }),
      ]
      const summary = aggregateStreamEvents(events)
      expect(summary.byQuality.get('high')).toBe(2)
      expect(summary.byQuality.get('low')).toBe(1)
    })

    it('excludes null listenerIds from unique count', () => {
      const events = [
        makeStreamEvent({ id: 'e1', listenerId: null }),
        makeStreamEvent({ id: 'e2', listenerId: null }),
        makeStreamEvent({ id: 'e3', listenerId: 'real-listener' }),
      ]
      const summary = aggregateStreamEvents(events)
      expect(summary.uniqueListeners).toBe(1)
    })
  })

  describe('scoreFraudSignals', () => {
    it('returns zero score for no signals', () => {
      const result = scoreFraudSignals([])
      expect(result.score).toBe(0)
      expect(result.shouldAutoBlock).toBe(false)
      expect(result.signals).toHaveLength(0)
    })

    it('scores a single low-weight signal', () => {
      const signals: FraudSignal[] = [
        { type: FraudSignalType.MASS_UPLOAD, weight: 0.5, description: 'Bulk upload detected' },
      ]
      const result = scoreFraudSignals(signals)
      // weight * SIGNAL_WEIGHTS[mass_upload] = 0.5 * 0.15 = 0.075
      expect(result.score).toBe(0.075)
      expect(result.shouldAutoBlock).toBe(false)
    })

    it('auto-blocks when score exceeds threshold', () => {
      const signals: FraudSignal[] = [
        { type: FraudSignalType.ACCOUNT_TAKEOVER, weight: 1.0, description: 'Account compromised' },
        { type: FraudSignalType.BOT_PATTERN, weight: 0.8, description: 'Bot activity' },
      ]
      const result = scoreFraudSignals(signals)
      // account_takeover: 1.0 * 0.6 = 0.6, bot_pattern: 0.8 * 0.5 = 0.4
      // total = 1.0 (capped), >= 0.7 threshold
      expect(result.shouldAutoBlock).toBe(true)
      expect(result.score).toBe(1.0)
    })

    it('preserves signal references in result', () => {
      const signals: FraudSignal[] = [
        { type: FraudSignalType.GEO_ANOMALY, weight: 0.5, description: '95% from one country' },
      ]
      const result = scoreFraudSignals(signals)
      expect(result.signals).toEqual(signals)
    })

    it('caps score at 1.0', () => {
      const signals: FraudSignal[] = [
        { type: FraudSignalType.ACCOUNT_TAKEOVER, weight: 2.0, description: 'Severe' },
        { type: FraudSignalType.BOT_PATTERN, weight: 2.0, description: 'Severe' },
        { type: FraudSignalType.PAYOUT_ANOMALY, weight: 2.0, description: 'Severe' },
      ]
      const result = scoreFraudSignals(signals)
      expect(result.score).toBe(1.0)
    })
  })

  describe('detectStreamAnomalies', () => {
    const ASSET_ID = 'asset-001'

    it('returns empty for fewer than 10 events', () => {
      const events = makeEvents(5)
      expect(detectStreamAnomalies(events, ASSET_ID)).toHaveLength(0)
    })

    it('detects short-play ratio anomaly (> 70%)', () => {
      const events = makeEvents(20, { durationSeconds: 10 }) // All < 30s
      const anomalies = detectStreamAnomalies(events, ASSET_ID)
      const shortPlay = anomalies.find(a => a.type === 'repeated_short_plays')
      expect(shortPlay).toBeDefined()
      expect(shortPlay!.severity).toBe('high') // 100% > 90%
      expect(shortPlay!.affectedAssetIds).toContain(ASSET_ID)
    })

    it('does not flag short-play when ratio is below threshold', () => {
      const events = [
        ...makeEvents(8, { durationSeconds: 10 }),   // 8 short
        ...makeEvents(12, { durationSeconds: 180 }), // 12 normal
      ]
      // 8/20 = 40%, below 70%
      const anomalies = detectStreamAnomalies(events, ASSET_ID)
      expect(anomalies.find(a => a.type === 'repeated_short_plays')).toBeUndefined()
    })

    it('detects bot pattern (unique listeners < 5% of streams, 50+ events)', () => {
      // 60 events, all same listener
      const events = makeEvents(60, { listenerId: 'single-bot' })
      const anomalies = detectStreamAnomalies(events, ASSET_ID)
      const bot = anomalies.find(a => a.type === 'bot_pattern')
      expect(bot).toBeDefined()
      expect(bot!.severity).toBe('high')
    })

    it('does not flag bot pattern with insufficient events (< 50)', () => {
      // 20 events, all same listener = 5% but < 50 events
      const events = makeEvents(20, { listenerId: 'single-bot' })
      const anomalies = detectStreamAnomalies(events, ASSET_ID)
      expect(anomalies.find(a => a.type === 'bot_pattern')).toBeUndefined()
    })

    it('detects geo anomaly (> 95% from single country, 50+ events)', () => {
      const events = [
        ...makeEvents(55, { country: 'NG' }),
        makeStreamEvent({ id: 'outlier', listenerId: 'l-out', country: 'KE' }),
      ]
      // NG: 55/56 = 98.2%, > 95%
      const anomalies = detectStreamAnomalies(events, ASSET_ID)
      const geo = anomalies.find(a => a.type === 'geo_anomaly')
      expect(geo).toBeDefined()
      expect(geo!.description).toContain('NG')
    })

    it('does not flag geo anomaly below threshold', () => {
      const events = [
        ...makeEvents(45, { country: 'NG' }),
        ...makeEvents(10, { country: 'KE' }),
      ]
      // NG: 45/55 ≈ 81.8%, below 95%
      const anomalies = detectStreamAnomalies(events, ASSET_ID)
      expect(anomalies.find(a => a.type === 'geo_anomaly')).toBeUndefined()
    })

    it('can detect multiple anomalies simultaneously', () => {
      // 60 events, all short, all same listener, all same country
      const events = makeEvents(60, {
        durationSeconds: 5,
        listenerId: 'bot-1',
        country: 'ZA',
      })
      const anomalies = detectStreamAnomalies(events, ASSET_ID)
      expect(anomalies.length).toBeGreaterThanOrEqual(2)
      const types = anomalies.map(a => a.type)
      expect(types).toContain('repeated_short_plays')
      expect(types).toContain('bot_pattern')
    })
  })
})
