/**
 * @nzila/zonga-streaming — Audio pipeline for the Zonga music platform.
 *
 * Upload validation → transcode orchestration → CDN delivery → adaptive player logic.
 * All functions are pure or port-based (caller provides storage/DB adapters).
 */

// ── Upload Pipeline ─────────────────────────────────────────────────────────
export {
  validateUpload,
  parseAudioMetadata,
  computeUploadKey,
  type UploadValidationResult,
  type AudioMetadata,
  type UploadPolicy,
} from './upload/index'

// ── Transcode Orchestration ─────────────────────────────────────────────────
export {
  createTranscodeManifest,
  selectTargetQualities,
  buildHlsPlaylist,
  computeTranscodeOutputPaths,
  type TranscodeManifest,
  type TranscodeQuality,
  type TranscodeOutput,
  type HlsPlaylist,
  QUALITY_PRESETS,
} from './transcode/index'

// ── Delivery / CDN ──────────────────────────────────────────────────────────
export {
  resolveStreamUrl,
  selectOptimalQuality,
  computeCdnSignedUrl,
  buildAdaptiveBitrateManifest,
  type StreamDeliveryContext,
  type CdnConfig,
  type SignedUrlParams,
} from './delivery/index'

// ── Player Logic ────────────────────────────────────────────────────────────
export {
  createPlaybackSession,
  computeBufferStrategy,
  resolveNextTrack,
  computeGaplessTransition,
  trackPlaybackProgress,
  type PlaybackSession,
  type BufferStrategy,
  type PlaybackProgressEvent,
  type QueueState,
} from './player/index'
