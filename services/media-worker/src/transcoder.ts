/**
 * @nzila/media-worker — Transcoding Pipeline
 *
 * Queue-based audio transcoding. Generates multiple quality tiers
 * and HLS segments using FFmpeg. Idempotent, retry-safe.
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
}) {
  const { storage, ffmpeg, cdnBaseUrl, tempDir } = deps

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
              durationSeconds: 0,
              error: null,
              processingTimeMs: Date.now() - startTime,
            }
          }
        }

        // 2. Download source file
        const sourceData = await storage.download(input.sourceKey)
        const localInput = `${tempDir}/${input.jobId}_source`
        // Write to temp (in production, use fs.writeFile)
        await writeTemp(localInput, sourceData)

        // 3. Probe source
        const probeResult = await ffmpeg.probe(localInput)

        // 4. Transcode each quality tier
        for (const quality of input.targetQualities) {
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

        return {
          jobId: input.jobId,
          assetId: input.assetId,
          status: 'completed',
          outputs,
          hlsManifestUrl,
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
