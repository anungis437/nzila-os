/**
 * @nzila/media-worker — Transcoding Pipeline
 *
 * Queue-based audio transcoding. Generates multiple quality tiers,
 * HLS segments, preview clips, and waveform data using FFmpeg.
 * Idempotent, retry-safe, observable.
 *
 * @module @nzila/media-worker/transcoder
 */

import type { StorageProvider } from './storage'
import {
  rawPath,
  processedPath,
  hlsManifestPath,
  hlsVariantPath,
  hlsSegmentPath,
  waveformPath,
  previewPath,
} from './storage'

// ── Quality Tiers ───────────────────────────────────────────────────────────

export const QUALITY_TIERS = {
  low: { bitrate: 64, label: '64kbps', codec: 'aac', sampleRate: 22050 },
  medium: { bitrate: 128, label: '128kbps', codec: 'aac', sampleRate: 44100 },
  high: { bitrate: 320, label: '320kbps', codec: 'aac', sampleRate: 48000 },
} as const

export type QualityTier = keyof typeof QUALITY_TIERS

export const ALL_QUALITIES: readonly QualityTier[] = ['low', 'medium', 'high'] as const

// ── Transcode Job ───────────────────────────────────────────────────────────

export interface TranscodeJobInput {
  readonly jobId: string
  readonly assetId: string
  readonly orgId: string
  readonly sourceKey: string
  readonly targetQualities: readonly QualityTier[]
  readonly generateHls: boolean
  readonly normalize: boolean
}

export interface TranscodeJobOutput {
  readonly jobId: string
  readonly assetId: string
  readonly status: 'completed' | 'failed'
  readonly outputs: readonly TranscodeOutputFile[]
  readonly hlsManifestUrl: string | null
  readonly previewUrl: string | null
  readonly waveformUrl: string | null
  readonly durationSeconds: number
  readonly error: string | null
  readonly processingTimeMs: number
}

export interface TranscodeOutputFile {
  readonly quality: QualityTier
  readonly storageKey: string
  readonly sizeBytes: number
  readonly bitrateKbps: number
  readonly codec: string
  readonly durationSeconds: number
}

// ── FFmpeg Command Builder ──────────────────────────────────────────────────

/**
 * Builds FFmpeg arguments for transcoding to a specific quality tier.
 * Pure function — no side effects.
 */
export function buildTranscodeArgs(
  inputPath: string,
  outputPath: string,
  quality: QualityTier,
  normalize: boolean,
): readonly string[] {
  const tier = QUALITY_TIERS[quality]
  const args: string[] = [
    '-i', inputPath,
    '-vn', // strip video
    '-c:a', tier.codec,
    '-b:a', `${tier.bitrate}k`,
    '-ar', String(tier.sampleRate),
    '-ac', '2',
    '-movflags', '+faststart',
  ]

  if (normalize) {
    args.push('-af', 'loudnorm=I=-14:LRA=11:TP=-1')
  }

  args.push('-y', outputPath)
  return args
}

/**
 * Builds FFmpeg arguments for HLS segmentation at a given quality.
 */
export function buildHlsArgs(
  inputPath: string,
  outputDir: string,
  quality: QualityTier,
  segmentDuration: number = 6,
): readonly string[] {
  const tier = QUALITY_TIERS[quality]
  return [
    '-i', inputPath,
    '-vn',
    '-c:a', tier.codec,
    '-b:a', `${tier.bitrate}k`,
    '-ar', String(tier.sampleRate),
    '-ac', '2',
    '-f', 'hls',
    '-hls_time', String(segmentDuration),
    '-hls_list_size', '0',
    '-hls_segment_filename', `${outputDir}/segment_%05d.ts`,
    '-hls_playlist_type', 'vod',
    `${outputDir}/playlist.m3u8`,
  ]
}

/**
 * Builds the HLS master playlist (m3u8) content for adaptive streaming.
 */
export function buildMasterPlaylist(
  trackId: string,
  qualities: readonly QualityTier[],
  cdnBaseUrl: string,
): string {
  const lines: string[] = ['#EXTM3U', '#EXT-X-VERSION:3']

  for (const quality of qualities) {
    const tier = QUALITY_TIERS[quality]
    const bandwidth = tier.bitrate * 1000
    const variantUrl = `${cdnBaseUrl}/${hlsVariantPath(trackId, quality)}`
    lines.push(
      `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},CODECS="mp4a.40.2",NAME="${tier.label}"`,
      variantUrl,
    )
  }

  return lines.join('\n')
}

// ── Preview Clip Builder ────────────────────────────────────────────────────

export const PREVIEW_CONFIG = {
  /** Duration of preview clip in seconds. */
  DURATION_SECONDS: 30,
  /** Quality for preview clips. */
  QUALITY: 'medium' as QualityTier,
  /** Fade in/out duration in seconds. */
  FADE_DURATION: 2,
} as const

/**
 * Builds FFmpeg arguments for a preview clip with fade-in/fade-out.
 * Starts at 25% of total duration for a representative sample.
 */
export function buildPreviewArgs(
  inputPath: string,
  outputPath: string,
  totalDurationSeconds: number,
): readonly string[] {
  const startOffset = Math.max(0, Math.floor(totalDurationSeconds * 0.25))
  const clipDuration = Math.min(PREVIEW_CONFIG.DURATION_SECONDS, totalDurationSeconds)
  const tier = QUALITY_TIERS[PREVIEW_CONFIG.QUALITY]

  return [
    '-i', inputPath,
    '-ss', String(startOffset),
    '-t', String(clipDuration),
    '-vn',
    '-c:a', tier.codec,
    '-b:a', `${tier.bitrate}k`,
    '-ar', String(tier.sampleRate),
    '-af', `afade=t=in:st=0:d=${PREVIEW_CONFIG.FADE_DURATION},afade=t=out:st=${clipDuration - PREVIEW_CONFIG.FADE_DURATION}:d=${PREVIEW_CONFIG.FADE_DURATION}`,
    '-movflags', '+faststart',
    '-y', outputPath,
  ]
}

// ── Waveform Data Builder ───────────────────────────────────────────────────

export const WAVEFORM_CONFIG = {
  /** Number of samples in the waveform array. */
  SAMPLES: 200,
  /** Output format for FFmpeg raw PCM. */
  FORMAT: 's16le' as const,
} as const

export interface WaveformData {
  readonly samples: readonly number[]
  readonly peakAmplitude: number
  readonly rmsAmplitude: number
  readonly sampleCount: number
}

/**
 * Builds FFmpeg arguments to extract raw PCM for waveform analysis.
 */
export function buildWaveformArgs(
  inputPath: string,
  outputPath: string,
): readonly string[] {
  return [
    '-i', inputPath,
    '-ac', '1',
    '-ar', '8000',
    '-f', WAVEFORM_CONFIG.FORMAT,
    '-y', outputPath,
  ]
}

/**
 * Generates a normalized waveform from raw PCM data (s16le).
 * Returns an array of amplitude values normalized to 0.0–1.0.
 */
export function generateWaveformFromPcm(pcmData: Uint8Array, targetSamples: number): WaveformData {
  const view = new DataView(pcmData.buffer, pcmData.byteOffset, pcmData.byteLength)
  const totalSamples = Math.floor(pcmData.byteLength / 2)

  if (totalSamples === 0) {
    return { samples: [], peakAmplitude: 0, rmsAmplitude: 0, sampleCount: 0 }
  }

  const samplesPerBucket = Math.max(1, Math.floor(totalSamples / targetSamples))
  const buckets: number[] = []
  let peakAmplitude = 0
  let rmsSum = 0

  for (let bucket = 0; bucket < targetSamples && bucket * samplesPerBucket < totalSamples; bucket++) {
    let maxAbs = 0
    const start = bucket * samplesPerBucket
    const end = Math.min(start + samplesPerBucket, totalSamples)

    for (let i = start; i < end; i++) {
      const sample = Math.abs(view.getInt16(i * 2, true))
      if (sample > maxAbs) maxAbs = sample
      rmsSum += sample * sample
    }

    const normalized = maxAbs / 32768
    buckets.push(Math.round(normalized * 1000) / 1000)
    if (normalized > peakAmplitude) peakAmplitude = normalized
  }

  const rmsAmplitude = Math.round(Math.sqrt(rmsSum / totalSamples) / 32768 * 1000) / 1000

  return {
    samples: buckets,
    peakAmplitude: Math.round(peakAmplitude * 1000) / 1000,
    rmsAmplitude,
    sampleCount: buckets.length,
  }
}

// ── Progress Reporting ──────────────────────────────────────────────────────

export type TranscodePhase =
  | 'download'
  | 'probe'
  | 'transcode'
  | 'hls'
  | 'preview'
  | 'waveform'
  | 'upload'
  | 'complete'

export interface TranscodeProgress {
  readonly jobId: string
  readonly phase: TranscodePhase
  readonly detail: string
  readonly progressPercent: number
  readonly elapsedMs: number
}

export type ProgressCallback = (progress: TranscodeProgress) => void

// ── Transcoding Service ─────────────────────────────────────────────────────

export interface FFmpegExecutor {
  execute(args: readonly string[]): Promise<{ exitCode: number; stderr: string }>
  probe(inputPath: string): Promise<{ durationSeconds: number; codec: string; sampleRate: number }>
}

/**
 * Main transcoding service. Orchestrates FFmpeg, storage, and HLS generation.
 * Idempotent — checks if outputs already exist before processing.
 */
export function createTranscodeService(deps: {
  storage: StorageProvider
  ffmpeg: FFmpegExecutor
  cdnBaseUrl: string
  tempDir: string
  onProgress?: ProgressCallback
}) {
  const { storage, ffmpeg, cdnBaseUrl, tempDir, onProgress } = deps

  function report(jobId: string, phase: TranscodePhase, detail: string, progressPercent: number, startTime: number): void {
    onProgress?.({
      jobId,
      phase,
      detail,
      progressPercent,
      elapsedMs: Date.now() - startTime,
    })
  }

  return {
    async processJob(input: TranscodeJobInput): Promise<TranscodeJobOutput> {
      const startTime = Date.now()
      const outputs: TranscodeOutputFile[] = []

      try {
        // 1. Check idempotency: if master manifest exists, skip
        if (input.generateHls) {
          const manifestKey = hlsManifestPath(input.assetId)
          const manifestExists = await storage.exists(manifestKey)
          if (manifestExists) {
            return {
              jobId: input.jobId,
              assetId: input.assetId,
              status: 'completed',
              outputs: [],
              hlsManifestUrl: `${cdnBaseUrl}/${manifestKey}`,
              previewUrl: null,
              waveformUrl: null,
              durationSeconds: 0,
              error: null,
              processingTimeMs: Date.now() - startTime,
            }
          }
        }

        // 2. Download source file
        report(input.jobId, 'download', 'Downloading source', 5, startTime)
        const sourceData = await storage.download(input.sourceKey)
        const localInput = `${tempDir}/${input.jobId}_source`
        await writeTemp(localInput, sourceData)

        // 3. Probe source
        report(input.jobId, 'probe', 'Probing source', 10, startTime)
        const probeResult = await ffmpeg.probe(localInput)

        // 4. Transcode each quality tier
        const totalQualities = input.targetQualities.length
        for (let i = 0; i < totalQualities; i++) {
          const quality = input.targetQualities[i]!
          const progressBase = 15 + (i / totalQualities) * 30
          report(input.jobId, 'transcode', `Transcoding ${quality}`, progressBase, startTime)

          const localOutput = `${tempDir}/${input.jobId}_${quality}.m4a`
          const args = buildTranscodeArgs(localInput, localOutput, quality, input.normalize)
          const result = await ffmpeg.execute(args)

          if (result.exitCode !== 0) {
            throw new Error(`FFmpeg transcode failed for ${quality}: ${result.stderr}`)
          }

          const outputData = await readTemp(localOutput)
          const storageKey = processedPath(input.assetId, quality)
          const uploadResult = await storage.upload({
            key: storageKey,
            body: outputData,
            contentType: 'audio/mp4',
            metadata: {
              'x-quality': quality,
              'x-asset-id': input.assetId,
              'x-org-id': input.orgId,
            },
          })

          outputs.push({
            quality,
            storageKey,
            sizeBytes: uploadResult.sizeBytes,
            bitrateKbps: QUALITY_TIERS[quality].bitrate,
            codec: QUALITY_TIERS[quality].codec,
            durationSeconds: probeResult.durationSeconds,
          })
        }

        // 5. Generate HLS segments for each quality
        let hlsManifestUrl: string | null = null

        if (input.generateHls) {
          report(input.jobId, 'hls', 'Generating HLS segments', 50, startTime)

          for (const quality of input.targetQualities) {
            const hlsOutputDir = `${tempDir}/${input.jobId}_hls_${quality}`
            await mkdirTemp(hlsOutputDir)

            const hlsArgs = buildHlsArgs(localInput, hlsOutputDir, quality)
            const hlsResult = await ffmpeg.execute(hlsArgs)

            if (hlsResult.exitCode !== 0) {
              throw new Error(`HLS generation failed for ${quality}: ${hlsResult.stderr}`)
            }

            // Upload segments
            const segments = await listTempDir(hlsOutputDir)
            for (const segFile of segments) {
              const segData = await readTemp(`${hlsOutputDir}/${segFile}`)
              const isPlaylist = segFile.endsWith('.m3u8')
              const contentType = isPlaylist ? 'application/vnd.apple.mpegurl' : 'video/mp2t'

              if (isPlaylist) {
                await storage.upload({
                  key: hlsVariantPath(input.assetId, quality),
                  body: segData,
                  contentType,
                })
              } else {
                const segIndex = parseInt(segFile.replace(/\D/g, ''), 10)
                await storage.upload({
                  key: hlsSegmentPath(input.assetId, quality, segIndex),
                  body: segData,
                  contentType,
                  cacheControl: 'public, max-age=31536000, immutable',
                })
              }
            }
          }

          // Upload master playlist
          const masterContent = buildMasterPlaylist(
            input.assetId,
            input.targetQualities,
            cdnBaseUrl,
          )
          const manifestKey = hlsManifestPath(input.assetId)
          await storage.upload({
            key: manifestKey,
            body: new TextEncoder().encode(masterContent),
            contentType: 'application/vnd.apple.mpegurl',
            cacheControl: 'public, max-age=3600',
          })
          hlsManifestUrl = `${cdnBaseUrl}/${manifestKey}`
        }

        // 6. Generate preview clip
        let previewUrl: string | null = null
        report(input.jobId, 'preview', 'Generating preview clip', 75, startTime)
        try {
          const localPreview = `${tempDir}/${input.jobId}_preview.m4a`
          const previewArgs = buildPreviewArgs(localInput, localPreview, probeResult.durationSeconds)
          const previewResult = await ffmpeg.execute(previewArgs)

          if (previewResult.exitCode === 0) {
            const previewData = await readTemp(localPreview)
            const previewKey = previewPath(input.assetId)
            await storage.upload({
              key: previewKey,
              body: previewData,
              contentType: 'audio/mp4',
              metadata: { 'x-asset-id': input.assetId, 'x-type': 'preview' },
            })
            previewUrl = `${cdnBaseUrl}/${previewKey}`
          }
        } catch {
          // Preview is best-effort — don't fail the job
        }

        // 7. Generate waveform data
        let waveformUrl: string | null = null
        report(input.jobId, 'waveform', 'Generating waveform', 85, startTime)
        try {
          const localPcm = `${tempDir}/${input.jobId}_waveform.raw`
          const wfArgs = buildWaveformArgs(localInput, localPcm)
          const wfResult = await ffmpeg.execute(wfArgs)

          if (wfResult.exitCode === 0) {
            const pcmData = await readTemp(localPcm)
            const waveform = generateWaveformFromPcm(pcmData, WAVEFORM_CONFIG.SAMPLES)
            const wfKey = waveformPath(input.assetId)
            await storage.upload({
              key: wfKey,
              body: new TextEncoder().encode(JSON.stringify(waveform)),
              contentType: 'application/json',
              metadata: { 'x-asset-id': input.assetId, 'x-type': 'waveform' },
              cacheControl: 'public, max-age=31536000, immutable',
            })
            waveformUrl = `${cdnBaseUrl}/${wfKey}`
          }
        } catch {
          // Waveform is best-effort — don't fail the job
        }

        report(input.jobId, 'complete', 'Transcode complete', 100, startTime)

        return {
          jobId: input.jobId,
          assetId: input.assetId,
          status: 'completed',
          outputs,
          hlsManifestUrl,
          previewUrl,
          waveformUrl,
          durationSeconds: probeResult.durationSeconds,
          error: null,
          processingTimeMs: Date.now() - startTime,
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown transcoding error'
        return {
          jobId: input.jobId,
          assetId: input.assetId,
          status: 'failed',
          outputs,
          hlsManifestUrl: null,
          previewUrl: null,
          waveformUrl: null,
          durationSeconds: 0,
          error: message,
          processingTimeMs: Date.now() - startTime,
        }
      }
    },
  }
}

// ── Temp File Helpers (injected in production, inline for contract) ──────────

async function writeTemp(path: string, data: Uint8Array): Promise<void> {
  const { writeFile, mkdir } = await import('node:fs/promises')
  const { dirname } = await import('node:path')
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, data)
}

async function readTemp(path: string): Promise<Uint8Array> {
  const { readFile } = await import('node:fs/promises')
  return new Uint8Array(await readFile(path))
}

async function mkdirTemp(path: string): Promise<void> {
  const { mkdir } = await import('node:fs/promises')
  await mkdir(path, { recursive: true })
}

async function listTempDir(path: string): Promise<readonly string[]> {
  const { readdir } = await import('node:fs/promises')
  return readdir(path)
}
