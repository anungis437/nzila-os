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
  waveformPath,
  previewPath,
  createS3StorageAdapter,
  createInMemoryStorageAdapter,
  type StorageProvider,
  type StorageConfig,
  type UploadParams,
  type UploadResult,
  type StorageObject,
  type ObjectMetadata,
} from './storage'

// ── Transcoding ─────────────────────────────────────────────────────────────
export {
  QUALITY_TIERS,
  ALL_QUALITIES,
  buildTranscodeArgs,
  buildHlsArgs,
  buildMasterPlaylist,
  buildPreviewArgs,
  buildWaveformArgs,
  generateWaveformFromPcm,
  createTranscodeService,
  PREVIEW_CONFIG,
  WAVEFORM_CONFIG,
  type QualityTier,
  type TranscodeJobInput,
  type TranscodeJobOutput,
  type TranscodeOutputFile,
  type FFmpegExecutor,
  type WaveformData,
  type TranscodeProgress,
  type ProgressCallback,
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
  createRedisQueueProvider,
  createInMemoryQueueProvider,
  replayDeadLetters,
  type QueueName,
  type QueueMessage,
  type QueueProvider,
  type EnqueueParams,
  type QueueWorkerConfig,
  type QueueWorker,
  type JobHandler,
  type WorkerLogger,
  type RedisQueueConfig,
  type RedisClient,
  type TranscodeJobPayload,
  type PaymentProcessPayload,
  type PaymentConfirmPayload,
  type PayoutExecutePayload,
  type NotificationPayload,
  type RecommendationUpdatePayload,
  type AnalyticsIngestPayload,
} from './queue'

// ── Observability ───────────────────────────────────────────────────────────
export {
  createCorrelationId,
  createLogger,
  createMetricsCollector,
  createHealthChecker,
  MediaWorkerError,
  isRetryableError,
  MEDIA_METRICS,
  type CorrelationContext,
  type LogLevel,
  type LogEntry,
  type StructuredLogger,
  type MetricsCollector,
  type MediaErrorCode,
  type HealthStatus,
  type HealthCheck,
  type HealthCheckDep,
} from './observability'

// ── Server ──────────────────────────────────────────────────────────────────
export {
  validateEnv,
  createHttpServer,
  registerShutdownHandlers,
  type ServerEnv,
  type ServerDeps,
} from './server'

// ── Recovery ────────────────────────────────────────────────────────────────
export {
  classifyFailure,
  cleanupPartialArtifacts,
  detectOrphans,
  purgeOrphans,
  type RetryDecision,
  type OrphanedArtifact,
} from './recovery'
