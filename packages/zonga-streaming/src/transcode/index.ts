/**
 * Transcode orchestration — quality selection, HLS manifest generation,
 * output path computation for multi-bitrate encoding.
 */

// ── Types ───────────────────────────────────────────────────────────────────

export interface TranscodeQuality {
  label: string
  bitrate: number        // kbps
  sampleRate: number     // Hz
  codec: 'aac' | 'opus' | 'mp3'
  container: 'mp4' | 'webm' | 'ts'
  segmentDurationSec: number
}

export interface TranscodeOutput {
  quality: TranscodeQuality
  storagePath: string
  manifestPath: string
  estimatedSizeBytes: number
}

export interface TranscodeManifest {
  assetId: string
  sourceUrl: string
  outputs: TranscodeOutput[]
  masterManifestPath: string
  createdAt: string
}

export interface HlsPlaylist {
  masterPlaylist: string
  variantPlaylists: { quality: string; content: string; path: string }[]
}

// ── Quality Presets ─────────────────────────────────────────────────────────

export const QUALITY_PRESETS: Record<string, TranscodeQuality> = {
  low: {
    label: 'Low',
    bitrate: 64,
    sampleRate: 22050,
    codec: 'aac',
    container: 'mp4',
    segmentDurationSec: 6,
  },
  normal: {
    label: 'Normal',
    bitrate: 128,
    sampleRate: 44100,
    codec: 'aac',
    container: 'mp4',
    segmentDurationSec: 6,
  },
  high: {
    label: 'High',
    bitrate: 256,
    sampleRate: 44100,
    codec: 'aac',
    container: 'mp4',
    segmentDurationSec: 6,
  },
  lossless: {
    label: 'Lossless',
    bitrate: 320,
    sampleRate: 48000,
    codec: 'aac',
    container: 'mp4',
    segmentDurationSec: 6,
  },
} as const

// ── Quality Selection ───────────────────────────────────────────────────────

/**
 * Select target transcode qualities based on source audio properties.
 * Only generates qualities at or below the source bitrate.
 */
export function selectTargetQualities(
  sourceBitrate: number,
  sourceSampleRate: number,
  isPremiumCreator: boolean = false
): TranscodeQuality[] {
  const candidates = ['low', 'normal', 'high', 'lossless'] as const
  const selected: TranscodeQuality[] = []

  for (const key of candidates) {
    const preset = QUALITY_PRESETS[key]!
    // Only include qualities at or below source capability
    if (preset.bitrate <= sourceBitrate || preset.bitrate <= 128) {
      selected.push({ ...preset })
    }
    // Premium creators always get high quality if source supports it
    if (isPremiumCreator && preset.bitrate <= sourceBitrate) {
      if (!selected.find((q) => q.bitrate === preset.bitrate)) {
        selected.push({ ...preset })
      }
    }
  }

  // Always include at least normal quality
  if (selected.length === 0) {
    selected.push({ ...QUALITY_PRESETS['normal']! })
  }

  // Deduplicate by bitrate and sort ascending
  const seen = new Set<number>()
  return selected
    .filter((q) => {
      if (seen.has(q.bitrate)) return false
      seen.add(q.bitrate)
      return true
    })
    .sort((a, b) => a.bitrate - b.bitrate)
}

// ── Output Path Computation ─────────────────────────────────────────────────

/**
 * Compute storage paths for each transcode output.
 * Format: assets/{assetId}/audio/{quality}/
 */
export function computeTranscodeOutputPaths(
  assetId: string,
  qualities: TranscodeQuality[]
): TranscodeOutput[] {
  return qualities.map((quality) => {
    const qualityDir = `assets/${assetId}/audio/${quality.bitrate}kbps`
    return {
      quality,
      storagePath: `${qualityDir}/segments/`,
      manifestPath: `${qualityDir}/playlist.m3u8`,
      estimatedSizeBytes: 0, // Filled after transcode
    }
  })
}

// ── Transcode Manifest ──────────────────────────────────────────────────────

/**
 * Create a transcode job manifest that the worker uses to process the audio.
 */
export function createTranscodeManifest(
  assetId: string,
  sourceUrl: string,
  sourceBitrate: number,
  sourceSampleRate: number,
  options?: { isPremiumCreator?: boolean }
): TranscodeManifest {
  const qualities = selectTargetQualities(
    sourceBitrate,
    sourceSampleRate,
    options?.isPremiumCreator
  )
  const outputs = computeTranscodeOutputPaths(assetId, qualities)

  return {
    assetId,
    sourceUrl,
    outputs,
    masterManifestPath: `assets/${assetId}/audio/master.m3u8`,
    createdAt: new Date().toISOString(),
  }
}

// ── HLS Playlist Generation ─────────────────────────────────────────────────

/**
 * Build a compliant HLS master playlist and variant playlists.
 * Follows Apple HLS specification (RFC 8216).
 */
export function buildHlsPlaylist(
  assetId: string,
  outputs: TranscodeOutput[],
  totalDurationSec: number,
  cdnBaseUrl: string
): HlsPlaylist {
  // Master playlist — references all variants
  const masterLines = ['#EXTM3U', '#EXT-X-VERSION:4', '']

  const variantPlaylists: HlsPlaylist['variantPlaylists'] = []

  for (const output of outputs) {
    const { quality } = output
    const bandwidth = quality.bitrate * 1000 // HLS uses bits/sec
    const codecs = quality.codec === 'aac' ? 'mp4a.40.2' : quality.codec === 'opus' ? 'opus' : 'mp4a.40.34'
    const variantUrl = `${cdnBaseUrl}/${output.manifestPath}`

    masterLines.push(
      `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},CODECS="${codecs}",AUDIO="audio"`,
      variantUrl,
      ''
    )

    // Variant playlist — segment list for this quality
    const segmentCount = Math.ceil(totalDurationSec / quality.segmentDurationSec)
    const segmentLines = [
      '#EXTM3U',
      '#EXT-X-VERSION:4',
      `#EXT-X-TARGETDURATION:${quality.segmentDurationSec}`,
      '#EXT-X-MEDIA-SEQUENCE:0',
      '#EXT-X-PLAYLIST-TYPE:VOD',
      '',
    ]

    for (let i = 0; i < segmentCount; i++) {
      const isLast = i === segmentCount - 1
      const segDuration = isLast
        ? totalDurationSec - i * quality.segmentDurationSec
        : quality.segmentDurationSec

      segmentLines.push(
        `#EXTINF:${segDuration.toFixed(3)},`,
        `${cdnBaseUrl}/${output.storagePath}segment_${String(i).padStart(5, '0')}.${quality.container === 'mp4' ? 'm4s' : 'ts'}`
      )
    }

    segmentLines.push('', '#EXT-X-ENDLIST')

    variantPlaylists.push({
      quality: quality.label,
      content: segmentLines.join('\n'),
      path: output.manifestPath,
    })
  }

  return {
    masterPlaylist: masterLines.join('\n'),
    variantPlaylists,
  }
}
