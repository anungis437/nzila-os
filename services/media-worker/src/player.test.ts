import { describe, it, expect } from 'vitest'
import {
  PlaybackEventType,
  REVENUE_STREAM_THRESHOLDS,
  qualifyStream,
  createPlaybackSessionManager,
} from './player'

describe('qualifyStream', () => {
  it('qualifies when above minimum duration', () => {
    const result = qualifyStream({
      durationPlayedMs: 35_000,
      totalDurationMs: 180_000,
      dailyPlaysForTrack: 0,
    })
    expect(result.qualifies).toBe(true)
    expect(result.reason).toBeNull()
  })

  it('rejects below minimum duration', () => {
    const result = qualifyStream({
      durationPlayedMs: 15_000,
      totalDurationMs: 180_000,
      dailyPlaysForTrack: 0,
    })
    expect(result.qualifies).toBe(false)
    expect(result.reason).toContain('below minimum')
  })

  it('rejects when daily play limit reached', () => {
    const result = qualifyStream({
      durationPlayedMs: 60_000,
      totalDurationMs: 180_000,
      dailyPlaysForTrack: 50,
    })
    expect(result.qualifies).toBe(false)
    expect(result.reason).toContain('Daily play limit')
  })

  it('calculates completion percentage', () => {
    const result = qualifyStream({
      durationPlayedMs: 90_000,
      totalDurationMs: 180_000,
      dailyPlaysForTrack: 0,
    })
    expect(result.completionPercent).toBe(50)
  })

  it('handles zero total duration', () => {
    const result = qualifyStream({
      durationPlayedMs: 0,
      totalDurationMs: 0,
      dailyPlaysForTrack: 0,
    })
    expect(result.completionPercent).toBe(0)
  })
})

describe('PlaybackEventType', () => {
  it('has all expected event types', () => {
    expect(PlaybackEventType.PLAY).toBe('play')
    expect(PlaybackEventType.PAUSE).toBe('pause')
    expect(PlaybackEventType.COMPLETE).toBe('complete')
    expect(PlaybackEventType.SKIP).toBe('skip')
    expect(PlaybackEventType.SEEK).toBe('seek')
    expect(PlaybackEventType.ERROR).toBe('error')
    expect(PlaybackEventType.BUFFER_STALL).toBe('buffer_stall')
    expect(PlaybackEventType.QUALITY_CHANGE).toBe('quality_change')
  })
})

describe('REVENUE_STREAM_THRESHOLDS', () => {
  it('has 30 second minimum', () => {
    expect(REVENUE_STREAM_THRESHOLDS.MIN_DURATION_MS).toBe(30_000)
  })

  it('has 50 max daily plays', () => {
    expect(REVENUE_STREAM_THRESHOLDS.MAX_DAILY_PLAYS_PER_TRACK).toBe(50)
  })
})

describe('createPlaybackSessionManager', () => {
  it('starts a session and emits play event', async () => {
    const events: string[] = []
    const manager = createPlaybackSessionManager({
      onPlaybackEvent: async (event) => { events.push(event.type) },
      onRevenueStream: async () => {},
    })

    const session = await manager.startSession({
      sessionId: 'sess-1',
      listenerId: 'user-1',
      assetId: 'asset-1',
      orgId: 'org-1',
      quality: 'high',
      protocol: 'hls',
      resumePositionMs: 0,
      lowDataMode: false,
    })

    expect(session.sessionId).toBe('sess-1')
    expect(events).toContain('play')
  })

  it('endSession qualifies revenue stream and fires callback', async () => {
    let revenueSessionId: string | null = null
    const manager = createPlaybackSessionManager({
      onPlaybackEvent: async () => {},
      onRevenueStream: async (sessionId) => { revenueSessionId = sessionId },
    })

    const result = await manager.endSession({
      sessionId: 'sess-1',
      listenerId: 'user-1',
      assetId: 'asset-1',
      orgId: 'org-1',
      finalPositionMs: 60_000,
      totalDurationMs: 180_000,
      dailyPlaysForTrack: 0,
    })

    expect(result.qualifies).toBe(true)
    expect(revenueSessionId).toBe('sess-1')
  })

  it('endSession does not fire revenue callback for unqualified', async () => {
    let revenueFired = false
    const manager = createPlaybackSessionManager({
      onPlaybackEvent: async () => {},
      onRevenueStream: async () => { revenueFired = true },
    })

    await manager.endSession({
      sessionId: 'sess-1',
      listenerId: 'user-1',
      assetId: 'asset-1',
      orgId: 'org-1',
      finalPositionMs: 5_000, // too short
      totalDurationMs: 180_000,
      dailyPlaysForTrack: 0,
    })

    expect(revenueFired).toBe(false)
  })
})
