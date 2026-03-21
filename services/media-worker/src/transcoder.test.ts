import { describe, it, expect } from 'vitest'
import {
  QUALITY_TIERS,
  ALL_QUALITIES,
  buildTranscodeArgs,
  buildHlsArgs,
  buildMasterPlaylist,
  buildPreviewArgs,
  buildWaveformArgs,
  generateWaveformFromPcm,
  PREVIEW_CONFIG,
  WAVEFORM_CONFIG,
} from './transcoder'

describe('buildTranscodeArgs', () => {
  it('builds args for medium quality without normalization', () => {
    const args = buildTranscodeArgs('/tmp/in.mp3', '/tmp/out.mp4', 'medium', false)
    expect(args).toContain('-i')
    expect(args).toContain('/tmp/in.mp3')
    expect(args).toContain('-b:a')
    expect(args).toContain('128k')
    expect(args).toContain('-ar')
    expect(args).toContain('44100')
    expect(args).not.toContain('loudnorm')
  })

  it('includes loudnorm filter when normalize is true', () => {
    const args = buildTranscodeArgs('/tmp/in.mp3', '/tmp/out.mp4', 'high', true)
    expect(args.join(' ')).toContain('loudnorm')
  })

  it('strips video with -vn', () => {
    const args = buildTranscodeArgs('/tmp/in.mp3', '/tmp/out.mp4', 'low', false)
    expect(args).toContain('-vn')
  })
})

describe('buildHlsArgs', () => {
  it('produces HLS flags', () => {
    const args = buildHlsArgs('/tmp/in.mp3', '/tmp/hls/', 'high', 6)
    expect(args).toContain('-f')
    expect(args).toContain('hls')
    expect(args).toContain('-hls_playlist_type')
    expect(args).toContain('vod')
  })
})

describe('buildMasterPlaylist', () => {
  it('generates valid m3u8 content', () => {
    const playlist = buildMasterPlaylist('track-1', ['low', 'high'], 'https://cdn.example.com')
    expect(playlist).toContain('#EXTM3U')
    expect(playlist).toContain('#EXT-X-STREAM-INF')
    expect(playlist).toContain('BANDWIDTH=64000')
    expect(playlist).toContain('BANDWIDTH=320000')
    expect(playlist).toContain('https://cdn.example.com/audio/hls/track-1/low/playlist.m3u8')
    expect(playlist).toContain('https://cdn.example.com/audio/hls/track-1/high/playlist.m3u8')
  })
})

describe('buildPreviewArgs', () => {
  it('starts at 25% of total duration', () => {
    const args = buildPreviewArgs('/tmp/in.mp3', '/tmp/preview.mp4', 120)
    expect(args).toContain('-ss')
    expect(args).toContain('30') // 25% of 120
  })

  it('limits clip to PREVIEW_CONFIG duration', () => {
    const args = buildPreviewArgs('/tmp/in.mp3', '/tmp/preview.mp4', 300)
    expect(args).toContain('-t')
    expect(args).toContain(String(PREVIEW_CONFIG.DURATION_SECONDS))
  })

  it('includes fade-in and fade-out', () => {
    const args = buildPreviewArgs('/tmp/in.mp3', '/tmp/preview.mp4', 120)
    const afFlag = args[args.indexOf('-af') + 1]
    expect(afFlag).toContain('afade=t=in')
    expect(afFlag).toContain('afade=t=out')
  })

  it('clamps short tracks', () => {
    const args = buildPreviewArgs('/tmp/in.mp3', '/tmp/preview.mp4', 10)
    expect(args).toContain('-ss')
    expect(args).toContain('-t')
    // Duration should be capped at track length
    const tIndex = args.indexOf('-t')
    expect(Number(args[tIndex + 1])).toBeLessThanOrEqual(10)
  })
})

describe('buildWaveformArgs', () => {
  it('outputs raw PCM', () => {
    const args = buildWaveformArgs('/tmp/in.mp3', '/tmp/waveform.raw')
    expect(args).toContain('-f')
    expect(args).toContain(WAVEFORM_CONFIG.FORMAT)
    expect(args).toContain('-ac')
    expect(args).toContain('1')
  })
})

describe('generateWaveformFromPcm', () => {
  it('generates normalized waveform from PCM data', () => {
    // Create a simple PCM buffer (s16le = 2 bytes per sample)
    const numSamples = 400
    const buffer = Buffer.alloc(numSamples * 2)
    for (let i = 0; i < numSamples; i++) {
      const value = Math.round(Math.sin((i / numSamples) * Math.PI * 4) * 16000)
      buffer.writeInt16LE(value, i * 2)
    }

    const waveform = generateWaveformFromPcm(buffer, WAVEFORM_CONFIG.SAMPLES)
    expect(waveform.sampleCount).toBe(WAVEFORM_CONFIG.SAMPLES)
    expect(waveform.samples.length).toBe(WAVEFORM_CONFIG.SAMPLES)
    // All samples should be normalized 0.0–1.0
    for (const s of waveform.samples) {
      expect(s).toBeGreaterThanOrEqual(0)
      expect(s).toBeLessThanOrEqual(1)
    }
    expect(waveform.peakAmplitude).toBeGreaterThan(0)
    expect(waveform.rmsAmplitude).toBeGreaterThan(0)
  })

  it('handles empty buffer', () => {
    const waveform = generateWaveformFromPcm(Buffer.alloc(0), 200)
    expect(waveform.sampleCount).toBe(0)
    expect(waveform.samples).toHaveLength(0)
    expect(waveform.peakAmplitude).toBe(0)
    expect(waveform.rmsAmplitude).toBe(0)
  })
})

describe('Quality Tiers', () => {
  it('ALL_QUALITIES contains three tiers', () => {
    expect(ALL_QUALITIES).toHaveLength(3)
    expect(ALL_QUALITIES).toEqual(['low', 'medium', 'high'])
  })

  it('each tier has required properties', () => {
    for (const q of ALL_QUALITIES) {
      const tier = QUALITY_TIERS[q]
      expect(tier.bitrate).toBeGreaterThan(0)
      expect(tier.codec).toBe('aac')
      expect(tier.sampleRate).toBeGreaterThan(0)
    }
  })
})
