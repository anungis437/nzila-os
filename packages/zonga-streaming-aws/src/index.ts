/**
 * @nzila/zonga-streaming-aws — AWS-backed streaming infrastructure for Zonga.
 *
 * Submodules:
 *  - ivs-live/     — AWS IVS live streaming (channel management, ingest, playback)
 *  - mediaconvert/ — VOD transcoding via AWS MediaConvert
 *  - s3-storage/   — Raw media upload/storage via S3
 *  - cloudfront-delivery/ — CDN delivery with signed URLs
 *  - metrics/      — Streaming telemetry / observability
 *
 * This barrel re-exports types and configuration helpers.
 * Provider-specific logic lives in submodule imports.
 */

export {
  // Provider identifiers
  AWS_LIVE_PROVIDER,
  AWS_VOD_PROVIDER,
  AWS_STORAGE_PROVIDER,
  AWS_CDN_PROVIDER,
  // Config schemas & resolvers
  awsConfigSchema,
  ivsConfigSchema,
  s3ConfigSchema,
  mediaConvertConfigSchema,
  cloudFrontConfigSchema,
  resolveAwsConfig,
  resolveIvsConfig,
  resolveS3Config,
  resolveMediaConvertConfig,
  resolveCloudFrontConfig,
  // Enums
  LIVE_STREAM_STATUSES,
  MEDIA_JOB_STATUSES,
  MEDIA_JOB_TYPES,
  QUALITY_TIERS,
  VARIANT_STATUSES,
  STREAM_EVENT_TYPES,
  // Types
  type AwsConfig,
  type IvsConfig,
  type S3Config,
  type MediaConvertConfig,
  type CloudFrontConfig,
  type LiveStreamStatus,
  type MediaJobStatus,
  type MediaJobType,
  type QualityTier,
  type VariantStatus,
  type StreamEventType,
  type AwsLiveProvider,
  type AwsVodProvider,
  type AwsStorageProvider,
  type AwsCdnProvider,
} from './types'
