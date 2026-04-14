/**
 * Tests — Metrics Module
 *
 * Validates pure computation of streaming dashboard metrics.
 * No AWS or DB dependencies.
 */
import { describe, it, expect } from 'vitest'
import { computeStreamingMetrics } from '../src/metrics'

describe('metrics', () => {
  describe('computeStreamingMetrics', () => {
    it('should return zero metrics for empty inputs', () => {
      const result = computeStreamingMetrics([], [], [])
      expect(result.live.total).toBe(0)
      expect(result.live.active).toBe(0)
      expect(result.jobs.total).toBe(0)
      expect(result.jobs.completed).toBe(0)
    })

    it('should count active streams correctly', () => {
      const streams = [
        { status: 'live', startedAt: '2025-01-01' },
        { status: 'ready', startedAt: null },
        { status: 'ended', startedAt: '2025-01-01', endedAt: '2025-01-02' },
        { status: 'scheduled', startedAt: null },
      ]
      const result = computeStreamingMetrics(streams as never[], [], [])
      expect(result.live.total).toBe(4)
      expect(result.live.active).toBe(2) // live + ready
    })

    it('should compute job metrics with averages', () => {
      const jobs = [
        { status: 'completed', submittedAt: '2025-01-01T00:00:00Z', completedAt: '2025-01-01T00:05:00Z' },
        { status: 'completed', submittedAt: '2025-01-01T00:00:00Z', completedAt: '2025-01-01T00:10:00Z' },
        { status: 'failed', submittedAt: '2025-01-01T00:00:00Z' },
        { status: 'processing', submittedAt: '2025-01-01T00:00:00Z' },
      ]

      const result = computeStreamingMetrics([], jobs as never[], [])
      expect(result.jobs.total).toBe(4)
      expect(result.jobs.completed).toBe(2)
      expect(result.jobs.failed).toBe(1)
      expect(result.jobs.processing).toBe(1)
      // Average of 5min + 10min = 7.5min = 450s
      expect(result.jobs.avgProcessingTimeSec).toBeCloseTo(450, 0)
    })

    it('should categorize playback events', () => {
      const events = [
        { eventType: 'playback_granted' },
        { eventType: 'playback_granted' },
        { eventType: 'playback_denied' },
        { eventType: 'stream_created' },
        { eventType: 'provider_error' },
      ]

      const result = computeStreamingMetrics([], [], events as never[])
      expect(result.playback.granted).toBe(2)
      expect(result.playback.denied).toBe(1)
      expect(result.playback.successRate).toBeCloseTo(2 / 3, 2)
      expect(result.errors.total).toBe(1)
    })
  })
})
