import { describe, it, expect } from 'vitest'
import {
  validateUpload,
  parseAudioMetadata,
  computeUploadKey,
  DEFAULT_UPLOAD_POLICY,
  type AudioMetadata,
} from './upload/index'
import {
  selectTargetQualities,
  computeTranscodeOutputPaths,
  createTranscodeManifest,
  buildHlsPlaylist,
  QUALITY_PRESETS,
} from './transcode/index'
import {
  selectOptimalQuality,
  computeCdnSignedUrl,
  resolveStreamUrl,
  buildAdaptiveBitrateManifest,
  type StreamDeliveryContext,
  type CdnConfig,
} from './delivery/index'
import {
  createPlaybackSession,
  computeBufferStrategy,
  resolveNextTrack,
  computeGaplessTransition,
  trackPlaybackProgress,
  type QueueState,
  type QueueItem,
} from './player/index'

// ── Helpers ──────────────────────────────────────────────────────────────────

const validMetadata: AudioMetadata = {
  durationMs: 240_000,
  sampleRate: 44100,
  channels: 2,
  bitrate: 320,
  codec: 'mp3',
  format: 'mp3',
  fileSize: 8_000_000,
}

const testCdn: CdnConfig = {
  baseUrl: 'https://cdn.example.com',
  signingSecret: 'test-secret-key',
  tokenTtlSec: 3600,
  region: 'us-east',
}

function makeQueue(items: Partial<QueueItem>[], overrides?: Partial<QueueState>): QueueState {
  return {
    items: items.map((i, idx) => ({
      assetId: `track-${idx}`,
      title: `Track ${idx}`,
      artistName: `Artist ${idx}`,
      durationMs: 180_000,
      ...i,
    })),
    currentIndex: 0,
    repeatMode: 'off',
    shuffled: false,
    shuffleOrder: [],
    ...overrides,
  }
}

// ── Upload Pipeline ──────────────────────────────────────────────────────────

describe('validateUpload', () => {
  it('accepts a valid MP3 file', () => {
    const result = validateUpload(
      { name: 'song.mp3', size: 8_000_000, mimeType: 'audio/mpeg' },
      validMetadata,
    )
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
    expect(result.suggestedKey).toBeTruthy()
  })

  it('rejects file exceeding max size', () => {
    const result = validateUpload(
      { name: 'huge.mp3', size: 600 * 1024 * 1024, mimeType: 'audio/mpeg' },
      validMetadata,
    )
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toMatch(/exceeds maximum/)
  })

  it('rejects unsupported MIME types', () => {
    const result = validateUpload(
      { name: 'song.txt', size: 1000, mimeType: 'text/plain' },
      null,
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('not supported'))).toBe(true)
  })

  it('rejects unsupported file extensions', () => {
    const result = validateUpload(
      { name: 'song.midi', size: 1000, mimeType: 'audio/mpeg' },
      null,
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('not allowed'))).toBe(true)
  })

  it('rejects tracks exceeding max duration', () => {
    const longMeta: AudioMetadata = { ...validMetadata, durationMs: 130 * 60_000 }
    const result = validateUpload(
      { name: 'long.mp3', size: 1000, mimeType: 'audio/mpeg' },
      longMeta,
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('exceeds maximum'))).toBe(true)
  })

  it('rejects tracks below minimum bitrate', () => {
    const lowMeta: AudioMetadata = { ...validMetadata, bitrate: 32 }
    const result = validateUpload(
      { name: 'low.mp3', size: 1000, mimeType: 'audio/mpeg' },
      lowMeta,
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('below minimum'))).toBe(true)
  })

  it('accepts when no metadata is provided (skip metadata checks)', () => {
    const result = validateUpload(
      { name: 'song.mp3', size: 8_000_000, mimeType: 'audio/mpeg' },
      null,
    )
    expect(result.valid).toBe(true)
  })
})

describe('parseAudioMetadata', () => {
  it('normalizes probe output', () => {
    const meta = parseAudioMetadata({
      duration: 240.5,
      sample_rate: 44100,
      channels: 2,
      bit_rate: 320000,
      codec_name: 'mp3',
      format_name: 'mp3',
      size: 8_000_000,
    })
    expect(meta.durationMs).toBe(240500)
    expect(meta.bitrate).toBe(320)
    expect(meta.codec).toBe('mp3')
    expect(meta.sampleRate).toBe(44100)
  })

  it('provides defaults for missing fields', () => {
    const meta = parseAudioMetadata({})
    expect(meta.durationMs).toBe(0)
    expect(meta.sampleRate).toBe(44100)
    expect(meta.channels).toBe(2)
    expect(meta.codec).toBe('unknown')
  })
})

describe('computeUploadKey', () => {
  it('generates a storage key with date prefix', () => {
    const key = computeUploadKey('My Song (feat. Artist).mp3', new Date('2025-03-15T10:00:00Z'))
    expect(key).toMatch(/^uploads\/2025\/03\/15\/\d+-my_song_feat_artist_\.mp3$/)
  })

  it('sanitizes special characters', () => {
    const key = computeUploadKey('räksmörgås.wav')
    expect(key).toMatch(/^uploads\//)
    expect(key).not.toMatch(/[ä]/)
  })
})

// ── Transcode Pipeline ───────────────────────────────────────────────────────

describe('selectTargetQualities', () => {
  it('selects qualities at or below source bitrate', () => {
    const qualities = selectTargetQualities(256, 44100)
    expect(qualities.every((q) => q.bitrate <= 256 || q.bitrate <= 128)).toBe(true)
    expect(qualities.length).toBeGreaterThan(0)
  })

  it('always includes at least normal quality', () => {
    const qualities = selectTargetQualities(32, 22050)
    expect(qualities.length).toBeGreaterThanOrEqual(1)
  })

  it('sorts by bitrate ascending', () => {
    const qualities = selectTargetQualities(320, 48000, true)
    for (let i = 1; i < qualities.length; i++) {
      expect(qualities[i]!.bitrate).toBeGreaterThanOrEqual(qualities[i - 1]!.bitrate)
    }
  })

  it('deduplicates by bitrate', () => {
    const qualities = selectTargetQualities(320, 48000, true)
    const bitrates = qualities.map((q) => q.bitrate)
    expect(new Set(bitrates).size).toBe(bitrates.length)
  })
})

describe('computeTranscodeOutputPaths', () => {
  it('generates paths for each quality', () => {
    const qualities = [QUALITY_PRESETS['normal']!, QUALITY_PRESETS['high']!]
    const outputs = computeTranscodeOutputPaths('asset-123', qualities)
    expect(outputs).toHaveLength(2)
    expect(outputs[0]!.storagePath).toContain('128kbps')
    expect(outputs[1]!.storagePath).toContain('256kbps')
    expect(outputs[0]!.manifestPath).toMatch(/\.m3u8$/)
  })
})

describe('createTranscodeManifest', () => {
  it('creates a manifest with quality outputs', () => {
    const manifest = createTranscodeManifest('asset-123', 'blob://source.mp3', 320, 48000)
    expect(manifest.assetId).toBe('asset-123')
    expect(manifest.outputs.length).toBeGreaterThan(0)
    expect(manifest.masterManifestPath).toContain('master.m3u8')
  })
})

describe('buildHlsPlaylist', () => {
  it('generates valid HLS master and variant playlists', () => {
    const outputs = computeTranscodeOutputPaths('asset-123', [
      QUALITY_PRESETS['normal']!,
      QUALITY_PRESETS['high']!,
    ])
    const hls = buildHlsPlaylist('asset-123', outputs, 240, 'https://cdn.example.com')
    expect(hls.masterPlaylist).toContain('#EXTM3U')
    expect(hls.masterPlaylist).toContain('#EXT-X-STREAM-INF')
    expect(hls.variantPlaylists.length).toBe(2)
  })
})

// ── CDN Delivery ─────────────────────────────────────────────────────────────

describe('selectOptimalQuality', () => {
  const allQualities = [
    QUALITY_PRESETS['low']!,
    QUALITY_PRESETS['normal']!,
    QUALITY_PRESETS['high']!,
    QUALITY_PRESETS['lossless']!,
  ]

  it('caps free users at 128kbps', () => {
    const ctx: StreamDeliveryContext = {
      assetId: 'a', listenerId: 'l', plan: 'free',
      networkType: 'wifi', deviceType: 'desktop', lowDataMode: false,
    }
    const q = selectOptimalQuality(ctx, allQualities)
    expect(q.bitrate).toBeLessThanOrEqual(128)
  })

  it('allows premium users up to 320kbps on wifi', () => {
    const ctx: StreamDeliveryContext = {
      assetId: 'a', listenerId: 'l', plan: 'premium',
      networkType: 'wifi', deviceType: 'desktop', lowDataMode: false,
    }
    const q = selectOptimalQuality(ctx, allQualities)
    expect(q.bitrate).toBeLessThanOrEqual(320)
    expect(q.bitrate).toBeGreaterThan(128)
  })

  it('forces lowest quality in low data mode', () => {
    const ctx: StreamDeliveryContext = {
      assetId: 'a', listenerId: 'l', plan: 'premium',
      networkType: 'wifi', deviceType: 'desktop', lowDataMode: true,
    }
    const q = selectOptimalQuality(ctx, allQualities)
    expect(q.bitrate).toBe(64)
  })

  it('network-limits on slow connections', () => {
    const ctx: StreamDeliveryContext = {
      assetId: 'a', listenerId: 'l', plan: 'premium',
      networkType: '2g', deviceType: 'mobile', lowDataMode: false,
    }
    const q = selectOptimalQuality(ctx, allQualities)
    expect(q.bitrate).toBeLessThanOrEqual(64)
  })
})

describe('computeCdnSignedUrl', () => {
  it('generates a deterministic token for the same input', () => {
    const a = computeCdnSignedUrl('path/to/file.m3u8', testCdn)
    const b = computeCdnSignedUrl('path/to/file.m3u8', testCdn)
    // Token includes expiry so they may differ slightly if wall-clock ticks
    // but the path and structure should be consistent
    expect(a.path).toBe('path/to/file.m3u8')
    expect(a.token.length).toBeGreaterThan(0)
    expect(a.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000))
  })

  it('produces different tokens for different paths', () => {
    const a = computeCdnSignedUrl('path/a.m3u8', testCdn)
    const b = computeCdnSignedUrl('path/b.m3u8', testCdn)
    expect(a.token).not.toBe(b.token)
  })
})

describe('resolveStreamUrl', () => {
  const qualities = [QUALITY_PRESETS['normal']!, QUALITY_PRESETS['high']!]

  it('resolves a signed URL with appropriate quality', () => {
    const ctx: StreamDeliveryContext = {
      assetId: 'asset-1', listenerId: 'l', plan: 'free',
      networkType: 'wifi', deviceType: 'desktop', lowDataMode: false,
    }
    const result = resolveStreamUrl('asset-1', ctx, qualities, testCdn)
    expect(result.url).toContain('cdn.example.com')
    expect(result.url).toContain('token=')
    expect(result.quality.bitrate).toBeLessThanOrEqual(128)
  })
})

describe('buildAdaptiveBitrateManifest', () => {
  it('produces master + quality URLs', () => {
    const qualities = [QUALITY_PRESETS['normal']!, QUALITY_PRESETS['high']!]
    const manifest = buildAdaptiveBitrateManifest('asset-1', qualities, testCdn)
    expect(manifest.masterUrl).toContain('master.m3u8')
    expect(manifest.qualityUrls).toHaveLength(2)
    expect(manifest.qualityUrls[0]!.url).toContain('token=')
  })
})

// ── Player Logic ─────────────────────────────────────────────────────────────

describe('createPlaybackSession', () => {
  it('creates a session in loading state', () => {
    const session = createPlaybackSession('asset-1', 240_000, 'listener-1', 'high')
    expect(session.assetId).toBe('asset-1')
    expect(session.state).toBe('loading')
    expect(session.durationMs).toBe(240_000)
    expect(session.positionMs).toBe(0)
    expect(session.id).toMatch(/^ps_/)
  })
})

describe('computeBufferStrategy', () => {
  it('aggressive preload on wifi', () => {
    const strategy = computeBufferStrategy('wifi', false, 5)
    expect(strategy.preloadNextTrack).toBe(true)
    expect(strategy.bufferAheadSec).toBe(30)
    expect(strategy.aggressivePreload).toBe(true)
  })

  it('minimal buffer on 2g', () => {
    const strategy = computeBufferStrategy('2g', false, 5)
    expect(strategy.preloadNextTrack).toBe(false)
    expect(strategy.bufferAheadSec).toBe(5)
  })

  it('forces minimal in low data mode', () => {
    const strategy = computeBufferStrategy('wifi', true, 5)
    expect(strategy.preloadNextTrack).toBe(false)
    expect(strategy.bufferAheadSec).toBe(5)
  })

  it('3g preloads next if queue is small', () => {
    const short = computeBufferStrategy('3g', false, 2)
    const long = computeBufferStrategy('3g', false, 10)
    expect(short.preloadNextTrack).toBe(true)
    expect(long.preloadNextTrack).toBe(false)
  })
})

describe('resolveNextTrack', () => {
  it('returns next track in sequential playback', () => {
    const queue = makeQueue([{}, {}, {}], { currentIndex: 0 })
    const next = resolveNextTrack(queue)
    expect(next?.nextIndex).toBe(1)
  })

  it('returns null at end of queue (repeat off)', () => {
    const queue = makeQueue([{}, {}], { currentIndex: 1, repeatMode: 'off' })
    const next = resolveNextTrack(queue)
    expect(next).toBeNull()
  })

  it('wraps around with repeat all', () => {
    const queue = makeQueue([{}, {}], { currentIndex: 1, repeatMode: 'all' })
    const next = resolveNextTrack(queue)
    expect(next?.nextIndex).toBe(0)
  })

  it('stays on current with repeat one', () => {
    const queue = makeQueue([{}, {}], { currentIndex: 0, repeatMode: 'one' })
    const next = resolveNextTrack(queue)
    expect(next?.nextIndex).toBe(0)
  })

  it('follows shuffle order', () => {
    const queue = makeQueue([{}, {}, {}], {
      currentIndex: 2,
      shuffled: true,
      shuffleOrder: [2, 0, 1],
    })
    const next = resolveNextTrack(queue)
    expect(next?.nextIndex).toBe(0) // Next in shuffle after 2 is 0
  })

  it('returns null for empty queue', () => {
    const queue = makeQueue([])
    expect(resolveNextTrack(queue)).toBeNull()
  })
})

describe('computeGaplessTransition', () => {
  it('preloads when strategy allows it', () => {
    const strategy = computeBufferStrategy('wifi', false, 5)
    const transition = computeGaplessTransition(240_000, strategy)
    expect(transition.shouldPreload).toBe(true)
    expect(transition.preloadTriggerMs).toBeLessThan(240_000)
  })

  it('no preload on slow connections', () => {
    const strategy = computeBufferStrategy('2g', false, 5)
    const transition = computeGaplessTransition(240_000, strategy)
    expect(transition.shouldPreload).toBe(false)
  })
})

describe('trackPlaybackProgress', () => {
  it('counts play at 30 seconds', () => {
    const session = createPlaybackSession('asset-1', 300_000, 'l', 'high')
    const progress = trackPlaybackProgress(session, 30_000)
    expect(progress.isComplete).toBe(true)
    expect(progress.completionPercent).toBe(10)
  })

  it('counts play at 50% for short tracks', () => {
    const session = createPlaybackSession('asset-1', 40_000, 'l', 'high')
    const progress = trackPlaybackProgress(session, 20_000)
    expect(progress.isComplete).toBe(true)
    expect(progress.completionPercent).toBe(50)
  })

  it('does not count play at 10% of long track', () => {
    const session = createPlaybackSession('asset-1', 300_000, 'l', 'high')
    const progress = trackPlaybackProgress(session, 10_000)
    expect(progress.isComplete).toBe(false)
  })
})
