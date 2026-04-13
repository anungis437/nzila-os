import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
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
  createTranscodeService,
} from './transcoder'
import { createInMemoryStorageAdapter, hlsManifestPath, previewPath, waveformPath } from './storage'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'media-worker-'))
  tempDirs.push(dir)
  return dir
}

function createSuccessfulFfmpeg() {
  return {
    async execute(args: readonly string[]) {
      const output = args[args.length - 1]

      if (args.includes('-f') && args.includes('hls')) {
        const playlistPath = output as string
        const segmentPath = String(args[args.indexOf('-hls_segment_filename') + 1]).replace('%05d', '00000')
        await mkdir(dirname(playlistPath), { recursive: true })
        await writeFile(playlistPath, '#EXTM3U')
        await writeFile(segmentPath, new Uint8Array([8, 9]))
        return { exitCode: 0, stderr: '' }
      }

      await mkdir(dirname(String(output)), { recursive: true })
      if (String(output).endsWith('.raw')) {
        const pcm = Buffer.alloc(16)
        pcm.writeInt16LE(5000, 0)
        pcm.writeInt16LE(-5000, 2)
        await writeFile(String(output), pcm)
      } else {
        await writeFile(String(output), new Uint8Array([1, 2, 3, 4]))
      }

      return { exitCode: 0, stderr: '' }
    },
    async probe() {
      return { durationSeconds: 120, codec: 'aac', sampleRate: 44100 }
    },
  }
}

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

describe('createTranscodeService', () => {
  it('processes a full job with HLS, preview, waveform, and progress reporting', async () => {
    const storage = createInMemoryStorageAdapter()
    const tempDir = await createTempDir()
    const progress: string[] = []
    const sourceKey = 'audio/raw/asset-1/source.wav'
    await storage.upload({ key: sourceKey, body: new Uint8Array([1, 2, 3]), contentType: 'audio/wav' })

    const service = createTranscodeService({
      storage,
      ffmpeg: createSuccessfulFfmpeg(),
      cdnBaseUrl: 'https://cdn.example.com',
      tempDir,
      onProgress: (entry) => {
        progress.push(entry.phase)
      },
    })

    const result = await service.processJob({
      jobId: 'job-1',
      assetId: 'asset-1',
      orgId: 'org-1',
      sourceKey,
      targetQualities: ['low', 'high'],
      generateHls: true,
      normalize: true,
    })

    expect(result.status).toBe('completed')
    expect(result.outputs).toHaveLength(2)
    expect(result.hlsManifestUrl).toBe('https://cdn.example.com/audio/hls/asset-1/master.m3u8')
    expect(result.previewUrl).toBe('https://cdn.example.com/audio/preview/asset-1/preview.mp4')
    expect(result.waveformUrl).toBe('https://cdn.example.com/audio/waveform/asset-1/waveform.json')
    expect(progress).toEqual([
      'download',
      'probe',
      'transcode',
      'transcode',
      'hls',
      'preview',
      'waveform',
      'complete',
    ])
    expect(await storage.exists(hlsManifestPath('asset-1'))).toBe(true)
    expect(await storage.exists(previewPath('asset-1'))).toBe(true)
    expect(await storage.exists(waveformPath('asset-1'))).toBe(true)

    const waveformJson = await readFile(join(tempDir, 'job-1_waveform.raw'))
    expect(waveformJson.byteLength).toBeGreaterThan(0)
  })

  it('short-circuits when the HLS manifest already exists', async () => {
    const storage = createInMemoryStorageAdapter()
    const tempDir = await createTempDir()
    await storage.upload({
      key: hlsManifestPath('asset-2'),
      body: new TextEncoder().encode('#EXTM3U'),
      contentType: 'application/vnd.apple.mpegurl',
    })

    const service = createTranscodeService({
      storage,
      ffmpeg: createSuccessfulFfmpeg(),
      cdnBaseUrl: 'https://cdn.example.com',
      tempDir,
    })

    const result = await service.processJob({
      jobId: 'job-2',
      assetId: 'asset-2',
      orgId: 'org-1',
      sourceKey: 'audio/raw/asset-2/source.wav',
      targetQualities: ['medium'],
      generateHls: true,
      normalize: false,
    })

    expect(result.status).toBe('completed')
    expect(result.outputs).toEqual([])
    expect(result.hlsManifestUrl).toBe('https://cdn.example.com/audio/hls/asset-2/master.m3u8')
    expect(result.durationSeconds).toBe(0)
  })

  it('returns failed when a quality transcode exits non-zero', async () => {
    const storage = createInMemoryStorageAdapter()
    const tempDir = await createTempDir()
    const sourceKey = 'audio/raw/asset-3/source.wav'
    await storage.upload({ key: sourceKey, body: new Uint8Array([1]), contentType: 'audio/wav' })

    const service = createTranscodeService({
      storage,
      ffmpeg: {
        async execute(args) {
          if (args.includes('128k')) {
            return { exitCode: 1, stderr: 'codec exploded' }
          }
          await writeFile(String(args[args.length - 1]), new Uint8Array([1]))
          return { exitCode: 0, stderr: '' }
        },
        async probe() {
          return { durationSeconds: 30, codec: 'aac', sampleRate: 44100 }
        },
      },
      cdnBaseUrl: 'https://cdn.example.com',
      tempDir,
    })

    const result = await service.processJob({
      jobId: 'job-3',
      assetId: 'asset-3',
      orgId: 'org-1',
      sourceKey,
      targetQualities: ['medium'],
      generateHls: false,
      normalize: false,
    })

    expect(result.status).toBe('failed')
    expect(result.error).toContain('FFmpeg transcode failed for medium')
    expect(result.outputs).toEqual([])
  })

  it('keeps preview and waveform best-effort when those phases fail', async () => {
    const storage = createInMemoryStorageAdapter()
    const tempDir = await createTempDir()
    const sourceKey = 'audio/raw/asset-4/source.wav'
    await storage.upload({ key: sourceKey, body: new Uint8Array([1]), contentType: 'audio/wav' })

    const service = createTranscodeService({
      storage,
      ffmpeg: {
        async execute(args) {
          const output = String(args[args.length - 1])
          if (output.endsWith('_preview.m4a')) {
            throw new Error('preview unavailable')
          }
          if (output.endsWith('_waveform.raw')) {
            return { exitCode: 1, stderr: 'waveform unavailable' }
          }
          await mkdir(dirname(output), { recursive: true })
          await writeFile(output, new Uint8Array([1, 2, 3]))
          return { exitCode: 0, stderr: '' }
        },
        async probe() {
          return { durationSeconds: 60, codec: 'aac', sampleRate: 44100 }
        },
      },
      cdnBaseUrl: 'https://cdn.example.com',
      tempDir,
    })

    const result = await service.processJob({
      jobId: 'job-4',
      assetId: 'asset-4',
      orgId: 'org-1',
      sourceKey,
      targetQualities: ['low'],
      generateHls: false,
      normalize: false,
    })

    expect(result.status).toBe('completed')
    expect(result.outputs).toHaveLength(1)
    expect(result.previewUrl).toBeNull()
    expect(result.waveformUrl).toBeNull()
  })
})
