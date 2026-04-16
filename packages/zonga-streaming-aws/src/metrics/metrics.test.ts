/**
 * Tests — Metrics Module
 *
 * Validates pure computation of streaming dashboard metrics.
 * No AWS or DB dependencies.
 */
import { describe, it, expect } from 'vitest'
import { computeStreamingMetrics } from '.'

describe('metrics', () => {
  describe('computeStreamingMetrics', () => {
    it('should return zero metrics for empty inputs', () => {
      const result = computeStreamingMetrics([], [], [])
      expect(result.liveStreams.active).toBe(0)
      expect(result.liveStreams.scheduled).toBe(0)
      expect(result.mediaJobs.backlogSize).toBe(0)
      expect(result.mediaJobs.completed).toBe(0)
    })

    it('should count active streams correctly', () => {
      const streams = [
        { status: 'live', startedAt: '2025-01-01' },
        { status: 'ready', startedAt: null },
        { status: 'ended', startedAt: '2025-01-01', endedAt: '2025-01-02' },
        { status: 'scheduled', startedAt: null },
      ]
      const result = computeStreamingMetrics(streams as never[], [], [])
      expect(result.liveStreams.active).toBe(1)
      expect(result.liveStreams.scheduled).toBe(2) // ready + scheduled
      expect(result.liveStreams.ended).toBe(1)
    })

    it('should compute job metrics with averages', () => {
      const jobs = [
        { status: 'completed', submittedAt: '2025-01-01T00:00:00Z', completedAt: '2025-01-01T00:05:00Z' },
        { status: 'completed', submittedAt: '2025-01-01T00:00:00Z', completedAt: '2025-01-01T00:10:00Z' },
        { status: 'failed', submittedAt: '2025-01-01T00:00:00Z' },
        { status: 'processing', submittedAt: '2025-01-01T00:00:00Z' },
      ]

      const result = computeStreamingMetrics([], jobs as never[], [])
      expect(result.mediaJobs.completed).toBe(2)
      expect(result.mediaJobs.failed).toBe(1)
      expect(result.mediaJobs.processing).toBe(1)
      expect(result.mediaJobs.backlogSize).toBe(1)
      // Average of 5min + 10min = 7.5min = 450s
      expect(result.mediaJobs.avgProcessingTimeSec).toBeCloseTo(450, 0)
    })

    it('should categorize playback events', () => {
      const events = [
        { eventType: 'playback_granted' },
        { eventType: 'playback_granted' },
        { eventType: 'playback_denied' },
        { eventType: 'stream_created' },
        { eventType: 'stream_failed' },
      ]

      const result = computeStreamingMetrics([], [], events as never[])
      expect(result.playbackGrants.granted).toBe(2)
      expect(result.playbackGrants.denied).toBe(1)
      expect(result.playbackGrants.successRate).toBe(67)
      expect(result.providerErrors.total).toBe(1)
    })
  })
})
