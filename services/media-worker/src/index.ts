/**
 * @nzila/media-worker — Barrel Export
 *
 * @module @nzila/media-worker
 */

// ── Storage ─────────────────────────────────────────────────────────────────
export {
  STORAGE_PATHS,
  rawPath,
  processedPath,
  hlsPath,
  hlsManifestPath,
  hlsVariantPath,
  hlsSegmentPath,
  artworkPath,
  createS3StorageAdapter,
  type StorageProvider,
  type StorageConfig,
  type UploadParams,
  type UploadResult,
  type StorageObject,
} from './storage'

// ── Transcoding ─────────────────────────────────────────────────────────────
export {
  QUALITY_TIERS,
  ALL_QUALITIES,
  buildTranscodeArgs,
  buildHlsArgs,
  buildMasterPlaylist,
  createTranscodeService,
  type QualityTier,
  type TranscodeJobInput,
  type TranscodeJobOutput,
  type TranscodeOutputFile,
  type FFmpegExecutor,
} from './transcoder'

// ── Streaming Delivery ──────────────────────────────────────────────────────
export {
  STREAM_ACCESS_TIERS,
  getAccessPolicy,
  resolveQuality,
  createStreamingDeliveryService,
  type StreamAccessTier,
  type StreamAccessPolicy,
  type StreamUrlRequest,
  type StreamUrlResponse,
} from './streaming'

// ── Player Contract ─────────────────────────────────────────────────────────
export {
  PlaybackEventType,
  REVENUE_STREAM_THRESHOLDS,
  qualifyStream,
  createPlaybackSessionManager,
  type PlaybackSession,
  type PlaybackState,
  type PlaybackEvent,
  type PlaybackEventMetadata,
  type StreamQualification,
} from './player'

// ── Low Data Mode ───────────────────────────────────────────────────────────
export {
  LOW_DATA_CONFIG,
  NetworkType,
  toLightMetadata,
  toLightMetadataBatch,
  shouldSuggestLowData,
  selectQualityForBandwidth,
  type TrackMetadata,
  type LightTrackMetadata,
} from './low-data'

// ── Queue ───────────────────────────────────────────────────────────────────
export {
  QUEUE_NAMES,
  createQueueWorker,
  type QueueName,
  type QueueMessage,
  type QueueProvider,
  type EnqueueParams,
  type QueueWorkerConfig,
  type QueueWorker,
  type JobHandler,
  type WorkerLogger,
  type TranscodeJobPayload,
  type PaymentProcessPayload,
  type PaymentConfirmPayload,
  type PayoutExecutePayload,
  type NotificationPayload,
  type RecommendationUpdatePayload,
  type AnalyticsIngestPayload,
} from './queue'
