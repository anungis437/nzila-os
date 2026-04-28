/**
 * Console performance store — ring buffer + percentile contract.
 *
 * Locks the shape so /ops/performance can read with confidence.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  recordVital,
  recordRoute,
  summarizeVitals,
  summarizeRoutes,
  summarizeFailedActions,
  isCollecting,
  __resetForTests,
} from './store'

describe('console perf store', () => {
  beforeEach(() => __resetForTests())

  it('returns null + zero count when no samples', () => {
    const v = summarizeVitals()
    expect(v.find(s => s.name === 'LCP')?.p75).toBeNull()
    expect(v.find(s => s.name === 'LCP')?.count).toBe(0)
    expect(isCollecting()).toBe(false)
  })

  it('records vitals and computes p75 correctly', () => {
    for (let i = 1; i <= 100; i += 1) {
      recordVital({ name: 'LCP', value: i * 10, route: '/today', ts: Date.now() })
    }
    const v = summarizeVitals().find(s => s.name === 'LCP')!
    expect(v.count).toBe(100)
    // 75th percentile of [10..1000] step 10 → ~750
    expect(v.p75).toBeGreaterThanOrEqual(740)
    expect(v.p75).toBeLessThanOrEqual(770)
    expect(isCollecting()).toBe(true)
  })

  it('windows samples by recency', () => {
    const old = Date.now() - 30 * 60 * 60 * 1000 // 30h ago
    recordVital({ name: 'INP', value: 50, route: '/x', ts: old })
    recordVital({ name: 'INP', value: 200, route: '/x', ts: Date.now() })
    const inp24h = summarizeVitals(24 * 60 * 60 * 1000).find(s => s.name === 'INP')!
    expect(inp24h.count).toBe(1)
    expect(inp24h.p75).toBe(200)
  })

  it('summarizes route p95 and sorts slowest first', () => {
    const now = Date.now()
    for (let i = 0; i < 20; i += 1) {
      recordRoute({ route: '/a', durationMs: 100, status: 200, ts: now })
    }
    for (let i = 0; i < 20; i += 1) {
      recordRoute({ route: '/b', durationMs: 800, status: 200, ts: now })
    }
    const top = summarizeRoutes()
    expect(top[0].route).toBe('/b')
    expect(top[0].p95).toBe(800)
  })

  it('records 5xx as failed actions with count and lastAt', () => {
    const t = Date.now()
    recordRoute({ route: '/boom', durationMs: 50, status: 500, ts: t })
    recordRoute({ route: '/boom', durationMs: 60, status: 503, ts: t + 1 })
    recordRoute({ route: '/ok',   durationMs: 30, status: 200, ts: t })
    const failed = summarizeFailedActions()
    expect(failed).toHaveLength(1)
    expect(failed[0].route).toBe('/boom')
    expect(failed[0].count).toBe(2)
    expect(failed[0].lastAt).toBe(t + 1)
  })

  it('caps the vitals ring at the configured maximum', () => {
    for (let i = 0; i < 3000; i += 1) {
      recordVital({ name: 'TTFB', value: i, route: '/x', ts: Date.now() })
    }
    const v = summarizeVitals().find(s => s.name === 'TTFB')!
    // Bounded at MAX_VITALS = 2000
    expect(v.count).toBeLessThanOrEqual(2000)
    expect(v.count).toBeGreaterThan(0)
  })
})
