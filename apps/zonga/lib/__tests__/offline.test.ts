/**
 * Zonga — Offline-First & Africa Optimization Tests
 *
 * Tests network-adaptive quality selection, queue management,
 * cache key generation, download budget estimation, and USSD formatting.
 */
import { describe, it, expect } from 'vitest'
import {
  NetworkQuality,
  StreamingQuality,
  selectStreamingQuality,
  sortByPriority,
  retryableActions,
  computeBackoffMs,
  trackCacheKey,
  artworkCacheKey,
  checkinCacheKey,
  estimateTrackSize,
  tracksWithinBudget,
  formatUssdAmount,
  buildUssdOrderSummary,
} from '../offline'
import type { QueuedAction } from '../offline'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeAction(partial?: Partial<QueuedAction>): QueuedAction {
  return {
    id: 'act-1',
    type: 'stream_play',
    payload: {},
    queuedAt: '2025-06-01T10:00:00Z',
    retryCount: 0,
    maxRetries: 3,
    priority: 5,
    ...partial,
  }
}

// ── Streaming Quality Selection ──────────────────────────────────────────────

describe('selectStreamingQuality', () => {
  it('returns LOW for offline', () => {
    expect(selectStreamingQuality(NetworkQuality.OFFLINE, false)).toBe(StreamingQuality.LOW)
  })

  it('returns LOW for edge networks', () => {
    expect(selectStreamingQuality(NetworkQuality.EDGE, false)).toBe(StreamingQuality.LOW)
  })

  it('returns MEDIUM for slow (3G)', () => {
    expect(selectStreamingQuality(NetworkQuality.SLOW, false)).toBe(StreamingQuality.MEDIUM)
  })

  it('returns HIGH for moderate (4G)', () => {
    expect(selectStreamingQuality(NetworkQuality.MODERATE, false)).toBe(StreamingQuality.HIGH)
  })

  it('returns HIGH for wifi', () => {
    expect(selectStreamingQuality(NetworkQuality.WIFI, false)).toBe(StreamingQuality.HIGH)
  })

  it('always returns LOW when data saver is on', () => {
    expect(selectStreamingQuality(NetworkQuality.WIFI, true)).toBe(StreamingQuality.LOW)
    expect(selectStreamingQuality(NetworkQuality.FAST, true)).toBe(StreamingQuality.LOW)
  })
})

// ── Queue Management ─────────────────────────────────────────────────────────

describe('sortByPriority', () => {
  it('sorts by priority ascending, then FIFO', () => {
    const actions = [
      makeAction({ id: 'c', priority: 10, queuedAt: '2025-06-01T10:00:00Z' }),
      makeAction({ id: 'a', priority: 1, queuedAt: '2025-06-01T10:00:00Z' }),
      makeAction({ id: 'b', priority: 1, queuedAt: '2025-06-01T09:00:00Z' }),
    ]
    const sorted = sortByPriority(actions)
    expect(sorted[0]!.id).toBe('b')  // priority 1, earlier time
    expect(sorted[1]!.id).toBe('a')  // priority 1, later time
    expect(sorted[2]!.id).toBe('c')  // priority 10
  })
})

describe('retryableActions', () => {
  it('filters out actions that exceeded retries', () => {
    const actions = [
      makeAction({ id: 'a', retryCount: 0, maxRetries: 3 }),
      makeAction({ id: 'b', retryCount: 3, maxRetries: 3 }),
      makeAction({ id: 'c', retryCount: 5, maxRetries: 3 }),
    ]
    const retryable = retryableActions(actions)
    expect(retryable).toHaveLength(1)
    expect(retryable[0]!.id).toBe('a')
  })
})

describe('computeBackoffMs', () => {
  it('returns base delay for retry 0', () => {
    const delay = computeBackoffMs(0)
    // base=1000, jitter up to 30% → 1000–1300
    expect(delay).toBeGreaterThanOrEqual(1000)
    expect(delay).toBeLessThanOrEqual(1300)
  })

  it('doubles for each retry', () => {
    const d1 = computeBackoffMs(1)
    expect(d1).toBeGreaterThanOrEqual(2000)
  })

  it('caps at 5 minutes', () => {
    const d20 = computeBackoffMs(20)
    // Max is 300000 + 30% jitter = 390000
    expect(d20).toBeLessThanOrEqual(390_000)
  })
})

// ── Cache Keys ───────────────────────────────────────────────────────────────

describe('cache keys', () => {
  it('generates track cache key', () => {
    expect(trackCacheKey('t123', StreamingQuality.HIGH)).toBe('zonga:audio:t123:high')
  })

  it('generates artwork cache key', () => {
    expect(artworkCacheKey('album', 'a456')).toBe('zonga:artwork:album:a456')
  })

  it('generates checkin cache key', () => {
    expect(checkinCacheKey('evt-789')).toBe('zonga:checkin:evt-789')
  })
})

// ── Download Budget ──────────────────────────────────────────────────────────

describe('estimateTrackSize', () => {
  it('estimates low quality track size (64kbps = 8KB/s)', () => {
    const size = estimateTrackSize(210, StreamingQuality.LOW) // 3.5 min
    // 210s * 8000 B/s = 1,680,000 bytes
    expect(size).toBe(1_680_000)
  })

  it('estimates high quality track size (256kbps = 32KB/s)', () => {
    const size = estimateTrackSize(210, StreamingQuality.HIGH)
    // 210s * 32000 B/s = 6,720,000
    expect(size).toBe(6_720_000)
  })
})

describe('tracksWithinBudget', () => {
  it('computes correct track count for budget', () => {
    // 100MB budget, low quality (1.68MB per 3.5min track)
    const budget = 100 * 1024 * 1024 // 100MB
    const count = tracksWithinBudget(budget, StreamingQuality.LOW)
    expect(count).toBeGreaterThan(50)
    expect(count).toBeLessThan(70)
  })

  it('returns 0 for tiny budget', () => {
    expect(tracksWithinBudget(100, StreamingQuality.HIGH)).toBe(0)
  })
})

// ── USSD Formatting ──────────────────────────────────────────────────────────

describe('formatUssdAmount', () => {
  it('formats with space-separated thousands', () => {
    expect(formatUssdAmount(1500, 'KES')).toBe('KES 1 500')
  })

  it('formats large amounts', () => {
    expect(formatUssdAmount(1234567, 'NGN')).toBe('NGN 1 234 567')
  })

  it('rounds decimals', () => {
    expect(formatUssdAmount(99.9, 'KES')).toBe('KES 100')
  })

  it('handles zero', () => {
    expect(formatUssdAmount(0, 'KES')).toBe('KES 0')
  })
})

describe('buildUssdOrderSummary', () => {
  it('builds multiline summary with total', () => {
    const items = [
      { name: 'GA Ticket', amount: 500 },
      { name: 'VIP Ticket', amount: 1500 },
    ]
    const summary = buildUssdOrderSummary(items, 'KES')
    expect(summary).toContain('GA Ticket: KES 500')
    expect(summary).toContain('VIP Ticket: KES 1 500')
    expect(summary).toContain('Total: KES 2 000')
  })

  it('handles single item', () => {
    const summary = buildUssdOrderSummary([{ name: 'Ticket', amount: 200 }], 'TZS')
    expect(summary).toContain('Total: TZS 200')
  })
})
