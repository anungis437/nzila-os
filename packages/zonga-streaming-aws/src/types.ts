/**
 * @nzila/zonga-streaming-aws — shared types and configuration.
 *
 * Provider identifiers, credentials config, common enums.
 * All AWS-specific SDK references live in submodules, not here.
 */
import { z } from 'zod'

// ── Provider Identifiers ────────────────────────────────────────────────────

export const AWS_LIVE_PROVIDER = 'aws_ivs' as const
export const AWS_VOD_PROVIDER = 'aws_mediaconvert' as const
export const AWS_STORAGE_PROVIDER = 'aws_s3' as const
export const AWS_CDN_PROVIDER = 'aws_cloudfront' as const

export type AwsLiveProvider = typeof AWS_LIVE_PROVIDER
export type AwsVodProvider = typeof AWS_VOD_PROVIDER
export type AwsStorageProvider = typeof AWS_STORAGE_PROVIDER
export type AwsCdnProvider = typeof AWS_CDN_PROVIDER

// ── Credential Config ───────────────────────────────────────────────────────

export const awsConfigSchema = z.object({
  region: z.string().default('us-east-1'),
  accessKeyId: z.string().optional(),
  secretAccessKey: z.string().optional(),
  sessionToken: z.string().optional(),
})

export type AwsConfig = z.infer<typeof awsConfigSchema>

export const ivsConfigSchema = awsConfigSchema.extend({
  /** Base latency mode: NORMAL or LOW */
  latencyMode: z.enum(['NORMAL', 'LOW']).default('LOW'),
  /** Channel type: STANDARD or BASIC */
  channelType: z.enum(['STANDARD', 'BASIC']).default('STANDARD'),
})

export type IvsConfig = z.infer<typeof ivsConfigSchema>

export const s3ConfigSchema = awsConfigSchema.extend({
  /** The S3 bucket for raw media uploads */
  rawBucket: z.string(),
  /** The S3 bucket for processed media outputs */
  outputBucket: z.string(),
})

export type S3Config = z.infer<typeof s3ConfigSchema>

export const mediaConvertConfigSchema = awsConfigSchema.extend({
  /** MediaConvert endpoint URL (account-specific) */
  endpoint: z.string(),
  /** IAM role ARN that MediaConvert assumes */
  roleArn: z.string(),
  /** S3 output bucket for transcoded media */
  outputBucket: z.string(),
  /** S3 output key prefix */
  outputPrefix: z.string().default('processed/'),
})

export type MediaConvertConfig = z.infer<typeof mediaConvertConfigSchema>

export const cloudFrontConfigSchema = z.object({
  /** CloudFront distribution domain (e.g. d1234.cloudfront.net) */
  distributionDomain: z.string(),
  /** CloudFront key pair ID for signed URLs */
  keyPairId: z.string(),
  /** PEM-encoded private key for signed URLs — loaded from env/secret store */
  privateKeyPem: z.string(),
  /** Default signed URL TTL in seconds */
  defaultTtlSec: z.number().default(3600),
})

export type CloudFrontConfig = z.infer<typeof cloudFrontConfigSchema>

// ── Live Stream States ──────────────────────────────────────────────────────

export const LIVE_STREAM_STATUSES = [
  'scheduled',
  'ready',
  'live',
  'ended',
  'failed',
] as const

export type LiveStreamStatus = (typeof LIVE_STREAM_STATUSES)[number]

// ── Media Job States ────────────────────────────────────────────────────────

export const MEDIA_JOB_STATUSES = [
  'pending',
  'submitted',
  'processing',
  'completed',
  'failed',
  'cancelled',
] as const

export type MediaJobStatus = (typeof MEDIA_JOB_STATUSES)[number]

export const MEDIA_JOB_TYPES = [
  'transcode_hls',
  'transcode_audio',
  'thumbnail',
  'poster',
] as const

export type MediaJobType = (typeof MEDIA_JOB_TYPES)[number]

// ── Quality Tiers ───────────────────────────────────────────────────────────

export const QUALITY_TIERS = ['free', 'standard', 'high', 'premium'] as const
export type QualityTier = (typeof QUALITY_TIERS)[number]

// ── Variant States ──────────────────────────────────────────────────────────

export const VARIANT_STATUSES = ['processing', 'ready', 'failed', 'deleted'] as const
export type VariantStatus = (typeof VARIANT_STATUSES)[number]

// ── Stream Event Type ───────────────────────────────────────────────────────

export const STREAM_EVENT_TYPES = [
  'stream_created',
  'stream_ready',
  'stream_started',
  'stream_ended',
  'stream_failed',
  'credential_issued',
  'credential_rotated',
  'playback_granted',
  'playback_denied',
  'media_job_submitted',
  'media_job_completed',
  'media_job_failed',
  'viewer_joined',
  'viewer_left',
] as const

export type StreamEventType = (typeof STREAM_EVENT_TYPES)[number]

// ── Resolved config from env ────────────────────────────────────────────────

export function resolveAwsConfig(): AwsConfig {
  return awsConfigSchema.parse({
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    sessionToken: process.env.AWS_SESSION_TOKEN,
  })
}

export function resolveIvsConfig(): IvsConfig {
  return ivsConfigSchema.parse({
    ...resolveAwsConfig(),
    latencyMode: process.env.ZONGA_IVS_LATENCY_MODE ?? 'LOW',
    channelType: process.env.ZONGA_IVS_CHANNEL_TYPE ?? 'STANDARD',
  })
}

export function resolveS3Config(): S3Config {
  return s3ConfigSchema.parse({
    ...resolveAwsConfig(),
    rawBucket: process.env.ZONGA_S3_RAW_BUCKET,
    outputBucket: process.env.ZONGA_S3_OUTPUT_BUCKET,
  })
}

export function resolveMediaConvertConfig(): MediaConvertConfig {
  return mediaConvertConfigSchema.parse({
    ...resolveAwsConfig(),
    endpoint: process.env.ZONGA_MEDIACONVERT_ENDPOINT,
    roleArn: process.env.ZONGA_MEDIACONVERT_ROLE_ARN,
    outputBucket: process.env.ZONGA_S3_OUTPUT_BUCKET,
    outputPrefix: process.env.ZONGA_MEDIACONVERT_OUTPUT_PREFIX ?? 'processed/',
  })
}

export function resolveCloudFrontConfig(): CloudFrontConfig {
  return cloudFrontConfigSchema.parse({
    distributionDomain: process.env.ZONGA_CLOUDFRONT_DOMAIN,
    keyPairId: process.env.ZONGA_CLOUDFRONT_KEY_PAIR_ID,
    privateKeyPem: process.env.ZONGA_CLOUDFRONT_PRIVATE_KEY_PEM,
    defaultTtlSec: process.env.ZONGA_CLOUDFRONT_TTL_SEC
      ? Number(process.env.ZONGA_CLOUDFRONT_TTL_SEC)
      : 3600,
  })
}
